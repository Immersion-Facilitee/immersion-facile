import { addDays, subDays, subMonths, subYears } from "date-fns";
import {
  ConnectedUserBuilder,
  ConventionDtoBuilder,
  defaultMonthsThresholdForConventionsListing,
  expectToEqual,
  makeBooleanFeatureFlag,
  reasonableSchedule,
} from "shared";
import { CustomTimeGateway } from "../../core/time-gateway/adapters/CustomTimeGateway";
import {
  createInMemoryUow,
  type InMemoryUnitOfWork,
} from "../../core/unit-of-work/adapters/createInMemoryUow";
import { InMemoryUowPerformer } from "../../core/unit-of-work/adapters/InMemoryUowPerformer";
import type { AssessmentEntity } from "../entities/AssessmentEntity";
import { makeGetBeneficiaryConventionList } from "./GetBeneficiaryConventionList";

describe("GetBeneficiaryConventionList", () => {
  const currentUser = new ConnectedUserBuilder()
    .withEmail("beneficiary@mail.com")
    .build();

  const now = new Date("2026-09-01T10:10:00.000Z");

  let getBeneficiaryConventionList: ReturnType<
    typeof makeGetBeneficiaryConventionList
  >;
  let uow: InMemoryUnitOfWork;

  const monthsAgo_25 = subMonths(
    now,
    defaultMonthsThresholdForConventionsListing,
  );
  const archivedBeneficiaryConvention = new ConventionDtoBuilder()
    .withId("11111111-1111-4111-8111-111111111111")
    .withBeneficiaryEmail(currentUser.email)
    .withBusinessName("Beneficiary business")
    .withStatus("ACCEPTED_BY_VALIDATOR")
    .withDateSubmission(subDays(subDays(monthsAgo_25, 4), 2).toISOString())
    .withDateStart(subDays(monthsAgo_25, 4).toISOString())
    .withDateEnd(subDays(monthsAgo_25, 1).toISOString())
    .withSchedule(reasonableSchedule)
    .build();

  const notArchivedBeneficiaryConvention = new ConventionDtoBuilder()
    .withId("11111111-1111-4111-8111-111111111112")
    .withBeneficiaryEmail(currentUser.email)
    .withBeneficiaryBirthdate(
      subYears(monthsAgo_25, 20).toISOString().split("T")[0],
    )
    .withBusinessName("Beneficiary business")
    .withStatus("ACCEPTED_BY_VALIDATOR")
    .withDateSubmission(subDays(addDays(monthsAgo_25, 1), 2).toISOString())
    .withDateStart(addDays(monthsAgo_25, 1).toISOString())
    .withDateEnd(addDays(monthsAgo_25, 4).toISOString())
    .withSchedule(reasonableSchedule)
    .build();

  beforeEach(() => {
    uow = createInMemoryUow();
    getBeneficiaryConventionList = makeGetBeneficiaryConventionList({
      uowPerformer: new InMemoryUowPerformer(uow),
      deps: { timeGateway: new CustomTimeGateway(now) },
    });
  });

  it("returns conventions for current user beneficiary email", async () => {
    const beneficiaryConventionWithAssessment = new ConventionDtoBuilder()
      .withId("11111111-1111-4111-8111-111111111111")
      .withBeneficiaryEmail(currentUser.email)
      .withBusinessName("Beneficiary business")
      .withStatus("ACCEPTED_BY_VALIDATOR")
      .withDateStart("2026-01-06")
      .withDateEnd("2026-01-10")
      .withSchedule(reasonableSchedule)
      .build();

    const beneficiaryConvention = new ConventionDtoBuilder()
      .withId("11111111-1111-4111-8111-111111111112")
      .withBeneficiaryEmail(currentUser.email)
      .withBusinessName("Beneficiary business")
      .withStatus("ACCEPTED_BY_VALIDATOR")
      .withDateStart("2026-01-01")
      .withDateEnd("2026-01-05")
      .withSchedule(reasonableSchedule)
      .build();

    const otherConvention = new ConventionDtoBuilder()
      .withId("22222222-2222-4222-8222-222222222222")
      .withBeneficiaryEmail("other-beneficiary@mail.com")
      .withDateStart("2026-01-01")
      .withDateEnd("2026-01-05")
      .withSchedule(reasonableSchedule)
      .build();

    const assessmentCreatedAt = "2026-01-10T00:00:00.000Z";
    const assessment: AssessmentEntity = {
      conventionId: beneficiaryConventionWithAssessment.id,
      status: "COMPLETED",
      endedWithAJob: false,
      establishmentFeedback: "Ca s'est bien passé",
      establishmentAdvices: "mon conseil",
      beneficiaryAgreement: null,
      beneficiaryFeedback: null,
      signedAt: null,
      createdAt: assessmentCreatedAt,
      numberOfHoursActuallyMade: null,
      _entityName: "Assessment",
    };

    uow.conventionRepository.setConventions([
      beneficiaryConventionWithAssessment,
      beneficiaryConvention,
      otherConvention,
    ]);
    uow.assessmentRepository.assessments = [assessment];

    const result = await getBeneficiaryConventionList.execute(
      { pagination: { page: 1, perPage: 10 } },
      currentUser,
    );

    expectToEqual(result, {
      data: [
        {
          conventionId: beneficiaryConventionWithAssessment.id,
          businessName: beneficiaryConventionWithAssessment.businessName,
          status: beneficiaryConventionWithAssessment.status,
          assessment: {
            status: assessment.status,
            endedWithAJob: false,
            signedAt: null,
            createdAt: assessmentCreatedAt,
          },
          dateStart: beneficiaryConventionWithAssessment.dateStart,
          dateEnd: beneficiaryConventionWithAssessment.dateEnd,
        },
        {
          conventionId: beneficiaryConvention.id,
          businessName: beneficiaryConvention.businessName,
          status: beneficiaryConvention.status,
          assessment: null,
          dateStart: beneficiaryConvention.dateStart,
          dateEnd: beneficiaryConvention.dateEnd,
        },
      ],
      pagination: {
        totalRecords: 2,
        currentPage: 1,
        totalPages: 1,
        numberPerPage: 10,
      },
    });
  });

  it("returns an empty page when current user is not beneficiary of any convention", async () => {
    const convention = new ConventionDtoBuilder()
      .withBeneficiaryEmail("other-beneficiary@mail.com")
      .build();

    uow.conventionRepository.setConventions([convention]);

    const result = await getBeneficiaryConventionList.execute(
      { pagination: { page: 1, perPage: 10 } },
      currentUser,
    );

    expectToEqual(result, {
      data: [],
      pagination: {
        totalRecords: 0,
        currentPage: 1,
        totalPages: 1,
        numberPerPage: 10,
      },
    });
  });

  describe("when enableRequestArchivedConvention is active", () => {
    it(`returns archived conventions (date end older than ${defaultMonthsThresholdForConventionsListing} months)`, async () => {
      uow.featureFlagRepository.featureFlags = {
        enableRequestArchivedConvention: makeBooleanFeatureFlag(true),
      };

      uow.conventionRepository.setConventions([
        archivedBeneficiaryConvention,
        notArchivedBeneficiaryConvention,
      ]);

      const result = await getBeneficiaryConventionList.execute(
        { pagination: { page: 1, perPage: 10 } },
        currentUser,
      );

      expectToEqual(result, {
        data: [
          {
            conventionId: notArchivedBeneficiaryConvention.id,
            businessName: notArchivedBeneficiaryConvention.businessName,
            status: notArchivedBeneficiaryConvention.status,
            assessment: null,
            dateStart: notArchivedBeneficiaryConvention.dateStart,
            dateEnd: notArchivedBeneficiaryConvention.dateEnd,
          },
          {
            conventionId: archivedBeneficiaryConvention.id,
            businessName: archivedBeneficiaryConvention.businessName,
            status: archivedBeneficiaryConvention.status,
            assessment: null,
            dateStart: archivedBeneficiaryConvention.dateStart,
            dateEnd: archivedBeneficiaryConvention.dateEnd,
          },
        ],
        pagination: {
          totalRecords: 2,
          currentPage: 1,
          totalPages: 1,
          numberPerPage: 10,
        },
      });
    });
  });

  describe("when enableRequestArchivedConvention is inactive", () => {
    it(`does not return archived conventions (date end older than ${defaultMonthsThresholdForConventionsListing} months)`, async () => {
      uow.conventionRepository.setConventions([
        archivedBeneficiaryConvention,
        notArchivedBeneficiaryConvention,
      ]);

      const result = await getBeneficiaryConventionList.execute(
        { pagination: { page: 1, perPage: 10 } },
        currentUser,
      );

      expectToEqual(result, {
        data: [
          {
            conventionId: notArchivedBeneficiaryConvention.id,
            businessName: notArchivedBeneficiaryConvention.businessName,
            status: notArchivedBeneficiaryConvention.status,
            assessment: null,
            dateStart: notArchivedBeneficiaryConvention.dateStart,
            dateEnd: notArchivedBeneficiaryConvention.dateEnd,
          },
        ],
        pagination: {
          totalRecords: 1,
          currentPage: 1,
          totalPages: 1,
          numberPerPage: 10,
        },
      });
    });
  });

  describe("search", () => {
    const bakeryConvention = new ConventionDtoBuilder()
      .withId("11111111-1111-4111-8111-111111111111")
      .withBeneficiaryEmail(currentUser.email)
      .withBusinessName("Boulangerie Dupont")
      .withStatus("ACCEPTED_BY_VALIDATOR")
      .withDateStart("2026-03-01")
      .withDateEnd("2026-03-05")
      .withSourceConventionDraftId("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa")
      .withSchedule(reasonableSchedule)
      .build();

    const floristConvention = new ConventionDtoBuilder()
      .withId("11111111-1111-4111-8111-111111111112")
      .withBeneficiaryEmail(currentUser.email)
      .withBusinessName("Fleuriste Martin")
      .withStatus("ACCEPTED_BY_VALIDATOR")
      .withDateStart("2026-02-01")
      .withDateEnd("2026-02-05")
      .withSchedule(reasonableSchedule)
      .build();

    const otherBeneficiaryConvention = new ConventionDtoBuilder()
      .withId("22222222-2222-4222-8222-222222222222")
      .withBeneficiaryEmail("other-beneficiary@mail.com")
      .withBusinessName("Boulangerie Dupont")
      .withStatus("ACCEPTED_BY_VALIDATOR")
      .withDateStart("2026-03-10")
      .withDateEnd("2026-03-15")
      .withSchedule(reasonableSchedule)
      .build();

    beforeEach(() => {
      uow.conventionRepository.setConventions([
        bakeryConvention,
        floristConvention,
        otherBeneficiaryConvention,
      ]);
    });

    it("returns the matching convention when searching by id", async () => {
      const result = await getBeneficiaryConventionList.execute(
        {
          filters: { search: bakeryConvention.id },
          pagination: { page: 1, perPage: 10 },
        },
        currentUser,
      );

      expectToEqual(result, {
        data: [
          {
            conventionId: bakeryConvention.id,
            businessName: bakeryConvention.businessName,
            status: bakeryConvention.status,
            assessment: null,
            dateStart: bakeryConvention.dateStart,
            dateEnd: bakeryConvention.dateEnd,
          },
        ],
        pagination: {
          totalRecords: 1,
          currentPage: 1,
          totalPages: 1,
          numberPerPage: 10,
        },
      });
    });

    it("returns the matching convention when searching by businessName", async () => {
      const result = await getBeneficiaryConventionList.execute(
        {
          filters: { search: "Fleuriste" },
          pagination: { page: 1, perPage: 10 },
        },
        currentUser,
      );

      expectToEqual(result, {
        data: [
          {
            conventionId: floristConvention.id,
            businessName: floristConvention.businessName,
            status: floristConvention.status,
            assessment: null,
            dateStart: floristConvention.dateStart,
            dateEnd: floristConvention.dateEnd,
          },
        ],
        pagination: {
          totalRecords: 1,
          currentPage: 1,
          totalPages: 1,
          numberPerPage: 10,
        },
      });
    });

    it("returns the matching convention when searching by sourceConventionDraftId", async () => {
      const result = await getBeneficiaryConventionList.execute(
        {
          filters: { search: bakeryConvention.sourceConventionDraftId },
          pagination: { page: 1, perPage: 10 },
        },
        currentUser,
      );

      expectToEqual(result, {
        data: [
          {
            conventionId: bakeryConvention.id,
            businessName: bakeryConvention.businessName,
            status: bakeryConvention.status,
            assessment: null,
            dateStart: bakeryConvention.dateStart,
            dateEnd: bakeryConvention.dateEnd,
          },
        ],
        pagination: {
          totalRecords: 1,
          currentPage: 1,
          totalPages: 1,
          numberPerPage: 10,
        },
      });
    });

    it("returns an empty page when search has no match", async () => {
      const result = await getBeneficiaryConventionList.execute(
        {
          filters: { search: "99999999-9999-4999-8999-999999999999" },
          pagination: { page: 1, perPage: 10 },
        },
        currentUser,
      );

      expectToEqual(result, {
        data: [],
        pagination: {
          totalRecords: 0,
          currentPage: 1,
          totalPages: 1,
          numberPerPage: 10,
        },
      });
    });
  });

  describe("pagination", () => {
    it("returns the second page when there are enough conventions", async () => {
      const newestConvention = new ConventionDtoBuilder()
        .withId("11111111-1111-4111-8111-111111111111")
        .withBeneficiaryEmail(currentUser.email)
        .withBusinessName("Newest")
        .withStatus("ACCEPTED_BY_VALIDATOR")
        .withDateStart("2026-03-01")
        .withDateEnd("2026-03-05")
        .withSchedule(reasonableSchedule)
        .build();
      const middleConvention = new ConventionDtoBuilder()
        .withId("11111111-1111-4111-8111-111111111112")
        .withBeneficiaryEmail(currentUser.email)
        .withBusinessName("Middle")
        .withStatus("ACCEPTED_BY_VALIDATOR")
        .withDateStart("2026-02-01")
        .withDateEnd("2026-02-05")
        .withSchedule(reasonableSchedule)
        .build();
      const oldestConvention = new ConventionDtoBuilder()
        .withId("11111111-1111-4111-8111-111111111113")
        .withBeneficiaryEmail(currentUser.email)
        .withBusinessName("Oldest")
        .withStatus("ACCEPTED_BY_VALIDATOR")
        .withDateStart("2026-01-01")
        .withDateEnd("2026-01-05")
        .withSchedule(reasonableSchedule)
        .build();

      uow.conventionRepository.setConventions([
        newestConvention,
        middleConvention,
        oldestConvention,
      ]);

      const result = await getBeneficiaryConventionList.execute(
        { pagination: { page: 2, perPage: 2 } },
        currentUser,
      );

      expectToEqual(result, {
        data: [
          {
            conventionId: oldestConvention.id,
            businessName: oldestConvention.businessName,
            status: oldestConvention.status,
            assessment: null,
            dateStart: oldestConvention.dateStart,
            dateEnd: oldestConvention.dateEnd,
          },
        ],
        pagination: {
          totalRecords: 3,
          currentPage: 2,
          totalPages: 2,
          numberPerPage: 2,
        },
      });
    });
  });
});
