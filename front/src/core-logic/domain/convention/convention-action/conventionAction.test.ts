import { addDays } from "date-fns";
import {
  type ConventionAgencyPublicFields,
  ConventionDtoBuilder,
  type ConventionReadDto,
  expectObjectsToMatch,
  expectToEqual,
  makeEmptyLastReminders,
  ScheduleDtoBuilder,
} from "shared";
import {
  type ConventionState,
  initialConventionState,
} from "src/core-logic/domain/convention/convention.slice";
import {
  type ConventionActionState,
  conventionActionInitialState,
  conventionActionSlice,
  type RenewConventionPayload,
} from "src/core-logic/domain/convention/convention-action/conventionAction.slice";
import { feedbacksSelectors } from "src/core-logic/domain/feedback/feedback.selectors";
import type { Feedbacks } from "src/core-logic/domain/feedback/feedback.slice";
import {
  createTestStore,
  type TestDependencies,
} from "src/core-logic/storeConfig/createTestStore";
import type { ReduxStore } from "src/core-logic/storeConfig/store";

const agencyFields: ConventionAgencyPublicFields = {
  agencyContactEmail: "contact@mail.com",
  agencyDepartment: "75",
  agencyKind: "mission-locale" as const,
  agencyName: "Agence Mission Locale",
  agencyRefersTo: undefined,
  agencySiret: "11110000111155",
  agencyValidationSteps: "validator-only",
};
const convention: ConventionReadDto = {
  ...agencyFields,
  ...new ConventionDtoBuilder().notSigned().build(),
  assessment: null,
  lastReminders: makeEmptyLastReminders(),
  isEstablishmentBanned: false,
};

