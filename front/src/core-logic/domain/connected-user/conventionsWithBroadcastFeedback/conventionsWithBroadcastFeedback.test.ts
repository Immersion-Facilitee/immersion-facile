import { expectToEqual, type Pagination } from "shared";
import { conventionsWithBroadcastFeedbackSelectors } from "src/core-logic/domain/connected-user/conventionsWithBroadcastFeedback/conventionsWithBroadcastFeedback.selectors";
import { conventionsWithBroadcastFeedbackSlice } from "src/core-logic/domain/connected-user/conventionsWithBroadcastFeedback/conventionsWithBroadcastFeedback.slice";
import { feedbacksSelectors } from "src/core-logic/domain/feedback/feedback.selectors";
import {
  createTestStore,
  type TestDependencies,
} from "src/core-logic/storeConfig/createTestStore";
import type { ReduxStore } from "src/core-logic/storeConfig/store";
import type { ConventionWithBroadcastFeedbackReadDto } from "../../../../../../shared/src/convention/conventionWithBroadcastFeedback.dto";

describe("ConnectedUserConventionsWithBroadcastFeedback", () => {
  let store: ReduxStore;
  let dependencies: TestDependencies;

  beforeEach(() => {
    ({ store, dependencies } = createTestStore());
  });

  it("get the conventions with errored broadcast feedback", () => {
    const pagination: Pagination = {
      totalRecords: 1,
      currentPage: 1,
      totalPages: 1,
      numberPerPage: 10,
    };
    const conventionsWithBroadcastFeedback: ConventionWithBroadcastFeedbackReadDto[] =
      [
        {
          id: "1",
          status: "IN_REVIEW",
          beneficiary: {
            firstname: "John",
            lastname: "Doe",
          },
          lastBroadcastFeedback: {
            serviceName: "any-service-name",
            consumerId: null,
            consumerName: "any-consumer-name",
            conventionId: "1",
            agencyId: "any-agency-id",
            occurredAt: "2024-07-01T00:00:00.000Z",
            handledByAgency: true,
            requestParams: {
              conventionId: "1",
            },
          },
          agencyReferent: null,
          agencyId: "any-agency-id",
          agencyName: "Agence de test",
        },
      ];
    expectToEqual(
      conventionsWithBroadcastFeedbackSelectors.isLoading(store.getState()),
      false,
    );

    store.dispatch(
      conventionsWithBroadcastFeedbackSlice.actions.getConventionsWithErroredBroadcastFeedbackRequested(
        {
          filters: {
            page: 1,
            perPage: 10,
            search: "any-search",
            broadcastErrorKind: "functional",
            conventionStatus: ["IN_REVIEW"],
          },
          jwt: "my-jwt",
          feedbackTopic: "conventions-with-broadcast-feedback",
        },
      ),
    );

    expectToEqual(
      conventionsWithBroadcastFeedbackSelectors.isLoading(store.getState()),
      true,
    );
    dependencies.conventionGateway.getConventionsWithErroredBroadcastFeedbackResult$.next(
      {
        data: conventionsWithBroadcastFeedback,
        pagination,
      },
    );
    const erroredBroadcastConventionsWithPagination =
      getErroredBroadcastConventionsWithPagination();
    expectToEqual(
      erroredBroadcastConventionsWithPagination.pagination,
      pagination,
    );
    expectToEqual(
      erroredBroadcastConventionsWithPagination.data,
      conventionsWithBroadcastFeedback,
    );
    expectToEqual(erroredBroadcastConventionsWithPagination.filters, {
      page: 1,
      perPage: 10,
      search: "any-search",
      broadcastErrorKind: "functional",
      conventionStatus: ["IN_REVIEW"],
    });
  });

  it("get the conventions with errored broadcast feedback failed", () => {
    expectToEqual(
      conventionsWithBroadcastFeedbackSelectors.isLoading(store.getState()),
      false,
    );

    store.dispatch(
      conventionsWithBroadcastFeedbackSlice.actions.getConventionsWithErroredBroadcastFeedbackRequested(
        {
          feedbackTopic: "conventions-with-broadcast-feedback",
          filters: {
            page: 1,
            perPage: 10,
            search: "any-search",
            broadcastErrorKind: "functional",
            conventionStatus: ["IN_REVIEW"],
          },
          jwt: "my-jwt",
        },
      ),
    );

    expectToEqual(
      conventionsWithBroadcastFeedbackSelectors.isLoading(store.getState()),
      true,
    );

    dependencies.conventionGateway.getConventionsWithErroredBroadcastFeedbackResult$.error(
      new Error("any-error-message"),
    );

    expectToEqual(
      conventionsWithBroadcastFeedbackSelectors.isLoading(store.getState()),
      false,
    );
    expectToEqual(feedbacksSelectors.feedbacks(store.getState()), {
      "conventions-with-broadcast-feedback": {
        on: "fetch",
        level: "error",
        title:
          "Problème lors de la récupération de vos conventions qui ont eu des erreurs de diffusion",
        message: "any-error-message",
      },
    });
  });

  it("should clear filters when clearConventionsWithBroadcastFeedbackFilters is dispatched", () => {
    const pagination: Pagination = {
      totalRecords: 1,
      currentPage: 1,
      totalPages: 1,
      numberPerPage: 10,
    };
    const conventionsWithBroadcastFeedback: ConventionWithBroadcastFeedbackReadDto[] =
      [
        {
          id: "1",
          status: "IN_REVIEW",
          beneficiary: {
            firstname: "John",
            lastname: "Doe",
          },
          lastBroadcastFeedback: {
            serviceName: "any-service-name",
            consumerId: null,
            consumerName: "any-consumer-name",
            conventionId: "1",
            agencyId: "any-agency-id",
            occurredAt: "2024-07-01T00:00:00.000Z",
            handledByAgency: true,
            requestParams: {
              conventionId: "1",
            },
          },
          agencyReferent: null,
          agencyId: "any-agency-id",
          agencyName: "Agence de test",
        },
      ];

    store.dispatch(
      conventionsWithBroadcastFeedbackSlice.actions.getConventionsWithErroredBroadcastFeedbackRequested(
        {
          filters: {
            page: 2,
            perPage: 20,
            search: "any-search",
            broadcastErrorKind: "functional",
            conventionStatus: ["IN_REVIEW"],
          },
          jwt: "my-jwt",
          feedbackTopic: "conventions-with-broadcast-feedback",
        },
      ),
    );

    dependencies.conventionGateway.getConventionsWithErroredBroadcastFeedbackResult$.next(
      {
        data: conventionsWithBroadcastFeedback,
        pagination,
      },
    );

    expectToEqual(getErroredBroadcastConventionsWithPagination().filters, {
      page: 2,
      perPage: 20,
      search: "any-search",
      broadcastErrorKind: "functional",
      conventionStatus: ["IN_REVIEW"],
    });

    store.dispatch(
      conventionsWithBroadcastFeedbackSlice.actions.clearConventionsWithBroadcastFeedbackFilters(),
    );

    const erroredBroadcastConventionsWithPaginationAfterClear =
      getErroredBroadcastConventionsWithPagination();
    expectToEqual(erroredBroadcastConventionsWithPaginationAfterClear.filters, {
      page: 1,
      perPage: 20,
    });
    expectToEqual(erroredBroadcastConventionsWithPaginationAfterClear.data, []);
    expectToEqual(
      erroredBroadcastConventionsWithPaginationAfterClear.pagination,
      {
        totalRecords: 0,
        currentPage: 1,
        totalPages: 1,
        numberPerPage: 20,
      },
    );
  });

  const getErroredBroadcastConventionsWithPagination = () =>
    conventionsWithBroadcastFeedbackSelectors.erroredBroadcastConventionsWithPagination(
      store.getState(),
    );
});
