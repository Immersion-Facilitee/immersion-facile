import { type AssessmentDto, errors, expectToEqual } from "shared";
import { feedbacksSelectors } from "src/core-logic/domain/feedback/feedback.selectors";
import {
  createTestStore,
  type TestDependencies,
} from "src/core-logic/storeConfig/createTestStore";
import type { ReduxStore } from "src/core-logic/storeConfig/store";
import { assessmentSelectors } from "./assessment.selectors";
import { assessmentSlice } from "./assessment.slice";

describe("Immersion Assessment slice", () => {
  let store: ReduxStore;
  let dependencies: TestDependencies;

  beforeEach(() => {
    ({ store, dependencies } = createTestStore());
  });

  describe("immersion assessment creation requested", () => {
    const feedGatewayWithCreationError = (error: Error) => {
      dependencies.assessmentGateway.creationResponse$.error(error);
    };

    const feedGatewayWithCreationSuccess = () => {
      dependencies.assessmentGateway.creationResponse$.next(undefined);
    };

    it("success", () => {
      expectStateToMatchInitialState(store);
      store.dispatch(
        assessmentSlice.actions.creationRequested({
          assessment: {
            conventionId: "23465",
            status: "DID_NOT_SHOW",
            endedWithAJob: false,
            establishmentFeedback: "my feedback",
            establishmentAdvices: "my advices",
            beneficiaryAgreement: null,
            beneficiaryFeedback: null,
            signedAt: null,
            createdAt: new Date().toISOString(),
          },
          jwt: "",
          feedbackTopic: "assessment",
        }),
      );
      expect(assessmentSelectors.isLoading(store.getState())).toBe(true);
      feedGatewayWithCreationSuccess();
      expect(assessmentSelectors.isLoading(store.getState())).toBe(false);
      expectToEqual(feedbacksSelectors.feedbacks(store.getState()), {
        assessment: {
          title: "Bilan envoyé",
          level: "success",
          on: "create",
          message: "Le bilan a bien été envoyé",
        },
      });
    });

    it("error on backend", () => {
      const backendError: Error = new Error("Backend Error");
      expectStateToMatchInitialState(store);
      store.dispatch(
        assessmentSlice.actions.creationRequested({
          assessment: {
            conventionId: "23465",
            status: "DID_NOT_SHOW",
            endedWithAJob: false,
            establishmentFeedback: "my feedback",
            establishmentAdvices: "my advices",
            beneficiaryAgreement: null,
            beneficiaryFeedback: null,
            signedAt: null,
            createdAt: new Date().toISOString(),
          },
          jwt: "",
          feedbackTopic: "assessment",
        }),
      );
      expect(assessmentSelectors.isLoading(store.getState())).toBe(true);
      feedGatewayWithCreationError(backendError);
      expect(assessmentSelectors.isLoading(store.getState())).toBe(false);
      expectToEqual(feedbacksSelectors.feedbacks(store.getState()), {
        assessment: {
          title: "Problème lors de l'envoi du bilan",
          level: "error",
          on: "create",
          message: "Backend Error",
        },
      });
    });
  });

  describe("immersion assessment get requested", () => {
    const conventionId = "11111111-1111-4111-1111-111111111111";
    const assessment: AssessmentDto = {
      conventionId,
      status: "COMPLETED",
      endedWithAJob: false,
      establishmentAdvices: "my advices",
      establishmentFeedback: "my feedback",
      beneficiaryAgreement: null,
      beneficiaryFeedback: null,
      signedAt: null,
      createdAt: new Date().toISOString(),
      createdBy: {
        role: "counsellor",
        email: "marie@agence.fr",
        firstName: "Marie",
        lastName: "Dupont",
      },
    };
    const feedGatewayWithGetError = (error: Error) => {
      dependencies.assessmentGateway.getResponse$.error(error);
    };

    const feedGatewayWithGetSuccess = () => {
      dependencies.assessmentGateway.getResponse$.next(assessment);
    };

    it("success", () => {
      expectStateToMatchInitialState(store);

      store.dispatch(
        assessmentSlice.actions.getAssessmentRequested({
          conventionId,
          jwt: "my-jwt",
          feedbackTopic: "assessment",
        }),
      );

      expect(assessmentSelectors.isLoading(store.getState())).toBe(true);
      feedGatewayWithGetSuccess();
      expect(assessmentSelectors.isLoading(store.getState())).toBe(false);
      expectToEqual(
        assessmentSelectors.currentAssessment(store.getState()),
        assessment,
      );
    });

    it("not found error", () => {
      expectStateToMatchInitialState(store);
      store.dispatch(
        assessmentSlice.actions.getAssessmentRequested({
          conventionId,
          jwt: "my-jwt",
          feedbackTopic: "assessment",
        }),
      );

      expect(assessmentSelectors.isLoading(store.getState())).toBe(true);
      feedGatewayWithGetError(errors.assessment.notFound(conventionId));
      expect(assessmentSelectors.isLoading(store.getState())).toBe(false);
      expectToEqual(feedbacksSelectors.feedbacks(store.getState()), {});
    });

    it("other errors", () => {
      expectStateToMatchInitialState(store);
      store.dispatch(
        assessmentSlice.actions.getAssessmentRequested({
          conventionId,
          jwt: "my-jwt",
          feedbackTopic: "assessment",
        }),
      );

      expect(assessmentSelectors.isLoading(store.getState())).toBe(true);
      feedGatewayWithGetError(new Error("Assessement not found"));
      expect(assessmentSelectors.isLoading(store.getState())).toBe(false);
      expectToEqual(feedbacksSelectors.feedbacks(store.getState()), {
        assessment: {
          title: "Problème lors de la récupération du bilan",
          level: "error",
          on: "fetch",
          message: "Assessement not found",
        },
      });
    });
  });

  describe("immersion assessment sign requested", () => {
    const feedGatewayWithSignError = (error: Error) => {
      dependencies.assessmentGateway.signAssessmentResponse$.error(error);
    };

    const feedGatewayWithSignSuccess = () => {
      dependencies.assessmentGateway.signAssessmentResponse$.next(undefined);
    };

    it("success", () => {
      expectStateToMatchInitialState(store);
      store.dispatch(
        assessmentSlice.actions.signAssessmentRequested({
          params: {
            conventionId: "23465",
            beneficiaryAgreement: true,
            beneficiaryFeedback: "Mon commentaire",
          },
          jwt: "my-jwt",
          feedbackTopic: "sign-assessment",
        }),
      );
      expect(assessmentSelectors.isLoading(store.getState())).toBe(true);
      feedGatewayWithSignSuccess();
      expect(assessmentSelectors.isLoading(store.getState())).toBe(false);
      expectToEqual(feedbacksSelectors.feedbacks(store.getState()), {
        "sign-assessment": {
          title: "Votre bilan d'immersion a bien été signé",
          level: "success",
          on: "create",
          message:
            "Merci pour votre retour. Votre signature a bien été prise en compte.",
        },
      });
    });

    it("error on backend", () => {
      const backendError: Error = new Error("Backend Error");
      expectStateToMatchInitialState(store);
      store.dispatch(
        assessmentSlice.actions.signAssessmentRequested({
          params: {
            conventionId: "23465",
            beneficiaryAgreement: true,
            beneficiaryFeedback: "Mon commentaire",
          },
          jwt: "my-jwt",
          feedbackTopic: "sign-assessment",
        }),
      );
      expect(assessmentSelectors.isLoading(store.getState())).toBe(true);
      feedGatewayWithSignError(backendError);
      expect(assessmentSelectors.isLoading(store.getState())).toBe(false);
      expectToEqual(feedbacksSelectors.feedbacks(store.getState()), {
        "sign-assessment": {
          title: "Problème lors de la signature du bilan",
          level: "error",
          on: "create",
          message: "Backend Error",
        },
      });
    });
  });

  describe("immersion assessment delete requested", () => {
    const feedGatewayWithDeleteError = (error: Error) => {
      dependencies.assessmentGateway.deleteAssessmentResponse$.error(error);
    };

    const feedGatewayWithDeleteSuccess = () => {
      dependencies.assessmentGateway.deleteAssessmentResponse$.next(undefined);
    };

    it("success", () => {
      expectStateToMatchInitialState(store);
      store.dispatch(
        assessmentSlice.actions.deleteAssessmentRequested({
          params: {
            conventionId: "23465",
            deleteAssessmentJustification: "Parce que…",
          },
          jwt: "my-jwt",
          feedbackTopic: "delete-assessment",
        }),
      );
      expect(assessmentSelectors.isLoading(store.getState())).toBe(true);
      feedGatewayWithDeleteSuccess();
      expect(assessmentSelectors.isLoading(store.getState())).toBe(false);
      expectToEqual(feedbacksSelectors.feedbacks(store.getState()), {
        "delete-assessment": {
          title: "Bilan supprimé",
          level: "success",
          on: "delete",
          message: "Le bilan a bien été supprimé",
        },
      });
    });

    it("error on backend", () => {
      const backendError: Error = new Error("Backend Error");
      expectStateToMatchInitialState(store);
      store.dispatch(
        assessmentSlice.actions.deleteAssessmentRequested({
          params: {
            conventionId: "23465  ",
            deleteAssessmentJustification: "Parce que…",
          },
          jwt: "my-jwt",
          feedbackTopic: "delete-assessment",
        }),
      );
      expect(assessmentSelectors.isLoading(store.getState())).toBe(true);
      feedGatewayWithDeleteError(backendError);
      expect(assessmentSelectors.isLoading(store.getState())).toBe(false);
      expectToEqual(feedbacksSelectors.feedbacks(store.getState()), {
        "delete-assessment": {
          title: "Problème lors de la suppression du bilan",
          level: "error",
          on: "delete",
          message: "Backend Error",
        },
      });
    });
  });

  describe("clear fetched assessment", () => {
    it("Clear fetched assessment", () => {
      const conventionId = "11111111-1111-4111-1111-111111111111";
      const assessment: AssessmentDto = {
        conventionId,
        status: "COMPLETED",
        endedWithAJob: false,
        establishmentAdvices: "my advices",
        establishmentFeedback: "my feedback",
        beneficiaryAgreement: null,
        beneficiaryFeedback: null,
        signedAt: null,
        createdAt: new Date().toISOString(),
      };
      ({ store } = createTestStore({
        assessment: {
          isLoading: false,
          currentAssessment: assessment,
        },
      }));

      expectToEqual(
        assessmentSelectors.currentAssessment(store.getState()),
        assessment,
      );

      store.dispatch(assessmentSlice.actions.clearFetchedAssessment());
      expectStateToMatchInitialState(store);
      expectToEqual(
        assessmentSelectors.currentAssessment(store.getState()),
        null,
      );
    });
  });
});

const expectStateToMatchInitialState = (store: ReduxStore) => {
  expectToEqual(assessmentSelectors.isLoading(store.getState()), false);
  expectToEqual(assessmentSelectors.currentAssessment(store.getState()), null);
};
