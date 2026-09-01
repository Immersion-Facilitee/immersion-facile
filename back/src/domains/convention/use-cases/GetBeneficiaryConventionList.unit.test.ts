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
      undefined,
      currentUser,
    );

    expectToEqual(result, [
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
    ]);
  });

  it("returns an empty array when current user is not beneficiary of any convention", async () => {
    const convention = new ConventionDtoBuilder()
      .withBeneficiaryEmail("other-beneficiary@mail.com")
      .build();

    uow.conventionRepository.setConventions([convention]);

    const result = await getBeneficiaryConventionList.execute(
      undefined,
      currentUser,
    );

    expectToEqual(result, []);
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
        undefined,
        currentUser,
      );

      expectToEqual(result, [
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
      ]);
    });
  });

  describe("when enableRequestArchivedConvention is inactive", () => {
    it(`does not return archived conventions (date end older than ${defaultMonthsThresholdForConventionsListing} months)`, async () => {
      uow.conventionRepository.setConventions([
        archivedBeneficiaryConvention,
        notArchivedBeneficiaryConvention,
      ]);

      const result = await getBeneficiaryConventionList.execute(
        undefined,
        currentUser,
      );

      expectToEqual(result, [
        {
          conventionId: notArchivedBeneficiaryConvention.id,
          businessName: notArchivedBeneficiaryConvention.businessName,
          status: notArchivedBeneficiaryConvention.status,
          assessment: null,
          dateStart: notArchivedBeneficiaryConvention.dateStart,
          dateEnd: notArchivedBeneficiaryConvention.dateEnd,
        },
      ]);
    });
  });
});
