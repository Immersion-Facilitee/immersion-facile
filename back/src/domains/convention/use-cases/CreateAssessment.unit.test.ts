import { addDays, subDays, subMonths } from "date-fns";
import {
  AgencyDtoBuilder,
  type AssessmentDto,
  allRoles,
  ConnectedUserBuilder,
  type ConventionDomainJwtPayload,
  ConventionDtoBuilder,
  type ConventionRole,
  conventionStatuses,
  defaultMonthsThresholdForConventionsListing,
  errors,
  expectArraysToEqual,
  expectObjectInArrayToMatch,
  expectPromiseToFailWithError,
  ForbiddenError,
  makeBooleanFeatureFlag,
  type Role,
  reasonableSchedule,
  splitCasesBetweenPassingAndFailing,
  type User,
} from "shared";
import { toAgencyWithRights } from "../../../utils/agency";
import { makeHashByRolesForTest } from "../../../utils/emailHash";
import { makeEmailHash } from "../../../utils/jwt";
import { makeCreateNewEvent } from "../../core/events/ports/EventBus";
import { CustomTimeGateway } from "../../core/time-gateway/adapters/CustomTimeGateway";
import {
  createInMemoryUow,
  type InMemoryUnitOfWork,
} from "../../core/unit-of-work/adapters/createInMemoryUow";
import { InMemoryUowPerformer } from "../../core/unit-of-work/adapters/InMemoryUowPerformer";
import { TestUuidGenerator } from "../../core/uuid-generator/adapters/UuidGeneratorImplementations";
import {
  type AssessmentCreator,
  type AssessmentCreatorRole,
  acceptedConventionStatusesForAssessment,
} from "../entities/AssessmentEntity";
import {
  type CreateAssessment,
  makeCreateAssessment,
} from "./CreateAssessment";

