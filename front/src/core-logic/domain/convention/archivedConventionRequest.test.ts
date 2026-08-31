import {
  type ArchivedConventionRequestToReviewListDto,
  expectObjectsToMatch,
  expectToEqual,
} from "shared";
import { feedbacksSelectors } from "src/core-logic/domain/feedback/feedback.selectors";
import {
  createTestStore,
  type TestDependencies,
} from "src/core-logic/storeConfig/createTestStore";
import type { ReduxStore } from "src/core-logic/storeConfig/store";
import { v4 as uuid } from "uuid";
import type { FeedbackTopic } from "../feedback/feedback.content";
import { type Feedback, feedbackSlice } from "../feedback/feedback.slice";
import {
  type ArchivedConventionRequestState,
  archivedConventionRequestSlice,
  initialArchivedConventionRequestState,
} from "./archivedConventionRequest.slice";

describe("archived convention request slice", () => {
  let store: ReduxStore;
  let dependencies: TestDependencies;

  beforeEach(() => {
    ({ store, dependencies } = createTestStore());
  });

  describe.skip("save archived convention request", () => {
    it("TODO", () => {
      expect(true).toBeFalsy();
    });
  });

  describe("fetch archived convention request list to convention", () => {
    const feedbackTopic: FeedbackTopic = "archived-convention-request-list";

    it("on success and cleared", () => {
      expectArchivedConventionRequestState(
        initialArchivedConventionRequestState,
      );

      store.dispatch(
        archivedConventionRequestSlice.actions.fetchArchivedConventionRequestToReviewListRequested(
          {
            jwt: "",
            feedbackTopic,
          },
        ),
      );

      expectArchivedConventionRequestState({
        isLoading: true,
        archivedConventionListToReview: null,
      });

      const results: ArchivedConventionRequestToReviewListDto = [
        {
          id: uuid(),
          reason: "rpeAdvisorAccessToBeneficiaryHistory",
          createdAt: new Date().toISOString(),
          conventionSearchMethod: "withConventionId",
          conventionId: uuid(),
          requester: {
            firstname: "Moaning",
            lastname: "Malone",
            email: "uwu@mail.com",
          },
        },
        {
          id: uuid(),
          reason: "legalDispute",
          createdAt: new Date().toISOString(),
          conventionSearchMethod: "withConventionId",
          conventionId: uuid(),
          requester: {
            firstname: "Bubba",
            lastname: "Mudpuddle",
            email: "bm@cars.com",
          },
        },
        {
          id: uuid(),
          reason: "other",
          otherReason: "Motif personnalisé pour la demande",
          createdAt: new Date().toISOString(),
          conventionSearchMethod: "withConventionDetails",
          beneficiaryFirstName: "Marie",
          beneficiaryLastName: "Curie",
          siret: "12345678901234",
          immersionDate: "2024-01-15",
          requester: {
            firstname: "Lou",
            lastname: "Natic",
            email: "ln@depression.com",
          },
        },
        {
          id: uuid(),
          reason: "urssafOrInspectionControl",
          createdAt: new Date().toISOString(),
          conventionSearchMethod: "withConventionId",
          conventionId: uuid(),
          requester: {
            firstname: "Blaze",
            lastname: "Thunderfist",
            email: "blaze.t@mail.com",
          },
        },
      ];

      feedGatewayWithArchivedConventionRequestToReviewListDto(results);

      expectArchivedConventionRequestState({
        isLoading: false,
        archivedConventionListToReview: results,
      });

      expectToEqual(
        feedbacksSelectors.feedbacks(store.getState())[feedbackTopic],
        undefined,
      );

      store.dispatch(
        archivedConventionRequestSlice.actions.fetchArchivedConventionListToReviewCleared(),
      );

      store.dispatch(feedbackSlice.actions.clearFeedbacksTriggered());

      expectArchivedConventionRequestState(
        initialArchivedConventionRequestState,
      );

      expectToEqual(
        feedbacksSelectors.feedbacks(store.getState())[feedbackTopic],
        undefined,
      );
    });

    it("on failed and cleared", () => {
      store.dispatch(
        archivedConventionRequestSlice.actions.fetchArchivedConventionRequestToReviewListRequested(
          {
            jwt: "",
            feedbackTopic,
          },
        ),
      );

      expectArchivedConventionRequestState({
        isLoading: true,
        archivedConventionListToReview: null,
      });

      const error = new Error("Coco veut un gateau !");

      feedGatewayWithArchivedConventionRequestToReviewListDto(error);

      expectArchivedConventionRequestState({
        isLoading: false,
        archivedConventionListToReview: [],
      });

      expectFeedbackTopic(feedbackTopic, {
        level: "error",
        on: "fetch",
        title:
          "Une erreur s'est produite lors de la récupération des demandes de désarchivage.",
        message: error.message,
      });

      store.dispatch(
        archivedConventionRequestSlice.actions.fetchArchivedConventionRequestToReviewListRequested(
          {
            jwt: "",
            feedbackTopic,
          },
        ),
      );

      expectArchivedConventionRequestState({
        isLoading: false,
        archivedConventionListToReview: [],
      });

      expectFeedbackTopic(feedbackTopic, {
        level: "error",
        on: "fetch",
        title:
          "Une erreur s'est produite lors de la récupération des demandes de désarchivage.",
        message: error.message,
      });

      store.dispatch(
        archivedConventionRequestSlice.actions.fetchArchivedConventionListToReviewCleared(),
      );

      store.dispatch(feedbackSlice.actions.clearFeedbacksTriggered());

      expectArchivedConventionRequestState(
        initialArchivedConventionRequestState,
      );

      expectToEqual(
        feedbacksSelectors.feedbacks(store.getState())[feedbackTopic],
        undefined,
      );
    });
  });

  const expectArchivedConventionRequestState = (
    expectedState: Partial<ArchivedConventionRequestState>,
  ) =>
    expectObjectsToMatch(
      store.getState().archivedConventionRequest,
      expectedState,
    );

  const feedGatewayWithArchivedConventionRequestToReviewListDto = (
    nextResult: ArchivedConventionRequestToReviewListDto | Error,
  ) =>
    nextResult instanceof Error
      ? dependencies.conventionGateway.fetchArchivedConventionRequestToReviewListResult$.error(
          nextResult,
        )
      : dependencies.conventionGateway.fetchArchivedConventionRequestToReviewListResult$.next(
          nextResult,
        );

  const expectFeedbackTopic = (
    feedbackTopic: FeedbackTopic,
    expectedResult: Feedback | undefined,
  ) =>
    expectToEqual(
      feedbacksSelectors.feedbacks(store.getState())[feedbackTopic],
      expectedResult,
    );
});
