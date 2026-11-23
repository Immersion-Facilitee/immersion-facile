import {
  type AdminEstablishmentListItemDto,
  type DataWithPagination,
  expectToEqual,
  type GetEstablishmentsForAdminParams,
} from "shared";
import { adminEstablishmentListSelectors } from "src/core-logic/domain/adminEstablishmentList/adminEstablishmentList.selectors";
import {
  adminEstablishmentListInitialState,
  adminEstablishmentListSlice,
} from "src/core-logic/domain/adminEstablishmentList/adminEstablishmentList.slice";
import { feedbacksSelectors } from "src/core-logic/domain/feedback/feedback.selectors";
import {
  createTestStore,
  type TestDependencies,
} from "src/core-logic/storeConfig/createTestStore";
import type { ReduxStore } from "src/core-logic/storeConfig/store";

describe("Admin establishment list", () => {
  const jwt = "admin-jwt";

  const adminEstablishmentList: DataWithPagination<AdminEstablishmentListItemDto> =
    {
      data: [
        {
          siret: "11111111111111",
          name: "BOULANGERIE DU CENTRE",
          customizedName: "Le Fournil",
          city: "Lyon",
          postcode: "69001",
          otherLocationsCount: 1,
          createdAt: "2024-01-10T10:00:00.000Z",
          updatedAt: "2026-10-20T10:00:00.000Z",
          discussionsCount: 2,
          validatedConventionsCount: 1,
        },
      ],
      pagination: {
        totalRecords: 1,
        currentPage: 1,
        totalPages: 1,
        numberPerPage: 20,
      },
    };

  const filters: GetEstablishmentsForAdminParams = {
    search: "fournil",
    page: 1,
    perPage: 20,
  };

  let store: ReduxStore;
  let dependencies: TestDependencies;

  beforeEach(() => {
    ({ store, dependencies } = createTestStore());
  });

  it("fetches admin establishment list with filters then clears it", () => {
    store.dispatch(
      adminEstablishmentListSlice.actions.fetchAdminEstablishmentListRequested({
        jwt,
        filters,
        feedbackTopic: "admin-establishment-list",
      }),
    );

    expectToEqual(
      adminEstablishmentListSelectors.isLoading(store.getState()),
      true,
    );
    expectToEqual(
      adminEstablishmentListSelectors.adminEstablishmentList(store.getState())
        .filters,
      filters,
    );

    dependencies.establishmentGateway.getEstablishmentsForAdminResponse$.next(
      adminEstablishmentList,
    );

    expectToEqual(
      adminEstablishmentListSelectors.isLoading(store.getState()),
      false,
    );
    expectToEqual(
      adminEstablishmentListSelectors.adminEstablishmentList(store.getState()),
      { ...adminEstablishmentList, filters },
    );

    store.dispatch(
      adminEstablishmentListSlice.actions.clearAdminEstablishmentListRequested(),
    );

    expectToEqual(
      adminEstablishmentListSelectors.adminEstablishmentList(store.getState()),
      {
        data: adminEstablishmentListInitialState.data,
        pagination: adminEstablishmentListInitialState.pagination,
        filters: adminEstablishmentListInitialState.filters,
      },
    );
  });

  it("stops loading and shows feedback when fetch fails", () => {
    store.dispatch(
      adminEstablishmentListSlice.actions.fetchAdminEstablishmentListRequested({
        jwt,
        filters,
        feedbackTopic: "admin-establishment-list",
      }),
    );

    dependencies.establishmentGateway.getEstablishmentsForAdminResponse$.error(
      new Error("Erreur serveur"),
    );

    expectToEqual(
      adminEstablishmentListSelectors.isLoading(store.getState()),
      false,
    );
    expectToEqual(feedbacksSelectors.feedbacks(store.getState()), {
      "admin-establishment-list": {
        on: "fetch",
        level: "error",
        title: "Problème lors de la récupération des établissements",
        message: "Erreur serveur",
      },
    });
  });
});
