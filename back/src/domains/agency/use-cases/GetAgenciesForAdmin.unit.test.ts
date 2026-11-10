import {
  AgencyDtoBuilder,
  ConnectedUserBuilder,
  defaultPerPageInWebPagination,
  errors,
  expectPromiseToFailWithError,
  expectToEqual,
} from "shared";
import { toAgencyWithRights } from "../../../utils/agency";
import {
  createInMemoryUow,
  type InMemoryUnitOfWork,
} from "../../core/unit-of-work/adapters/createInMemoryUow";
import { InMemoryUowPerformer } from "../../core/unit-of-work/adapters/InMemoryUowPerformer";
import {
  type GetAgenciesForAdmin,
  makeGetAgenciesForAdmin,
} from "./GetAgenciesForAdmin";

describe("GetAgenciesForAdmin", () => {
  const admin = new ConnectedUserBuilder()
    .withId("admin-id")
    .withIsAdmin(true)
    .build();
  const notAdmin = new ConnectedUserBuilder()
    .withId("not-admin-id")
    .withIsAdmin(false)
    .build();

  const oldActiveAgency = toAgencyWithRights(
    new AgencyDtoBuilder()
      .withId("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa")
      .withName("France Travail Bayonne")
      .withKind("france-travail")
      .withStatus("active")
      .withAgencySiret("11111111111111")
      .withCreatedAt("2024-01-10T10:00:00.000Z")
      .build(),
  );
  const recentAgencyToReview = toAgencyWithRights(
    new AgencyDtoBuilder()
      .withId("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb")
      .withName("Structure d'accompagnement Lyon")
      .withKind("autre")
      .withStatus("needsReview")
      .withAgencySiret("22222222222222")
      .withCreatedAt("2026-10-20T10:00:00.000Z")
      .withRefersToAgencyInfo({
        refersToAgencyId: oldActiveAgency.id,
        refersToAgencyName: oldActiveAgency.name,
        refersToAgencyContactEmail: oldActiveAgency.contactEmail,
      })
      .build(),
  );
  const missionLocaleToReview = toAgencyWithRights(
    new AgencyDtoBuilder()
      .withId("cccccccc-cccc-4ccc-8ccc-cccccccccccc")
      .withName("Mission locale de Paris")
      .withKind("mission-locale")
      .withStatus("needsReview")
      .withAgencySiret("33333333333333")
      .withCreatedAt("2025-06-15T10:00:00.000Z")
      .build(),
  );

  let getAgenciesForAdmin: GetAgenciesForAdmin;
  let uow: InMemoryUnitOfWork;

  beforeEach(() => {
    uow = createInMemoryUow();
    getAgenciesForAdmin = makeGetAgenciesForAdmin({
      uowPerformer: new InMemoryUowPerformer(uow),
    });
    uow.agencyRepository.agencies = [
      oldActiveAgency,
      recentAgencyToReview,
      missionLocaleToReview,
    ];
  });

  it("throws forbidden when current user is not backoffice admin", async () => {
    await expectPromiseToFailWithError(
      getAgenciesForAdmin.execute({}, notAdmin),
      errors.user.forbidden({ userId: notAdmin.id }),
    );
  });

  it("returns all agencies, most recently created first", async () => {
    const result = await getAgenciesForAdmin.execute({}, admin);

    expectToEqual(result, {
      data: [
        {
          id: recentAgencyToReview.id,
          name: "Structure d'accompagnement Lyon",
          kind: "autre",
          status: "needsReview",
          siret: "22222222222222",
          refersToAgencyName: "France Travail Bayonne",
        },
        {
          id: missionLocaleToReview.id,
          name: "Mission locale de Paris",
          kind: "mission-locale",
          status: "needsReview",
          siret: "33333333333333",
          refersToAgencyName: null,
        },
        {
          id: oldActiveAgency.id,
          name: "France Travail Bayonne",
          kind: "france-travail",
          status: "active",
          siret: "11111111111111",
          refersToAgencyName: null,
        },
      ],
      pagination: {
        currentPage: 1,
        numberPerPage: defaultPerPageInWebPagination,
        totalPages: 1,
        totalRecords: 3,
      },
    });
  });

  it("combines status and kind filters", async () => {
    const result = await getAgenciesForAdmin.execute(
      {
        statuses: ["needsReview"],
        kinds: ["mission-locale", "france-travail"],
      },
      admin,
    );

    expectToEqual(
      result.data.map(({ id }) => id),
      [missionLocaleToReview.id],
    );
  });

  it.each([
    { searchedBy: "partial name", search: "paris" },
    { searchedBy: "siret with spaces", search: "333 333 333 33333" },
    { searchedBy: "id", search: missionLocaleToReview.id },
  ])("searches agencies by $searchedBy", async ({ search }) => {
    const result = await getAgenciesForAdmin.execute({ search }, admin);

    expectToEqual(
      result.data.map(({ id }) => id),
      [missionLocaleToReview.id],
    );
  });

  it("paginates results", async () => {
    const result = await getAgenciesForAdmin.execute(
      { page: 2, perPage: 2 },
      admin,
    );

    expectToEqual(
      result.data.map(({ id }) => id),
      [oldActiveAgency.id],
    );
    expectToEqual(result.pagination, {
      currentPage: 2,
      numberPerPage: 2,
      totalPages: 2,
      totalRecords: 3,
    });
  });
});
