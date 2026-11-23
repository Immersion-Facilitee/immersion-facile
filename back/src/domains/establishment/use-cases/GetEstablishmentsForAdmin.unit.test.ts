import {
  type AdminEstablishmentListItemDto,
  adminEstablishmentListDefaultPerPage,
  adminEstablishmentListMaxPerPage,
  ConnectedUserBuilder,
  errors,
  expectPromiseToFailWithError,
  expectToEqual,
} from "shared";
import {
  createInMemoryOutOfTransactionQueries,
  createInMemoryUow,
} from "../../core/unit-of-work/adapters/createInMemoryUow";
import type { InMemoryEstablishmentAggregateQueries } from "../adapters/InMemoryEstablishmentAggregateQueries";
import {
  type GetEstablishmentsForAdmin,
  makeGetEstablishmentsForAdmin,
} from "./GetEstablishmentsForAdmin";

describe("GetEstablishmentsForAdmin", () => {
  const admin = new ConnectedUserBuilder()
    .withId("admin-id")
    .withIsAdmin(true)
    .build();
  const notAdmin = new ConnectedUserBuilder()
    .withId("not-admin-id")
    .withIsAdmin(false)
    .build();

  const bakeryListItem: AdminEstablishmentListItemDto = {
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
  };

  let getEstablishmentsForAdmin: GetEstablishmentsForAdmin;
  let establishmentAggregateQueries: InMemoryEstablishmentAggregateQueries;

  beforeEach(() => {
    establishmentAggregateQueries = createInMemoryOutOfTransactionQueries(
      createInMemoryUow(),
    ).establishmentAggregate;
    getEstablishmentsForAdmin = makeGetEstablishmentsForAdmin({
      deps: { establishmentAggregateQueries },
    });
  });

  it("throws forbidden when current user is not backoffice admin", async () => {
    await expectPromiseToFailWithError(
      getEstablishmentsForAdmin.execute({}, notAdmin),
      errors.user.forbidden({ userId: notAdmin.id }),
    );
    expectToEqual(
      establishmentAggregateQueries.getEstablishmentsForAdminCalls,
      [],
    );
  });

  it("returns establishments queried with default pagination", async () => {
    establishmentAggregateQueries.establishmentsForAdmin = [bakeryListItem];

    expectToEqual(await getEstablishmentsForAdmin.execute({}, admin), {
      data: [bakeryListItem],
      pagination: {
        currentPage: 1,
        numberPerPage: adminEstablishmentListDefaultPerPage,
        totalPages: 1,
        totalRecords: 1,
      },
    });
    expectToEqual(
      establishmentAggregateQueries.getEstablishmentsForAdminCalls,
      [
        {
          search: undefined,
          pagination: {
            page: 1,
            perPage: adminEstablishmentListDefaultPerPage,
          },
        },
      ],
    );
  });

  it("caps the number of establishments per page", async () => {
    await getEstablishmentsForAdmin.execute(
      { page: 2, perPage: adminEstablishmentListMaxPerPage + 1 },
      admin,
    );

    expectToEqual(
      establishmentAggregateQueries.getEstablishmentsForAdminCalls,
      [
        {
          search: undefined,
          pagination: { page: 2, perPage: adminEstablishmentListMaxPerPage },
        },
      ],
    );
  });

  it.each([
    ["removes spaces from a siret", "222 222 222 22222", "22222222222222"],
    ["keeps other searches as typed", "garage mar", "garage mar"],
  ])("%s before querying", async (_, search, expectedSearch) => {
    await getEstablishmentsForAdmin.execute({ search }, admin);

    expectToEqual(
      establishmentAggregateQueries.getEstablishmentsForAdminCalls,
      [
        {
          search: expectedSearch,
          pagination: {
            page: 1,
            perPage: adminEstablishmentListDefaultPerPage,
          },
        },
      ],
    );
  });

  it("rejects a search shorter than 3 characters", async () => {
    await expectPromiseToFailWithError(
      getEstablishmentsForAdmin.execute({ search: "bo" }, admin),
      errors.inputs.badSchema({
        useCaseName: "GetEstablishmentsForAdmin",
        flattenErrors: ["search : Le minimum est de 3 caractères"],
      }),
    );
  });
});
