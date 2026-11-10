import {
  type AdminAgencyListItemDto,
  type DataWithPagination,
  expectToEqual,
  type GetAgenciesForAdminParams,
} from "shared";
import { adminAgencyListSelectors } from "src/core-logic/domain/agencies/admin-agency-list/adminAgencyList.selectors";
import {
  adminAgencyListInitialState,
  adminAgencyListSlice,
} from "src/core-logic/domain/agencies/admin-agency-list/adminAgencyList.slice";
import { feedbacksSelectors } from "src/core-logic/domain/feedback/feedback.selectors";
import {
  createTestStore,
  type TestDependencies,
} from "src/core-logic/storeConfig/createTestStore";
import type { ReduxStore } from "src/core-logic/storeConfig/store";

describe("Admin agency list", () => {
  const jwt = "admin-jwt";

  const adminAgencyList: DataWithPagination<AdminAgencyListItemDto> = {
    data: [
      {
        id: "agency-to-review-id",
        name: "Structure d'accompagnement Lyon",
        kind: "autre",
        status: "needsReview",
        siret: "22222222222222",
        refersToAgencyName: "France Travail Lyon",
      },
    ],
    pagination: {
      totalRecords: 1,
      currentPage: 1,
      totalPages: 1,
      numberPerPage: 20,
    },
  };

  const filters: GetAgenciesForAdminParams = {
    search: "lyon",
    kinds: ["autre"],
    statuses: ["needsReview", "active"],
    page: 1,
    perPage: 20,
  };

  let store: ReduxStore;
  let dependencies: TestDependencies;

  beforeEach(() => {
    ({ store, dependencies } = createTestStore());
  });

  it("fetches admin agency list with filters then clears it", () => {
    store.dispatch(
      adminAgencyListSlice.actions.fetchAdminAgencyListRequested({
        jwt,
        filters,
        feedbackTopic: "admin-agency-list",
      }),
    );

    expectToEqual(adminAgencyListSelectors.isLoading(store.getState()), true);
    expectToEqual(
      adminAgencyListSelectors.adminAgencyList(store.getState()).filters,
      filters,
    );

    dependencies.agencyGateway.getAgenciesForAdminResponse$.next(
      adminAgencyList,
    );

    expectToEqual(adminAgencyListSelectors.isLoading(store.getState()), false);
    expectToEqual(adminAgencyListSelectors.adminAgencyList(store.getState()), {
      ...adminAgencyList,
      filters,
    });

    store.dispatch(
      adminAgencyListSlice.actions.clearAdminAgencyListRequested(),
    );

    expectToEqual(adminAgencyListSelectors.adminAgencyList(store.getState()), {
      data: adminAgencyListInitialState.data,
      pagination: adminAgencyListInitialState.pagination,
      filters: adminAgencyListInitialState.filters,
    });
  });

  it("stops loading and shows feedback when fetch fails", () => {
    store.dispatch(
      adminAgencyListSlice.actions.fetchAdminAgencyListRequested({
        jwt,
        filters,
        feedbackTopic: "admin-agency-list",
      }),
    );

    dependencies.agencyGateway.getAgenciesForAdminResponse$.error(
      new Error("Erreur serveur"),
    );

    expectToEqual(adminAgencyListSelectors.isLoading(store.getState()), false);
    expectToEqual(feedbacksSelectors.feedbacks(store.getState()), {
      "admin-agency-list": {
        on: "fetch",
        level: "error",
        title: "Problème lors de la récupération des agences",
        message: "Erreur serveur",
      },
    });
  });
});
