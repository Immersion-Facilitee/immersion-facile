import {
  type AdminEventListItemDto,
  type DataWithPagination,
  expectToEqual,
  type GetEventsForAdminParams,
} from "shared";
import { adminEventListSelectors } from "src/core-logic/domain/admin/adminEventList/adminEventList.selectors";
import {
  adminEventListInitialState,
  adminEventListSlice,
} from "src/core-logic/domain/admin/adminEventList/adminEventList.slice";
import { feedbacksSelectors } from "src/core-logic/domain/feedback/feedback.selectors";
import {
  createTestStore,
  type TestDependencies,
} from "src/core-logic/storeConfig/createTestStore";
import type { ReduxStore } from "src/core-logic/storeConfig/store";

describe("Admin event list", () => {
  const jwt = "admin-jwt";
  const searchedUserId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

  const adminEventList: DataWithPagination<AdminEventListItemDto> = {
    data: [
      {
        id: "11111111-1111-4111-8111-111111111111",
        occurredAt: "2026-11-02T10:00:00.000Z",
        topic: "AgencyActivated",
        status: "failed-but-will-retry",
        wasQuarantined: false,
        triggeredBy: {
          kind: "connected-user",
          userId: searchedUserId,
        },
        payload: {
          agencyId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          triggeredBy: { kind: "connected-user", userId: searchedUserId },
        },
        publications: [
          {
            publishedAt: "2026-11-02T10:00:01.000Z",
            failures: [
              {
                subscriptionId: "SendEmailWhenAgencyIsActivated",
                errorMessage: "Brevo indisponible",
              },
            ],
          },
        ],
      },
    ],
    pagination: {
      totalRecords: 1,
      currentPage: 1,
      totalPages: 1,
      numberPerPage: 20,
    },
  };

  const filters: GetEventsForAdminParams = {
    search: searchedUserId,
    page: 1,
    perPage: 20,
  };

  let store: ReduxStore;
  let dependencies: TestDependencies;

  beforeEach(() => {
    ({ store, dependencies } = createTestStore());
  });

  it("fetches admin event list matching search then clears it", () => {
    store.dispatch(
      adminEventListSlice.actions.fetchAdminEventListRequested({
        jwt,
        filters,
        feedbackTopic: "admin-event-list",
      }),
    );

    expectToEqual(adminEventListSelectors.isLoading(store.getState()), true);
    expectToEqual(
      adminEventListSelectors.adminEventList(store.getState()).filters,
      filters,
    );

    dependencies.adminGateway.getEventsForAdminResponse$.next(adminEventList);

    expectToEqual(adminEventListSelectors.isLoading(store.getState()), false);
    expectToEqual(adminEventListSelectors.adminEventList(store.getState()), {
      ...adminEventList,
      filters,
    });

    store.dispatch(adminEventListSlice.actions.clearAdminEventListRequested());

    expectToEqual(adminEventListSelectors.adminEventList(store.getState()), {
      data: adminEventListInitialState.data,
      pagination: adminEventListInitialState.pagination,
      filters: adminEventListInitialState.filters,
    });
  });

  it("stops loading and shows feedback when fetch fails", () => {
    store.dispatch(
      adminEventListSlice.actions.fetchAdminEventListRequested({
        jwt,
        filters,
        feedbackTopic: "admin-event-list",
      }),
    );

    dependencies.adminGateway.getEventsForAdminResponse$.error(
      new Error("Erreur serveur"),
    );

    expectToEqual(adminEventListSelectors.isLoading(store.getState()), false);
    expectToEqual(feedbacksSelectors.feedbacks(store.getState()), {
      "admin-event-list": {
        on: "fetch",
        level: "error",
        title: "Problème lors de la récupération des événements",
        message: "Erreur serveur",
      },
    });
  });
});