describe("convention action slice", () => {
  let store: ReduxStore;
  let dependencies: TestDependencies;

  beforeEach(() => {
    ({ store, dependencies } = createTestStore({
      conventionAction: {
        ...conventionActionInitialState,
      },
    }));
  });
  describe("convention status change actions", () => {
    beforeEach(() => {
      ({ store, dependencies } = createTestStore({
        convention: {
          ...initialConventionState,
          convention,
        },
      }));
    });

    describe("cancelConvention", () => {
      it("cancels convention successfully", () => {
        expectInitialConventionActionAndFeedbackState();
        expectConventionState({
          isLoading: false,
          convention,
        });
        store.dispatch(
          conventionActionSlice.actions.cancelConventionRequested({
            updateStatusParams: {
              conventionId: "fake-convention-id",
              status: "CANCELLED",
              statusJustification: "fake-justification",
            },
            jwt: "fake-jwt",
            feedbackTopic: "convention-action-cancel",
          }),
        );
        expectConventionActionState({
          isLoading: true,
        });
        feedGatewayUpdateConventionStatusSuccess();

        expectConventionActionState({
          isLoading: false,
        });

        expectToEqual(
          feedbacksSelectors.feedbacks(store.getState())[
            "convention-action-cancel"
          ],
          {
            level: "success",
            message: "La convention a bien été annulée",
            on: "update",
            title: "La convention a bien été annulée",
          },
        );
        const conventionwithStatusChanged: ConventionReadDto = {
          ...agencyFields,
          ...new ConventionDtoBuilder(convention)
            .withStatus("CANCELLED")
            .build(),
          assessment: null,
          lastReminders: makeEmptyLastReminders(),
          isEstablishmentBanned: false,
        };

        feedGatewayWithConvention(conventionwithStatusChanged);

        expectConventionState({
          isLoading: false,
          convention: conventionwithStatusChanged,
        });
      });

      it("gets error message when cancelling convention fails", () => {
        expectInitialConventionActionAndFeedbackState();
        expectConventionState({
          isLoading: false,
          convention,
        });
        store.dispatch(
          conventionActionSlice.actions.cancelConventionRequested({
            updateStatusParams: {
              conventionId: "fake-convention-id",
              status: "CANCELLED",
              statusJustification: "fake-justification",
            },
            jwt: "fake-jwt",
            feedbackTopic: "convention-action-cancel",
          }),
        );
        expectConventionActionState({
          isLoading: true,
        });
        const errorMessage =
          "Une erreur est survenue lors de l'annulation de la convention.";
        feedGatewayWithUpdateConventionStatusFailure(new Error(errorMessage));
        expectConventionActionState({
          isLoading: false,
        });

        expectToEqual(
          feedbacksSelectors.feedbacks(store.getState())[
            "convention-action-cancel"
          ],
          {
            level: "error",
            message: errorMessage,
            on: "update",
            title: "Problème lors de l'annulation de la convention",
          },
        );

        expectConventionState({
          isLoading: false,
          convention,
        });
      });
    });

    describe("deprecateConvention", () => {
      it("deprecates convention successfully", () => {
        expectInitialConventionActionAndFeedbackState();
        expectConventionState({
          isLoading: false,
          convention,
        });
        store.dispatch(
          conventionActionSlice.actions.deprecateConventionRequested({
            updateStatusParams: {
              conventionId: "fake-convention-id",
              status: "DEPRECATED",
              statusJustification: "fake-justification",
            },
            jwt: "fake-jwt",
            feedbackTopic: "convention-action-deprecate",
          }),
        );
        expectConventionActionState({
          isLoading: true,
        });
        feedGatewayUpdateConventionStatusSuccess();

        expectConventionActionState({
          isLoading: false,
        });

        expectToEqual(
          feedbacksSelectors.feedbacks(store.getState())[
            "convention-action-deprecate"
          ],
          {
            level: "success",
            message:
              "La confirmation de cette suppression va être communiquée par mail à chacun des signataires.",
            on: "update",
            title: "La convention a bien été supprimée",
          },
        );
        const conventionwithStatusChanged: ConventionReadDto = {
          ...agencyFields,
          ...new ConventionDtoBuilder(convention)
            .withStatus("DEPRECATED")
            .build(),
          assessment: null,
          lastReminders: makeEmptyLastReminders(),
          isEstablishmentBanned: false,
        };

        feedGatewayWithConvention(conventionwithStatusChanged);

        expectConventionState({
          isLoading: false,
          convention: conventionwithStatusChanged,
        });
      });

      it("gets error message when deprecating convention fails", () => {
        expectInitialConventionActionAndFeedbackState();
        expectConventionState({
          isLoading: false,
          convention,
        });
        store.dispatch(
          conventionActionSlice.actions.deprecateConventionRequested({
            updateStatusParams: {
              conventionId: "fake-convention-id",
              status: "DEPRECATED",
              statusJustification: "fake-justification",
            },
            jwt: "fake-jwt",
            feedbackTopic: "convention-action-deprecate",
          }),
        );
        expectConventionActionState({
          isLoading: true,
        });
        const errorMessage =
          "Une erreur est survenue pour marquer la convention comme obsolète.";
        feedGatewayWithUpdateConventionStatusFailure(new Error(errorMessage));
        expectConventionActionState({
          isLoading: false,
        });

        expectToEqual(
          feedbacksSelectors.feedbacks(store.getState())[
            "convention-action-deprecate"
          ],
          {
            level: "error",
            message: errorMessage,
            on: "update",
            title: "Problème lors de la suppression de la convention",
          },
        );
        expectConventionState({
          isLoading: false,
          convention,
        });
      });
    });

    describe("rejectConvention", () => {
      it("rejects convention successfully", () => {
        expectInitialConventionActionAndFeedbackState();
        expectConventionState({
          isLoading: false,
          convention,
        });
        store.dispatch(
          conventionActionSlice.actions.rejectConventionRequested({
            updateStatusParams: {
              conventionId: "fake-convention-id",
              status: "REJECTED",
              statusJustification: "fake-justification",
            },
            jwt: "fake-jwt",
            feedbackTopic: "convention-action-reject",
          }),
        );
        expectConventionActionState({
          isLoading: true,
        });
        feedGatewayUpdateConventionStatusSuccess();

        expectConventionActionState({
          isLoading: false,
        });

        expectToEqual(
          feedbacksSelectors.feedbacks(store.getState())[
            "convention-action-reject"
          ],
          {
            level: "success",
            message:
              "La décision de refuser cette immersion est bien enregistrée. Cette décision va être communiquée par mail au bénéficiaire et à l'entreprise.",
            on: "update",
            title: "La convention a bien été refusée",
          },
        );
        const conventionwithStatusChanged: ConventionReadDto = {
          ...agencyFields,
          ...new ConventionDtoBuilder(convention)
            .withStatus("REJECTED")
            .build(),
          assessment: null,
          lastReminders: makeEmptyLastReminders(),
          isEstablishmentBanned: false,
        };
        feedGatewayWithConvention(conventionwithStatusChanged);

        expectConventionState({
          isLoading: false,
          convention: conventionwithStatusChanged,
        });
      });

      it("gets error message when rejecting convention fails", () => {
        expectInitialConventionActionAndFeedbackState();
        expectConventionState({
          isLoading: false,
          convention,
        });
        store.dispatch(
          conventionActionSlice.actions.rejectConventionRequested({
            updateStatusParams: {
              conventionId: "fake-convention-id",
              status: "REJECTED",
              statusJustification: "fake-justification",
            },
            jwt: "fake-jwt",
            feedbackTopic: "convention-action-reject",
          }),
        );
        expectConventionActionState({
          isLoading: true,
        });
        const errorMessage =
          "Une erreur est survenue lors du rejet de la convention.";
        feedGatewayWithUpdateConventionStatusFailure(new Error(errorMessage));
        expectConventionActionState({
          isLoading: false,
        });

        expectToEqual(
          feedbacksSelectors.feedbacks(store.getState())[
            "convention-action-reject"
          ],
          {
            level: "error",
            message: errorMessage,
            on: "update",
            title: "Problème lors du refus de la convention",
          },
        );
        expectConventionState({
          isLoading: false,
          convention,
        });
      });
    });

    describe("acceptByValidator", () => {
      it("accepts convention by validator successfully", () => {
        expectInitialConventionActionAndFeedbackState();
        expectConventionState({
          isLoading: false,
          convention,
        });
        store.dispatch(
          conventionActionSlice.actions.acceptByValidatorRequested({
            updateStatusParams: {
              conventionId: "fake-convention-id",
              status: "ACCEPTED_BY_VALIDATOR",
              firstname: "jean",
              lastname: "pierre",
            },
            jwt: "fake-jwt",
            feedbackTopic: "convention-action-accept-by-validator",
          }),
        );
        expectConventionActionState({
          isLoading: true,
        });
        feedGatewayUpdateConventionStatusSuccess();

        expectConventionActionState({
          isLoading: false,
        });

        expectToEqual(
          feedbacksSelectors.feedbacks(store.getState())[
            "convention-action-accept-by-validator"
          ],
          {
            level: "success",
            message:
              "La validation de cette demande est bien enregistrée. La confirmation de cette validation va être communiquée par mail à chacun des signataires.",
            on: "update",
            title: "La convention a bien été validée",
          },
        );
        const conventionwithStatusChanged: ConventionReadDto = {
          ...agencyFields,
          ...new ConventionDtoBuilder(convention)
            .withStatus("ACCEPTED_BY_VALIDATOR")
            .build(),
          assessment: null,
          lastReminders: makeEmptyLastReminders(),
          isEstablishmentBanned: false,
        };
        feedGatewayWithConvention(conventionwithStatusChanged);

        expectConventionState({
          isLoading: false,
          convention: conventionwithStatusChanged,
        });
      });

      it("gets error message when accepting convention by validator fails", () => {
        expectInitialConventionActionAndFeedbackState();
        expectConventionState({
          isLoading: false,
          convention,
        });
        store.dispatch(
          conventionActionSlice.actions.acceptByValidatorRequested({
            updateStatusParams: {
              conventionId: "fake-convention-id",
              status: "ACCEPTED_BY_VALIDATOR",
              firstname: "jean",
              lastname: "pierre",
            },
            jwt: "fake-jwt",
            feedbackTopic: "convention-action-accept-by-validator",
          }),
        );
        expectConventionActionState({
          isLoading: true,
        });
        const errorMessage =
          "Une erreur est survenue lors de la validation de la convention.";
        feedGatewayWithUpdateConventionStatusFailure(new Error(errorMessage));
        expectConventionActionState({
          isLoading: false,
        });

        expectToEqual(
          feedbacksSelectors.feedbacks(store.getState())[
            "convention-action-accept-by-validator"
          ],
          {
            level: "error",
            message: errorMessage,
            on: "update",
            title: "Problème lors de la validation de la convention",
          },
        );
        expectConventionState({
          isLoading: false,
          convention,
        });
      });
    });

    describe("acceptByCounsellor", () => {
      it("accepts convention by counsellor successfully", () => {
        expectInitialConventionActionAndFeedbackState();
        expectConventionState({
          isLoading: false,
          convention,
        });
        store.dispatch(
          conventionActionSlice.actions.acceptByCounsellorRequested({
            updateStatusParams: {
              conventionId: "fake-convention-id",
              status: "ACCEPTED_BY_COUNSELLOR",
              firstname: "jean",
              lastname: "pierre",
            },
            jwt: "fake-jwt",
            feedbackTopic: "convention-action-accept-by-counsellor",
          }),
        );
        expectConventionActionState({
          isLoading: true,
        });
        feedGatewayUpdateConventionStatusSuccess();

        expectConventionActionState({
          isLoading: false,
        });

        expectToEqual(
          feedbacksSelectors.feedbacks(store.getState())[
            "convention-action-accept-by-counsellor"
          ],
          {
            level: "success",
            message:
              "Une notification est envoyée au responsable des validations pour qu'elle/il confirme ou non la validation de cette demande et initie la convention.",
            on: "update",
            title: "La convention a bien été marquée comme éligible",
          },
        );
        const conventionwithStatusChanged: ConventionReadDto = {
          ...agencyFields,
          ...new ConventionDtoBuilder(convention)
            .withStatus("ACCEPTED_BY_COUNSELLOR")
            .build(),
          assessment: null,
          lastReminders: makeEmptyLastReminders(),
          isEstablishmentBanned: false,
        };
        feedGatewayWithConvention(conventionwithStatusChanged);

        expectConventionState({
          isLoading: false,
          convention: conventionwithStatusChanged,
        });
      });

      it("gets error message when accepting convention by counsellor fails", () => {
        expectInitialConventionActionAndFeedbackState();
        expectConventionState({
          isLoading: false,
          convention,
        });
        store.dispatch(
          conventionActionSlice.actions.acceptByCounsellorRequested({
            updateStatusParams: {
              conventionId: "fake-convention-id",
              status: "ACCEPTED_BY_COUNSELLOR",
              firstname: "jean",
              lastname: "pierre",
            },
            jwt: "fake-jwt",
            feedbackTopic: "convention-action-accept-by-counsellor",
          }),
        );
        expectConventionActionState({
          isLoading: true,
        });
        const errorMessage =
          "Une erreur est survenue lors de la validation de la convention.";
        feedGatewayWithUpdateConventionStatusFailure(new Error(errorMessage));
        expectConventionActionState({
          isLoading: false,
        });

        expectToEqual(
          feedbacksSelectors.feedbacks(store.getState())[
            "convention-action-accept-by-counsellor"
          ],
          {
            level: "error",
            message: errorMessage,
            on: "update",
            title: "Problème lors de la pré-validation de la convention",
          },
        );
        expectConventionState({
          isLoading: false,
          convention,
        });
      });
    });
  });
  describe("transferConventionToAgency", () => {
    beforeEach(() => {
      ({ store, dependencies } = createTestStore({
        convention: {
          ...initialConventionState,
          convention,
        },
      }));
    });
    it("transfers convention to agency", () => {
      expectInitialConventionActionAndFeedbackState();
      expectConventionState({
        isLoading: false,
        convention,
      });
      store.dispatch(
        conventionActionSlice.actions.transferConventionToAgencyRequested({
          transferConventionToAgencyParams: {
            conventionId: "fake-convention-id",
            agencyId: "agency-transferred-id",
            justification: "fake-justification",
          },
          jwt: "fake-jwt",
          feedbackTopic: "transfer-convention-to-agency",
        }),
      );
      expectConventionActionState({
        isLoading: true,
      });

      feedGatewayTransferConventionToAgencySuccess();

      expectConventionActionState({
        isLoading: false,
      });

      expectToEqual(
        feedbacksSelectors.feedbacks(store.getState())[
          "transfer-convention-to-agency"
        ],
        {
          level: "success",
          message: "La convention a bien été transférée au nouvel organisme",
          on: "update",
          title: "La convention a bien été transférée",
        },
      );
      const conventionWithAgencyChanged: ConventionReadDto = {
        agencyName: "agency-transferred-name",
        agencyContactEmail: "contact@mail.com",
        agencyDepartment: "87",
        agencyKind: "france-travail",
        agencyRefersTo: undefined,
        agencySiret: "22220000111155",
        agencyValidationSteps: "validator-only",
        ...new ConventionDtoBuilder(convention)
          .withAgencyId("agency-transferred-id")
          .build(),
        assessment: null,
        lastReminders: makeEmptyLastReminders(),
        isEstablishmentBanned: false,
      };
      feedGatewayWithConvention(conventionWithAgencyChanged);

      expectConventionState({
        isLoading: false,
        convention: conventionWithAgencyChanged,
      });
    });

    it("gets error message when transferring convention to agency fails", () => {
      expectInitialConventionActionAndFeedbackState();
      expectConventionState({
        isLoading: false,
        convention,
      });
      store.dispatch(
        conventionActionSlice.actions.transferConventionToAgencyRequested({
          transferConventionToAgencyParams: {
            conventionId: "fake-covention-id",
            agencyId: "fake-agency-id",
            justification: "fake-justification",
          },
          jwt: "fake-jwt",
          feedbackTopic: "transfer-convention-to-agency",
        }),
      );
      expectConventionActionState({
        isLoading: true,
      });
      const errorMessage =
        "Une erreur est survenue lors du transfert de la convention.";
      feedGatewayWithTransferConventionToAgencyFailure(new Error(errorMessage));
      expectConventionActionState({
        isLoading: false,
      });

      expectToEqual(
        feedbacksSelectors.feedbacks(store.getState())[
          "transfer-convention-to-agency"
        ],
        {
          level: "error",
          message: errorMessage,
          on: "update",
          title: "Problème lors du transfert de la convention",
        },
      );
      expectConventionState({
        isLoading: false,
        convention,
      });
    });
  });

  describe("editCounsellorName", () => {
    beforeEach(() => {
      ({ store, dependencies } = createTestStore({
        convention: {
          ...initialConventionState,
          convention,
        },
      }));
    });
    it("edit counsellor name", () => {
      expectInitialConventionActionAndFeedbackState();
      expectConventionState({
        isLoading: false,
        convention,
      });
      store.dispatch(
        conventionActionSlice.actions.editCounsellorNameRequested({
          editCounsellorNameParams: {
            conventionId: "fake-convention-id",
            firstname: "jean",
            lastname: "pierre",
          },
          jwt: "fake-jwt",
          feedbackTopic: "convention-action-edit-counsellor-name",
        }),
      );
      expectConventionActionState({
        isLoading: true,
      });

      feedGatewayWithEditCounsellorNameSuccess();

      expectConventionActionState({
        isLoading: false,
      });

      expectToEqual(
        feedbacksSelectors.feedbacks(store.getState())[
          "convention-action-edit-counsellor-name"
        ],
        {
          level: "success",
          message: "Le nom du conseiller a bien été modifié",
          on: "update",
          title: "Le nom du conseiller a bien été modifié",
        },
      );
      const conventionWithCounsellorNameChanged: ConventionReadDto = {
        ...agencyFields,
        ...new ConventionDtoBuilder(convention)
          .withAgencyReferent({ firstname: "jean", lastname: "pierre" })
          .build(),
        assessment: null,
        lastReminders: makeEmptyLastReminders(),
        isEstablishmentBanned: false,
      };

      feedGatewayWithConvention(conventionWithCounsellorNameChanged);

      expectConventionState({
        isLoading: false,
        convention: conventionWithCounsellorNameChanged,
      });
    });

    it("gets error message when editing counsellor name fails", () => {
      expectInitialConventionActionAndFeedbackState();
      expectConventionState({
        isLoading: false,
        convention,
      });
      store.dispatch(
        conventionActionSlice.actions.editCounsellorNameRequested({
          editCounsellorNameParams: {
            conventionId: "fake-convention-id",
            firstname: "jean",
            lastname: "pierre",
          },
          jwt: "fake-jwt",
          feedbackTopic: "convention-action-edit-counsellor-name",
        }),
      );
      expectConventionActionState({
        isLoading: true,
      });
      const errorMessage =
        "Une erreur est survenue lors de la modification du nom du conseiller.";
      feedGatewayWithEditCounsellorNameFailure(new Error(errorMessage));

      expectConventionActionState({
        isLoading: false,
      });

      expectToEqual(
        feedbacksSelectors.feedbacks(store.getState())[
          "convention-action-edit-counsellor-name"
        ],
        {
          level: "error",
          message: errorMessage,
          on: "update",
          title: "Problème lors de la modification du nom du conseiller",
        },
      );
      expectConventionState({
        isLoading: false,
        convention,
      });
    });
  });

  describe("Broadcast convention to partner", () => {
    it("successfully trigger the broadcast, than needs to wait for a delay before broadcast is considered successfull", () => {
      expectInitialConventionActionAndFeedbackState();
      store.dispatch(
        conventionActionSlice.actions.broadcastConventionToPartnerRequested({
          conventionId: "aaaaac99-9c0b-1aaa-aa6d-6bb9bd38aaaa",
          feedbackTopic: "broadcast-convention-again",
        }),
      );
      expectConventionActionState({
        isBroadcasting: true,
      });

      dependencies.conventionGateway.broadcastConventionAgainResult$.next(
        undefined,
      );

      expectConventionActionState({
        isBroadcasting: true,
      });

      fastForwardObservables();

      expectConventionActionState({
        isBroadcasting: false,
      });

      expectToEqual(feedbacksSelectors.feedbacks(store.getState()), {
        "broadcast-convention-again": {
          on: "create",
          level: "success",
          title: "La convention a bien été rediffusée",
          message:
            "La convention a bien été rediffusée au partenaire. Vous pouvez vous rapprocher du partenaire pour le vérifier.",
        },
      });
    });

    it("fails when triggering the broadcast", () => {
      expectInitialConventionActionAndFeedbackState();
      const errorMessageFromApi = "error occurred from api";
      store.dispatch(
        conventionActionSlice.actions.broadcastConventionToPartnerRequested({
          conventionId: "aaaaac99-9c0b-1aaa-aa6d-6bb9bd38aaaa",
          feedbackTopic: "broadcast-convention-again",
        }),
      );
      expectConventionActionState({
        isBroadcasting: true,
      });

      dependencies.conventionGateway.broadcastConventionAgainResult$.error(
        new Error(errorMessageFromApi),
      );

      expectConventionActionState({
        isBroadcasting: false,
      });
      expectToEqual(feedbacksSelectors.feedbacks(store.getState()), {
        "broadcast-convention-again": {
          on: "create",
          level: "error",
          title: "Problème rencontré lors de la rediffusion au partenaire",
          message: errorMessageFromApi,
        },
      });
    });
  });

  describe("Convention renewal", () => {
    const renewedDateEnd = addDays(new Date(), 1);
    const renewedDateStart = new Date();
    const renewedConventionPayload: RenewConventionPayload = {
      params: {
        id: "22222222-1111-4111-1111-111111111111",
        dateEnd: renewedDateEnd.toISOString(),
        dateStart: renewedDateStart.toISOString(),
        schedule: new ScheduleDtoBuilder()
          .withReasonableScheduleInInterval({
            start: renewedDateStart,
            end: renewedDateEnd,
          })
          .build(),
        renewed: {
          from: "11111111-1111-4111-1111-111111111111",
          justification: "My justification to renew this convention",
        },
      },
      jwt: "my-jwt",
    };

    it("renews a convention", () => {
      expectInitialConventionActionAndFeedbackState();

      store.dispatch(
        conventionActionSlice.actions.renewConventionRequested({
          ...renewedConventionPayload,
          feedbackTopic: "convention-action-renew",
        }),
      );
      expectConventionActionState({
        isLoading: true,
      });
      feedGatewayWithRenewedConventionSuccess();
      expectConventionActionState({
        isLoading: false,
      });
      expectFeedbackState({
        "convention-action-renew": {
          on: "update",
          level: "success",
          title: "La demande de renouvellement est bien enregistrée.",
          message:
            "Elle vient d'être envoyée à toutes les parties pour signature avant votre validation définitive.",
        },
      });
    });

    it("gets error feedback when gateway throws an error", () => {
      const errorMessage = "Error renewing convention";
      expectInitialConventionActionAndFeedbackState();
      store.dispatch(
        conventionActionSlice.actions.renewConventionRequested({
          ...renewedConventionPayload,
          feedbackTopic: "convention-action-renew",
        }),
      );
      expectConventionActionState({
        isLoading: true,
      });
      feedGatewayWithRenewedConventionError(new Error(errorMessage));
      expectConventionActionState({
        isLoading: false,
      });
      expectFeedbackState({
        "convention-action-renew": {
          on: "update",
          level: "error",
          title: "Problème lors du renouvellement de la convention",
          message: errorMessage,
        },
      });
    });
  });

  describe("Convention signature", () => {
    beforeEach(() => {
      ({ store, dependencies } = createTestStore({
        convention: {
          ...initialConventionState,
          convention,
        },
      }));
    });

    it("signs the conventions with role from jwt", () => {
      expectInitialConventionActionAndFeedbackState();
      expectConventionState({
        isLoading: false,
        convention,
      });

      store.dispatch(
        conventionActionSlice.actions.signConventionRequested({
          conventionId: convention.id,
          jwt: "fake-jwt",
          feedbackTopic: "convention-action-sign",
        }),
      );

      expectConventionActionState({
        isLoading: true,
      });
      feedGatewayWithSignSuccess();
      expectConventionActionState({
        isLoading: false,
      });

      expectToEqual(feedbacksSelectors.feedbacks(store.getState()), {
        "convention-action-sign": {
          on: "update",
          level: "success",
          title: "La convention a bien été signée",
          message: "La convention a bien été signée",
        },
      });

      const signedConvention: ConventionReadDto = {
        ...agencyFields,
        ...new ConventionDtoBuilder(convention)
          .signedByEstablishmentRepresentative(new Date().toISOString())
          .build(),
        assessment: null,
        lastReminders: makeEmptyLastReminders(),
        isEstablishmentBanned: false,
      };

      feedGatewayWithConvention(signedConvention);

      expectConventionState({
        isLoading: false,
        convention: signedConvention,
      });
    });

    it("gets error message when signature fails", () => {
      expectInitialConventionActionAndFeedbackState();
      expectConventionState({
        isLoading: false,
        convention,
      });

      store.dispatch(
        conventionActionSlice.actions.signConventionRequested({
          conventionId: "id",
          jwt: "fake-jwt",
          feedbackTopic: "convention-action-sign",
        }),
      );
      expectConventionActionState({
        isLoading: true,
      });
      const errorMessage = "You are not allowed to sign";
      feedGatewayWithSignError(new Error(errorMessage));
      expectConventionActionState({
        isLoading: false,
      });

      expectToEqual(feedbacksSelectors.feedbacks(store.getState()), {
        "convention-action-sign": {
          on: "update",
          level: "error",
          title: "Problème lors de la signature de la convention",
          message: errorMessage,
        },
      });

      expectConventionState({
        isLoading: false,
        convention,
      });
    });
  });

  const expectInitialConventionActionAndFeedbackState = () => {
    expectConventionActionState({
      isLoading: false,
    });
    expectFeedbackState({});
  };

  const expectFeedbackState = (feedbackState: Partial<Feedbacks>) => {
    expectObjectsToMatch(store.getState().feedbacks, feedbackState);
  };

  const expectConventionActionState = (
    conventionActionState: Partial<ConventionActionState>,
  ) => {
    expectObjectsToMatch(
      store.getState().conventionAction,
      conventionActionState,
    );
  };

  const feedGatewayTransferConventionToAgencySuccess = () => {
    dependencies.conventionGateway.transferConventionToAgencyResult$.next(
      undefined,
    );
  };

  const feedGatewayWithTransferConventionToAgencyFailure = (error: Error) => {
    dependencies.conventionGateway.transferConventionToAgencyResult$.error(
      error,
    );
  };

  const feedGatewayWithEditCounsellorNameSuccess = () => {
    dependencies.conventionGateway.editConventionCounsellorNameResult$.next(
      undefined,
    );
  };

  const feedGatewayWithEditCounsellorNameFailure = (error: Error) => {
    dependencies.conventionGateway.editConventionCounsellorNameResult$.error(
      error,
    );
  };

  const feedGatewayUpdateConventionStatusSuccess = () => {
    dependencies.conventionGateway.conventionModificationResult$.next(
      undefined,
    );
  };

  const feedGatewayWithUpdateConventionStatusFailure = (error: Error) => {
    dependencies.conventionGateway.conventionModificationResult$.error(error);
  };

  const fastForwardObservables = () => dependencies.scheduler.flush();

  const expectConventionState = (conventionState: Partial<ConventionState>) => {
    expectObjectsToMatch(store.getState().convention, conventionState);
  };

  const feedGatewayWithConvention = (convention: ConventionReadDto) => {
    dependencies.conventionGateway.convention$.next(convention);
  };

  const feedGatewayWithSignSuccess = () => {
    dependencies.conventionGateway.conventionSignedResult$.next(undefined);
  };

  const feedGatewayWithSignError = (error: Error) => {
    dependencies.conventionGateway.conventionSignedResult$.error(error);
  };

  const feedGatewayWithRenewedConventionSuccess = () => {
    dependencies.conventionGateway.conventionRenewalResult$.next(undefined);
  };

  const feedGatewayWithRenewedConventionError = (error: Error) => {
    dependencies.conventionGateway.conventionRenewalResult$.error(error);
  };
});