describe("CreateAssessment", () => {
  const agency = new AgencyDtoBuilder().build();
  const counsellor = new ConnectedUserBuilder()
    .withId("counsellor")
    .withEmail("counsellor@mail.com")
    .buildUser();
  const validator = new ConnectedUserBuilder()
    .withId("validator")
    .withEmail("validator@mail.com")
    .buildUser();

  const validatedConvention = new ConventionDtoBuilder()
    .withStatus("ACCEPTED_BY_VALIDATOR")
    .withAgencyId(agency.id)
    .build();
  const userWithoutRoleOnConvention = new ConnectedUserBuilder()
    .withId("userWithoutRoleOnConvention")
    .withEmail("userWithoutRoleOnConvention@email.com")
    .buildUser();
  const backOfficeAdmin = new ConnectedUserBuilder()
    .withId("backOfficeAdmin")
    .withEmail("backOfficeAdmin@email.com")
    .withIsAdmin(true)
    .buildUser();
  const assessment: AssessmentDto = {
    conventionId: validatedConvention.id,
    status: "COMPLETED",
    endedWithAJob: false,
    establishmentFeedback: "Ca c'est bien passé",
    establishmentAdvices: "mon conseil",
    beneficiaryAgreement: null,
    beneficiaryFeedback: null,
    signedAt: null,
    createdAt: new Date("2025-01-01").toISOString(),
  };

  const tutorPayload: ConventionDomainJwtPayload = {
    applicationId: validatedConvention.id,
    role: "establishment-tutor",
    emailHash: makeEmailHash(validatedConvention.establishmentTutor.email),
  };

  const makeUserAssessmentCreator = (
    role: AssessmentCreatorRole,
    { id, email, firstName, lastName }: User,
  ): AssessmentCreator => ({ role, userId: id, email, firstName, lastName });

  const tutorAssessmentCreator: AssessmentCreator = {
    role: "establishment-tutor",
    email: validatedConvention.establishmentTutor.email,
    firstName: validatedConvention.establishmentTutor.firstName,
    lastName: validatedConvention.establishmentTutor.lastName,
  };

  const assessmentCreatorThroughMagicLinkByRole: Record<
    AssessmentCreatorRole,
    AssessmentCreator
  > = {
    "establishment-tutor": tutorAssessmentCreator,
    validator: makeUserAssessmentCreator("validator", validator),
    counsellor: makeUserAssessmentCreator("counsellor", counsellor),
  };

  const [passingStatuses, failingStatuses] = splitCasesBetweenPassingAndFailing(
    conventionStatuses,
    acceptedConventionStatusesForAssessment,
  );

  const [passingRoles, failingRoles] = splitCasesBetweenPassingAndFailing(
    allRoles,
    ["establishment-tutor", "validator", "counsellor"],
  );

  const passingStatusAndRoles = passingStatuses.flatMap((status) =>
    passingRoles.map((role) => ({ status, role })),
  );

  let createAssessment: CreateAssessment;
  let uow: InMemoryUnitOfWork;
  let timeGateway: CustomTimeGateway;

  beforeEach(() => {
    uow = createInMemoryUow();
    timeGateway = new CustomTimeGateway();
    createAssessment = makeCreateAssessment({
      uowPerformer: new InMemoryUowPerformer(uow),
      deps: {
        createNewEvent: makeCreateNewEvent({
          timeGateway,
          uuidGenerator: new TestUuidGenerator(),
        }),
        timeGateway,
      },
    });

    uow.conventionRepository.setConventions([validatedConvention]);
    uow.agencyRepository.agencies = [
      toAgencyWithRights(agency, {
        [counsellor.id]: { isNotifiedByEmail: true, roles: ["counsellor"] },
        [validator.id]: { isNotifiedByEmail: true, roles: ["validator"] },
      }),
    ];
    uow.userRepository.users = [
      counsellor,
      validator,
      userWithoutRoleOnConvention,
      backOfficeAdmin,
    ];
  });

  describe("wrong path", () => {
    it("throws forbidden if no magicLink payload is provided", async () => {
      await expectPromiseToFailWithError(
        createAssessment.execute(assessment, undefined),
        new ForbiddenError("No magic link provided"),
      );
    });

    it("throws forbidden if magicLink payload has a different applicationId linked", async () => {
      await expectPromiseToFailWithError(
        createAssessment.execute(assessment, {
          ...tutorPayload,
          applicationId: "otherId",
        }),
        errors.assessment.conventionIdMismatch(),
      );
    });

    it("throws not found if provided conventionId does not match any in DB", async () => {
      const notFoundId = "not-found-id";
      await expectPromiseToFailWithError(
        createAssessment.execute(
          { ...assessment, conventionId: notFoundId },
          { ...tutorPayload, applicationId: notFoundId },
        ),
        errors.convention.notFound({ conventionId: notFoundId }),
      );
    });

    it("throws ConflictError if the assessment already exists for the Convention", async () => {
      uow.assessmentRepository.assessments = [
        {
          ...assessment,
          _entityName: "Assessment",
          numberOfHoursActuallyMade: validatedConvention.schedule.totalHours,
        },
      ];
      await expectPromiseToFailWithError(
        createAssessment.execute(assessment, tutorPayload),
        errors.assessment.alreadyExist(assessment.conventionId),
      );
    });

    it("throws bad request if the last day of presence is before the convention start", async () => {
      const partiallyCompletedAssessment: AssessmentDto = {
        conventionId: validatedConvention.id,
        status: "PARTIALLY_COMPLETED",
        lastDayOfPresence: subDays(
          new Date(validatedConvention.dateStart),
          1,
        ).toISOString(),
        numberOfMissedHours: 2.5,
        endedWithAJob: false,
        establishmentFeedback: "Ca c'est bien passé",
        establishmentAdvices: "mon conseil",
        beneficiaryAgreement: null,
        beneficiaryFeedback: null,
        signedAt: null,
        createdAt: new Date("2025-01-01").toISOString(),
      };
      await expectPromiseToFailWithError(
        createAssessment.execute(partiallyCompletedAssessment, tutorPayload),
        errors.assessment.lastDayOfPresenceNotInConventionRange(),
      );
    });

    it("throws bad request if the last day of presence is after the convention end", async () => {
      const partiallyCompletedAssessment: AssessmentDto = {
        conventionId: validatedConvention.id,
        status: "PARTIALLY_COMPLETED",
        lastDayOfPresence: addDays(
          new Date(validatedConvention.dateEnd),
          1,
        ).toISOString(),
        numberOfMissedHours: 2.5,
        endedWithAJob: false,
        establishmentFeedback: "Ca c'est bien passé",
        establishmentAdvices: "mon conseil",
        beneficiaryAgreement: null,
        beneficiaryFeedback: null,
        signedAt: null,
        createdAt: new Date("2025-01-01").toISOString(),
      };
      await expectPromiseToFailWithError(
        createAssessment.execute(partiallyCompletedAssessment, tutorPayload),
        errors.assessment.lastDayOfPresenceNotInConventionRange(),
      );
    });

    it("throws bad request if contract start date is before immersion start", async () => {
      const assessmentWithInvalidContractDate: AssessmentDto = {
        conventionId: validatedConvention.id,
        status: "COMPLETED",
        endedWithAJob: true,
        typeOfContract: "CDI",
        contractStartDate: subDays(
          new Date(validatedConvention.dateStart),
          1,
        ).toISOString(),
        establishmentFeedback: "Ca c'est bien passé",
        establishmentAdvices: "mon conseil",
        beneficiaryAgreement: null,
        beneficiaryFeedback: null,
        signedAt: null,
        createdAt: new Date("2025-01-01").toISOString(),
      };
      await expectPromiseToFailWithError(
        createAssessment.execute(
          assessmentWithInvalidContractDate,
          tutorPayload,
        ),
        errors.assessment.contractStartDateBeforeImmersionStart({
          immersionDateStart: validatedConvention.dateStart,
        }),
      );
    });

    it("throws bad request if number of missed hours exceeds scheduled hours in the presence period", async () => {
      const partiallyCompletedAssessment: AssessmentDto = {
        conventionId: validatedConvention.id,
        status: "PARTIALLY_COMPLETED",
        lastDayOfPresence: subDays(
          new Date(validatedConvention.dateEnd),
          1,
        ).toISOString(),
        numberOfMissedHours: 10_000,
        endedWithAJob: false,
        establishmentFeedback: "Ca c'est bien passé",
        establishmentAdvices: "mon conseil",
        beneficiaryAgreement: null,
        beneficiaryFeedback: null,
        signedAt: null,
        createdAt: new Date("2025-01-01").toISOString(),
      };

      await expectPromiseToFailWithError(
        createAssessment.execute(partiallyCompletedAssessment, tutorPayload),
        errors.assessment.numberOfMissedHoursExceedsScheduled(),
      );
    });

    it.each(failingStatuses.map((status) => ({ status })))(
      "throws bad request if the Convention status is '$status'",
      async ({ status }) => {
        const convention = new ConventionDtoBuilder(validatedConvention)
          .withStatus(status)
          .build();
        uow.conventionRepository.setConventions([convention]);

        await expectPromiseToFailWithError(
          createAssessment.execute(assessment, tutorPayload),
          errors.assessment.badStatus(status),
        );
      },
    );

    it.each(failingRoles)(
      "throws forbidden if the jwt role is '%s'",
      async (role) => {
        await expectPromiseToFailWithError(
          createAssessment.execute(assessment, {
            applicationId: validatedConvention.id,
            emailHash: makeHashByRolesForTest(
              validatedConvention,
              counsellor,
              validator,
            )[role],
            role: role as ConventionRole,
          }),
          errors.assessment.forbidden("CreateAssessment"),
        );
      },
    );

    it("throws forbidden if user doesnt have allowed assessment role on convention", async () => {
      await expectPromiseToFailWithError(
        createAssessment.execute(
          assessment,

          {
            userId: userWithoutRoleOnConvention.id,
          },
        ),
        errors.assessment.forbidden("CreateAssessment"),
      );
    });

    it.each(["counsellor", "validator"] satisfies Role[])(
      "throw forbidden if the jwt role is '%s' the user is not notified on agency rights",
      async (role) => {
        uow.agencyRepository.agencies = [
          toAgencyWithRights(agency, {
            [counsellor.id]: {
              isNotifiedByEmail: false,
              roles: ["counsellor"],
            },
            [validator.id]: {
              isNotifiedByEmail: false,
              roles: ["validator"],
            },
          }),
        ];
        await expectPromiseToFailWithError(
          createAssessment.execute(assessment, {
            ...tutorPayload,
            emailHash: makeHashByRolesForTest(
              validatedConvention,
              counsellor,
              validator,
            )[role],
            role,
          }),
          errors.assessment.forbidden("CreateAssessment"),
        );
      },
    );
  });

  describe("Right paths", () => {
    it.each(passingStatusAndRoles)(
      "should save the Assessment if Convention has status $status and role with email hash in payload is $role",
      async ({ status, role }) => {
        const convention = new ConventionDtoBuilder(validatedConvention)
          .withStatus(status)
          .build();
        uow.conventionRepository.setConventions([convention]);

        await createAssessment.execute(assessment, {
          ...tutorPayload,
          role,
          emailHash: makeHashByRolesForTest(convention, counsellor, validator)[
            role
          ],
        });

        expectArraysToEqual(uow.assessmentRepository.assessments, [
          {
            ...assessment,
            _entityName: "Assessment",
            numberOfHoursActuallyMade: validatedConvention.schedule.totalHours,
            createdBy: assessmentCreatorThroughMagicLinkByRole[role],
          },
        ]);
      },
    );

    it("should save the Assessment when user is validator on convention", async () => {
      uow.conventionRepository.setConventions([validatedConvention]);

      await createAssessment.execute(assessment, {
        userId: validator.id,
      });

      expectArraysToEqual(uow.assessmentRepository.assessments, [
        {
          ...assessment,
          _entityName: "Assessment",
          numberOfHoursActuallyMade: validatedConvention.schedule.totalHours,
          createdBy: makeUserAssessmentCreator("validator", validator),
        },
      ]);
    });

    it("should save the Assessment when user is counsellor on convention", async () => {
      uow.conventionRepository.setConventions([validatedConvention]);

      await createAssessment.execute(assessment, {
        userId: counsellor.id,
      });

      expectArraysToEqual(uow.assessmentRepository.assessments, [
        {
          ...assessment,
          _entityName: "Assessment",
          numberOfHoursActuallyMade: validatedConvention.schedule.totalHours,
          createdBy: makeUserAssessmentCreator("counsellor", counsellor),
        },
      ]);
    });

    it("should save the Assessment when user is both establishment tutor and representative on convention", async () => {
      const { firstName, lastName, email, phone } =
        validatedConvention.establishmentTutor;
      const conventionWithTutorAsRepresentative = new ConventionDtoBuilder(
        validatedConvention,
      )
        .withEstablishmentRepresentative({
          ...validatedConvention.signatories.establishmentRepresentative,
          firstName,
          lastName,
          email,
          phone,
        })
        .build();
      const tutorAndRepresentative = new ConnectedUserBuilder()
        .withId("tutorAndRepresentative")
        .withEmail(email)
        .buildUser();
      uow.conventionRepository.setConventions([
        conventionWithTutorAsRepresentative,
      ]);
      uow.userRepository.users = [
        ...uow.userRepository.users,
        tutorAndRepresentative,
      ];

      await createAssessment.execute(assessment, {
        userId: tutorAndRepresentative.id,
      });

      expectArraysToEqual(uow.assessmentRepository.assessments, [
        {
          ...assessment,
          _entityName: "Assessment",
          numberOfHoursActuallyMade: validatedConvention.schedule.totalHours,
          createdBy: makeUserAssessmentCreator(
            "establishment-tutor",
            tutorAndRepresentative,
          ),
        },
      ]);
    });

    it("should save the Assessment as created by establishment tutor when magic link role is establishment representative who is also tutor", async () => {
      const { firstName, lastName, email, phone } =
        validatedConvention.establishmentTutor;
      const conventionWithTutorAsRepresentative = new ConventionDtoBuilder(
        validatedConvention,
      )
        .withEstablishmentRepresentative({
          ...validatedConvention.signatories.establishmentRepresentative,
          firstName,
          lastName,
          email,
          phone,
        })
        .build();
      uow.conventionRepository.setConventions([
        conventionWithTutorAsRepresentative,
      ]);

      await createAssessment.execute(assessment, {
        applicationId: conventionWithTutorAsRepresentative.id,
        role: "establishment-representative",
        emailHash: makeEmailHash(email),
      });

      expectArraysToEqual(uow.assessmentRepository.assessments, [
        {
          ...assessment,
          _entityName: "Assessment",
          numberOfHoursActuallyMade: validatedConvention.schedule.totalHours,
          createdBy: tutorAssessmentCreator,
        },
      ]);
    });

    it("should create a partially completed assessment with missed hours only (no early end date)", async () => {
      const partiallyCompletedAssessment: AssessmentDto = {
        conventionId: validatedConvention.id,
        status: "PARTIALLY_COMPLETED",
        lastDayOfPresence: validatedConvention.dateEnd,
        numberOfMissedHours: 2,
        endedWithAJob: false,
        establishmentFeedback: "Ca c'est bien passé",
        establishmentAdvices: "mon conseil",
        beneficiaryAgreement: null,
        beneficiaryFeedback: null,
        signedAt: null,
        createdAt: new Date("2025-01-01").toISOString(),
      };

      await createAssessment.execute(
        partiallyCompletedAssessment,
        tutorPayload,
      );

      expectArraysToEqual(uow.assessmentRepository.assessments, [
        {
          ...partiallyCompletedAssessment,
          _entityName: "Assessment",
          numberOfHoursActuallyMade:
            validatedConvention.schedule.totalHours - 2,
          createdBy: tutorAssessmentCreator,
        },
      ]);
    });

    it("should create a partially completed assessment with early end date only (no missed hours)", async () => {
      const conventionDateEnd = new Date("2025-01-24");
      const convention = new ConventionDtoBuilder(validatedConvention)
        .withStatus("ACCEPTED_BY_VALIDATOR")
        .withDateStart(new Date("2025-01-20").toISOString())
        .withDateEnd(conventionDateEnd.toISOString())
        .withSchedule(reasonableSchedule)
        .build();

      const partiallyCompletedAssessment: AssessmentDto = {
        conventionId: validatedConvention.id,
        status: "PARTIALLY_COMPLETED",
        lastDayOfPresence: subDays(conventionDateEnd, 1).toISOString(),
        numberOfMissedHours: 0,
        endedWithAJob: false,
        establishmentFeedback: "Ca c'est bien passé",
        establishmentAdvices: "mon conseil",
        beneficiaryAgreement: null,
        beneficiaryFeedback: null,
        signedAt: null,
        createdAt: new Date("2025-01-01").toISOString(),
      };

      uow.conventionRepository.setConventions([convention]);

      await createAssessment.execute(partiallyCompletedAssessment, {
        ...tutorPayload,
        role: "establishment-tutor",
        emailHash: makeHashByRolesForTest(convention, counsellor, validator)[
          "establishment-tutor"
        ],
      });

      expectArraysToEqual(uow.assessmentRepository.assessments, [
        {
          ...partiallyCompletedAssessment,
          _entityName: "Assessment",
          numberOfHoursActuallyMade: 28,
          createdBy: tutorAssessmentCreator,
        },
      ]);
    });

    it("should create an assessment with correct duration when partially completed", async () => {
      const convention = new ConventionDtoBuilder(validatedConvention)
        .withStatus("ACCEPTED_BY_VALIDATOR")
        .withDateStart(new Date("2025-01-20").toISOString())
        .withDateEnd(new Date("2025-01-24").toISOString())
        .withSchedule(reasonableSchedule)
        .build();

      const partiallyCompletedAssessment: AssessmentDto = {
        conventionId: validatedConvention.id,
        status: "PARTIALLY_COMPLETED",
        lastDayOfPresence: new Date("2025-01-23").toISOString(),
        numberOfMissedHours: 2.5,
        endedWithAJob: false,
        establishmentFeedback: "Ca c'est bien passé",
        establishmentAdvices: "mon conseil",
        beneficiaryAgreement: null,
        beneficiaryFeedback: null,
        signedAt: null,
        createdAt: new Date("2025-01-01").toISOString(),
      };

      uow.conventionRepository.setConventions([convention]);

      await createAssessment.execute(partiallyCompletedAssessment, {
        ...tutorPayload,
        role: "establishment-tutor",
        emailHash: makeHashByRolesForTest(convention, counsellor, validator)[
          "establishment-tutor"
        ],
      });

      expectArraysToEqual(uow.assessmentRepository.assessments, [
        {
          ...partiallyCompletedAssessment,
          _entityName: "Assessment",
          numberOfHoursActuallyMade: 25.5, // 4 days * 7 hours - 2.5 missed hours
          createdBy: tutorAssessmentCreator,
        },
      ]);
    });

    it("should dispatch an AssessmentCreated event", async () => {
      await createAssessment.execute(assessment, tutorPayload);

      expectObjectInArrayToMatch(uow.outboxRepository.events, [
        {
          topic: "AssessmentCreated",
          payload: {
            convention: validatedConvention,
            assessment,
            triggeredBy: {
              kind: "convention-magic-link",
              role: tutorPayload.role,
            },
          },
        },
      ]);
    });
  });

  describe("archived convention", () => {
    it("throws when enableRequestArchivedConvention is active and caller is not admin", async () => {
      const archivedDateEnd = subMonths(
        timeGateway.now(),
        defaultMonthsThresholdForConventionsListing + 1,
      );
      const archivedConvention = new ConventionDtoBuilder(validatedConvention)
        .withDateSubmission(subDays(archivedDateEnd, 10).toISOString())
        .withDateStart(subDays(archivedDateEnd, 4).toISOString())
        .withDateEnd(archivedDateEnd.toISOString())
        .withSchedule(reasonableSchedule)
        .build();
      uow.conventionRepository.setConventions([archivedConvention]);
      uow.featureFlagRepository.featureFlags = {
        enableRequestArchivedConvention: makeBooleanFeatureFlag(true),
      };

      await expectPromiseToFailWithError(
        createAssessment.execute(
          { ...assessment, conventionId: archivedConvention.id },
          {
            ...tutorPayload,
            applicationId: archivedConvention.id,
          },
        ),
        errors.convention.archived({ conventionId: archivedConvention.id }),
      );
    });
  });
});
