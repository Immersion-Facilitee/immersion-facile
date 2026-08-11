import {
  AgencyDtoBuilder,
  type AssessmentDto,
  allRoles,
  ConnectedUserBuilder,
  type ConventionDomainJwtPayload,
  ConventionDtoBuilder,
  type ConventionJwtPayload,
  type ConventionRole,
  errors,
  expectPromiseToFailWithError,
  expectToEqual,
  type LegacyAssessmentDto,
  type Role,
  splitCasesBetweenPassingAndFailing,
} from "shared";
import { toAgencyWithRights } from "../../../utils/agency";
import { makeHashByRolesForTest } from "../../../utils/emailHash";
import { makeEmailHash } from "../../../utils/jwt";
import {
  createInMemoryUow,
  type InMemoryUnitOfWork,
} from "../../core/unit-of-work/adapters/createInMemoryUow";
import { InMemoryUowPerformer } from "../../core/unit-of-work/adapters/InMemoryUowPerformer";
import type { AssessmentEntity } from "../entities/AssessmentEntity";
import {
  type GetAssessmentByConventionId,
  makeGetAssessmentByConventionId,
} from "./GetAssessmentByConventionId";

describe("GetAssessmentByConventionId", () => {
  const agency = new AgencyDtoBuilder().build();
  const counsellor = new ConnectedUserBuilder()
    .withId("counsellor")
    .withEmail("counsellor@email.com")
    .buildUser();
  const validator = new ConnectedUserBuilder()
    .withId("validator")
    .withEmail("validator@email.com")
    .buildUser();
  const userWithoutRoleOnConvention = new ConnectedUserBuilder()
    .withId("userWithoutRoleOnConvention")
    .withEmail("userWithoutRoleOnConvention@email.com")
    .buildUser();
  const backOfficeAdmin = new ConnectedUserBuilder()
    .withId("backOfficeAdmin")
    .withEmail("backOfficeAdmin@email.com")
    .withIsAdmin(true)
    .buildUser();
  const agencyAdmin = new ConnectedUserBuilder()
    .withId("agencyAdmin")
    .withEmail("agencyAdmin@email.com")
    .buildUser();
  const agencyViewer = new ConnectedUserBuilder()
    .withId("agencyViewer")
    .withEmail("agencyViewer@email.com")
    .buildUser();
  const convention = new ConventionDtoBuilder().withAgencyId(agency.id).build();
  const beneficiary = new ConnectedUserBuilder()
    .withId("beneficiary")
    .withEmail(convention.signatories.beneficiary.email)
    .buildUser();
  const establishmentTutorPayload: ConventionDomainJwtPayload = {
    applicationId: convention.id,
    role: "establishment-tutor",
    emailHash: makeEmailHash(convention.establishmentTutor.email),
  };
  const assessment: AssessmentDto = {
    conventionId: convention.id,
    status: "COMPLETED",
    endedWithAJob: false,
    establishmentAdvices: "my advices",
    establishmentFeedback: "my feedback",
    beneficiaryAgreement: true,
    beneficiaryFeedback: "my super feedback",
    signedAt: new Date("2025-01-01").toISOString(),
    createdAt: new Date("2025-01-01").toISOString(),
  };
  const [passingRoles, failingRoles] = splitCasesBetweenPassingAndFailing(
    allRoles,
    [
      "establishment-tutor",
      "establishment-representative",
      "validator",
      "counsellor",
      "beneficiary",
    ],
  );

  let getAssessment: GetAssessmentByConventionId;
  let uow: InMemoryUnitOfWork;

  beforeEach(async () => {
    uow = createInMemoryUow();
    getAssessment = makeGetAssessmentByConventionId({
      uowPerformer: new InMemoryUowPerformer(uow),
    });
    uow.conventionRepository.setConventions([convention]);
    uow.agencyRepository.agencies = [
      toAgencyWithRights(agency, {
        [counsellor.id]: { isNotifiedByEmail: true, roles: ["counsellor"] },
        [validator.id]: { isNotifiedByEmail: true, roles: ["validator"] },
        [agencyAdmin.id]: { isNotifiedByEmail: true, roles: ["agency-admin"] },
        [agencyViewer.id]: {
          isNotifiedByEmail: true,
          roles: ["agency-viewer"],
        },
      }),
    ];
    uow.userRepository.users = [
      counsellor,
      validator,
      agencyAdmin,
      agencyViewer,
      beneficiary,
      userWithoutRoleOnConvention,
      backOfficeAdmin,
    ];
    uow.assessmentRepository.assessments = [
      {
        _entityName: "Assessment",
        numberOfHoursActuallyMade: convention.schedule.totalHours,
        ...assessment,
      },
    ];
  });

  describe("Wrong paths", () => {
    it("throws forbidden if no magicLink payload is provided", async () => {
      await expectPromiseToFailWithError(
        getAssessment.execute({ conventionId: convention.id }, undefined),
        errors.user.noJwtProvided(),
      );
    });

    it("throws forbidden if magicLink payload has a different applicationId linked", async () => {
      await expectPromiseToFailWithError(
        getAssessment.execute({ conventionId: convention.id }, {
          applicationId: "otherId",
          role: "establishment-tutor",
        } as ConventionJwtPayload),
        errors.assessment.conventionIdMismatch(),
      );
    });

    it.each(
      failingRoles,
    )("throws forbidden if magicLink role is '%s'", async (role) => {
      await expectPromiseToFailWithError(
        getAssessment.execute(
          { conventionId: convention.id },
          {
            applicationId: convention.id,
            emailHash: makeHashByRolesForTest(
              convention,
              counsellor,
              validator,
            )[role],
            role: role as ConventionRole,
          },
        ),
        errors.assessment.forbidden("GetAssessment"),
      );
    });

    it("throws forbidden if connected user email is not linked to the convention", async () => {
      await expectPromiseToFailWithError(
        getAssessment.execute(
          { conventionId: convention.id },
          {
            userId: userWithoutRoleOnConvention.id,
          },
        ),
        errors.assessment.forbidden("GetAssessment"),
      );
    });

    it.each([
      "counsellor",
      "validator",
    ] satisfies Role[])("throw forbidden if the jwt role is '%s' the user is not notified on agency rights", async (role) => {
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
        getAssessment.execute(
          { conventionId: convention.id },
          {
            ...establishmentTutorPayload,
            emailHash: makeHashByRolesForTest(
              convention,
              counsellor,
              validator,
            )[role],
            role,
          },
        ),
        errors.assessment.forbidden("GetAssessment"),
      );
    });

    it("throw not found error when no assessment exist", async () => {
      uow.assessmentRepository.assessments = [];

      await expectPromiseToFailWithError(
        getAssessment.execute(
          {
            conventionId: convention.id,
          },
          establishmentTutorPayload,
        ),
        errors.assessment.notFound(convention.id),
      );
    });
  });

  describe("Right paths", () => {
    describe("with magic link", () => {
      it.each(
        passingRoles,
      )("get existing assessment with role '%s'", async (role) => {
        expectToEqual(
          await getAssessment.execute(
            {
              conventionId: convention.id,
            },
            {
              ...establishmentTutorPayload,
              role,
              emailHash: makeHashByRolesForTest(
                convention,
                counsellor,
                validator,
              )[role],
            },
          ),
          assessment,
        );
      });
    });

    describe("with connected user", () => {
      it("get existing assessment if user is beneficiary", async () => {
        expectToEqual(
          await getAssessment.execute(
            { conventionId: convention.id },
            {
              userId: beneficiary.id,
            },
          ),
          assessment,
        );
      });

      it("get existing assessment if user is validator", async () => {
        uow.conventionRepository.setConventions([convention]);

        expectToEqual(
          await getAssessment.execute(
            { conventionId: convention.id },
            {
              userId: validator.id,
            },
          ),
          assessment,
        );
      });

      it("get existing assessment if user is counsellor", async () => {
        uow.conventionRepository.setConventions([convention]);

        expectToEqual(
          await getAssessment.execute(
            { conventionId: convention.id },
            {
              userId: counsellor.id,
            },
          ),
          assessment,
        );
      });

      it("get existing assessment if user is back-office admin", async () => {
        uow.conventionRepository.setConventions([convention]);

        expectToEqual(
          await getAssessment.execute(
            { conventionId: convention.id },
            {
              userId: backOfficeAdmin.id,
            },
          ),
          assessment,
        );
      });

      it("get existing assessment if user is agency-admin", async () => {
        uow.conventionRepository.setConventions([convention]);

        expectToEqual(
          await getAssessment.execute(
            { conventionId: convention.id },
            {
              userId: agencyAdmin.id,
            },
          ),
          assessment,
        );
      });

      it("get existing assessment if user is agency-viewer", async () => {
        uow.conventionRepository.setConventions([convention]);

        expectToEqual(
          await getAssessment.execute(
            { conventionId: convention.id },
            {
              userId: agencyViewer.id,
            },
          ),
          assessment,
        );
      });
    });

    it("can also get an assessment with legacy format", async () => {
      const legacyAssessment: LegacyAssessmentDto = {
        status: "FINISHED",
        conventionId: convention.id,
        establishmentFeedback: "this is my feedback",
        createdAt: new Date("2023-03-11").toISOString(),
      };
      const assessmentEntity: AssessmentEntity = {
        _entityName: "Assessment",
        ...legacyAssessment,
        numberOfHoursActuallyMade: 0,
      };
      uow.assessmentRepository.assessments = [assessmentEntity];

      const assessment = await getAssessment.execute(
        { conventionId: convention.id },
        {
          role: "validator",
          applicationId: convention.id,
          emailHash: makeHashByRolesForTest(convention, counsellor, validator)
            .validator,
        },
      );

      expectToEqual(assessment, legacyAssessment);
    });
  });
});
