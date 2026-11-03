import { subDays, subYears } from "date-fns";
import { range } from "ramda";
import {
  AgencyDtoBuilder,
  adminConventionListMaxResults,
  ConnectedUserBuilder,
  type ConventionDto,
  ConventionDtoBuilder,
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
  type GetConventionsForAdmin,
  makeGetConventionsForAdmin,
} from "./GetConventionsForAdmin";

describe("GetConventionsForAdmin", () => {
  const now = new Date("2026-10-26T10:00:00.000Z");

  const admin = new ConnectedUserBuilder()
    .withId("admin-id")
    .withIsAdmin(true)
    .build();
  const notAdmin = new ConnectedUserBuilder()
    .withId("not-admin-id")
    .withIsAdmin(false)
    .build();

  const agency = toAgencyWithRights(
    new AgencyDtoBuilder()
      .withId("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa")
      .withName("Mission locale de Paris")
      .withKind("mission-locale")
      .withAddress({
        streetNumberAndAddress: "1 rue de Rivoli",
        city: "Paris",
        departmentCode: "75",
        postcode: "75001",
      })
      .build(),
  );
  const otherAgency = toAgencyWithRights(
    new AgencyDtoBuilder()
      .withId("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb")
      .withName("Structure d'accompagnement Lyon")
      .withKind("autre")
      .withAddress({
        streetNumberAndAddress: "1 place Bellecour",
        city: "Lyon",
        departmentCode: "69",
        postcode: "69002",
      })
      .withRefersToAgencyInfo({
        refersToAgencyId: agency.id,
        refersToAgencyName: agency.name,
        refersToAgencyContactEmail: agency.contactEmail,
      })
      .build(),
  );

  const recentConvention = new ConventionDtoBuilder()
    .withId("11111111-1111-4111-8111-111111111111")
    .withAgencyId(agency.id)
    .withStatus("IN_REVIEW")
    .withBeneficiaryFirstName("John")
    .withBeneficiaryLastName("Doe")
    .withBusinessName("Boulangerie")
    .withDateSubmission(subDays(now, 5).toISOString())
    .withAgencyReferent({ firstname: "Martine", lastname: "Référente" })
    .withFederatedIdentity({
      provider: "ftConnect",
      token: "ft-token",
      payload: {
        advisor: {
          email: "advisor@france-travail.fr",
          firstName: "Paul",
          lastName: "Conseiller",
          type: "PLACEMENT",
        },
      },
    })
    .build();

  const oldConvention = new ConventionDtoBuilder()
    .withId("22222222-2222-4222-8222-222222222222")
    .withAgencyId(otherAgency.id)
    .withStatus("ACCEPTED_BY_VALIDATOR")
    .withBeneficiaryFirstName("Jane")
    .withBeneficiaryLastName("Smith")
    .withBusinessName("Garage")
    .withDateSubmission(subYears(now, 2).toISOString())
    .withUpdatedAt(subYears(now, 2).toISOString())
    .build();

  let getConventionsForAdmin: GetConventionsForAdmin;
  let uow: InMemoryUnitOfWork;

  beforeEach(() => {
    uow = createInMemoryUow();
    getConventionsForAdmin = makeGetConventionsForAdmin({
      uowPerformer: new InMemoryUowPerformer(uow),
    });
    uow.agencyRepository.agencies = [agency, otherAgency];
    uow.conventionRepository.setConventions([oldConvention, recentConvention]);
  });

  it("throws forbidden when current user is not backoffice admin", async () => {
    await expectPromiseToFailWithError(
      getConventionsForAdmin.execute({}, notAdmin),
      errors.user.forbidden({ userId: notAdmin.id }),
    );
  });

  it("returns conventions whatever their age, most recently submitted first", async () => {
    const result = await getConventionsForAdmin.execute({}, admin);

    expectToEqual(result, {
      data: [
        {
          id: recentConvention.id,
          status: recentConvention.status,
          dateStart: recentConvention.dateStart,
          dateEnd: recentConvention.dateEnd,
          businessName: recentConvention.businessName,
          agencyName: agency.name,
          agencyKind: "mission-locale",
          agencyDepartmentName: "Paris",
          agencyRefersToAgencyName: null,
          agencyReferent: recentConvention.agencyReferent,
          assessment: null,
          beneficiary: {
            firstName: "John",
            lastName: "Doe",
            federatedIdentity: {
              provider: "ftConnect",
              payload: {
                advisor: {
                  email: "advisor@france-travail.fr",
                  firstName: "Paul",
                  lastName: "Conseiller",
                  type: "PLACEMENT",
                },
              },
            },
          },
        },
        {
          id: oldConvention.id,
          status: oldConvention.status,
          dateStart: oldConvention.dateStart,
          dateEnd: oldConvention.dateEnd,
          businessName: oldConvention.businessName,
          agencyName: otherAgency.name,
          agencyKind: "autre",
          agencyDepartmentName: "Rhône",
          agencyRefersToAgencyName: agency.name,
          agencyReferent: oldConvention.agencyReferent,
          assessment: null,
          beneficiary: {
            firstName: "Jane",
            lastName: "Smith",
          },
        },
      ],
      pagination: {
        currentPage: 1,
        numberPerPage: defaultPerPageInWebPagination,
        totalPages: 1,
        totalRecords: 2,
      },
    });
  });

  it("combines filters", async () => {
    const result = await getConventionsForAdmin.execute(
      {
        agencyNameContains: "mission locale",
        search: "doe",
        statuses: ["IN_REVIEW"],
      },
      admin,
    );

    expectToEqual(
      result.data.map(({ id }) => id),
      [recentConvention.id],
    );
  });

  it("searches conventions by identifier or name", async () => {
    const byConventionId = await getConventionsForAdmin.execute(
      { search: oldConvention.id },
      admin,
    );
    const byBusinessName = await getConventionsForAdmin.execute(
      { search: "boulang" },
      admin,
    );

    expectToEqual(
      byConventionId.data.map(({ id }) => id),
      [oldConvention.id],
    );
    expectToEqual(
      byBusinessName.data.map(({ id }) => id),
      [recentConvention.id],
    );
  });

  it("searches conventions by agency referent name", async () => {
    const result = await getConventionsForAdmin.execute(
      { search: "martine réf" },
      admin,
    );

    expectToEqual(
      result.data.map(({ id }) => id),
      [recentConvention.id],
    );
  });

  it("filters conventions by assessment completion status", async () => {
    const result = await getConventionsForAdmin.execute(
      { assessmentCompletionStatus: ["to-complete"] },
      admin,
    );

    expectToEqual(
      result.data.map(({ id }) => id),
      [oldConvention.id],
    );
  });

  it("rejects a search shorter than the minimum length", async () => {
    await expectPromiseToFailWithError(
      getConventionsForAdmin.execute({ search: "ab" }, admin),
      errors.inputs.badSchema({
        useCaseName: "GetConventionsForAdmin",
        flattenErrors: ["search : Le minimum est de 3 caractères"],
      }),
    );
  });

  describe(`when more than ${adminConventionListMaxResults} conventions match`, () => {
    beforeEach(() => {
      uow.conventionRepository.setConventions(
        range(0, adminConventionListMaxResults + 1).map((index) =>
          new ConventionDtoBuilder()
            .withId(
              `${index.toString().padStart(8, "0")}-1111-4111-8111-111111111111`,
            )
            .withAgencyId(agency.id)
            .withDateSubmission(subDays(now, index).toISOString())
            .build(),
        ),
      );
    });

    it(`caps total records to the ${adminConventionListMaxResults} most recently submitted conventions`, async () => {
      const result = await getConventionsForAdmin.execute({}, admin);

      expectToEqual(result.data.length, defaultPerPageInWebPagination);
      expectToEqual(result.pagination, {
        currentPage: 1,
        numberPerPage: defaultPerPageInWebPagination,
        totalPages:
          adminConventionListMaxResults / defaultPerPageInWebPagination,
        totalRecords: adminConventionListMaxResults,
      });
    });

    it(`returns no conventions beyond the ${adminConventionListMaxResults} most recently submitted`, async () => {
      const pageAfterLastReachablePage =
        adminConventionListMaxResults / defaultPerPageInWebPagination + 1;

      const result = await getConventionsForAdmin.execute(
        { page: pageAfterLastReachablePage },
        admin,
      );

      expectToEqual(result.data, []);
    });
  });

  it("filters by start date and validation date ranges", async () => {
    const validatedConvention: ConventionDto = new ConventionDtoBuilder(
      oldConvention,
    )
      .withDateStart(new Date("2026-11-02").toISOString())
      .withDateEnd(new Date("2026-11-06").toISOString())
      .withDateValidation(new Date("2026-10-20").toISOString())
      .build();
    uow.conventionRepository.setConventions([
      recentConvention,
      validatedConvention,
    ]);

    const result = await getConventionsForAdmin.execute(
      {
        dateStartFrom: new Date("2026-11-01").toISOString(),
        dateValidationFrom: new Date("2026-10-19").toISOString(),
        dateValidationTo: new Date("2026-10-21").toISOString(),
      },
      admin,
    );

    expectToEqual(
      result.data.map(({ id }) => id),
      [validatedConvention.id],
    );
  });

  it("includes conventions validated during the last day of the validation date range", async () => {
    const conventionValidatedDuringLastDay: ConventionDto =
      new ConventionDtoBuilder(oldConvention)
        .withDateValidation(new Date("2026-10-21T10:00:00.000Z").toISOString())
        .build();
    uow.conventionRepository.setConventions([
      recentConvention,
      conventionValidatedDuringLastDay,
    ]);

    const result = await getConventionsForAdmin.execute(
      {
        dateValidationFrom: "2026-10-21",
        dateValidationTo: "2026-10-21",
      },
      admin,
    );

    expectToEqual(
      result.data.map(({ id }) => id),
      [conventionValidatedDuringLastDay.id],
    );
  });

  it("paginates results", async () => {
    const result = await getConventionsForAdmin.execute(
      { page: 2, perPage: 1 },
      admin,
    );

    expectToEqual(
      result.data.map(({ id }) => id),
      [oldConvention.id],
    );
    expectToEqual(result.pagination, {
      currentPage: 2,
      numberPerPage: 1,
      totalPages: 2,
      totalRecords: 2,
    });
  });
});
