import {
  AgencyDtoBuilder,
  ConnectedUserBuilder,
  type ConventionDomainJwtPayload,
  ConventionDtoBuilder,
  type ConventionId,
  errors,
  expectObjectInArrayToMatch,
  expectPromiseToFailWithError,
  ForbiddenError,
  validSignatoryRoles,
} from "shared";
import { toAgencyWithRights } from "../../../utils/agency";
import { createConventionMagicLinkPayload } from "../../../utils/jwt";
import { makeCreateNewEvent } from "../../core/events/ports/EventBus";
import { CustomTimeGateway } from "../../core/time-gateway/adapters/CustomTimeGateway";
import { createInMemoryUow } from "../../core/unit-of-work/adapters/createInMemoryUow";
import { InMemoryUowPerformer } from "../../core/unit-of-work/adapters/InMemoryUowPerformer";
import { TestUuidGenerator } from "../../core/uuid-generator/adapters/UuidGeneratorImplementations";
import { makeUpdateConventionStatus } from "./UpdateConventionStatus";
import {
  acceptStatusTransitionTests,
  conventionWithAgencyOneStepValidationId,
  conventionWithAgencyTwoStepsValidationId,
  executeUpdateConventionStatusUseCase,
  rejectStatusTransitionTests,
  setupInitialState,
} from "./UpdateConventionStatus.testHelpers";

describe("UpdateConventionStatus", () => {
  describe("* -> READY_TO_SIGN transition", () => {
    acceptStatusTransitionTests({
      updateStatusParams: {
        status: "READY_TO_SIGN",
        conventionId: conventionWithAgencyOneStepValidationId,
      },
      expectedDomainTopic: null,
      allowedMagicLinkRoles: [
        ...validSignatoryRoles,
        "validator",
        "counsellor",
      ],
      allowedConnectedUsers: [
        "userWithRoleEstablishmentRepresentative",
        "userWithRoleBeneficiary",
        "userWithRoleBackofficeAdmin",
        "userWithRoleBackofficeAdminAndValidator",
        "userWithRoleValidator",
      ],
      allowedInitialStatuses: [
        "READY_TO_SIGN",
        "PARTIALLY_SIGNED",
        "IN_REVIEW",
        "ACCEPTED_BY_COUNSELLOR",
      ],
    });
    rejectStatusTransitionTests({
      updateStatusParams: {
        status: "READY_TO_SIGN",
        conventionId: conventionWithAgencyOneStepValidationId,
      },
      allowedMagicLinkRoles: [
        ...validSignatoryRoles,
        "validator",
        "counsellor",
      ],
      allowedConnectedUsers: [
        "userWithRoleEstablishmentRepresentative",
        "userWithRoleBeneficiary",
        "userWithRoleBackofficeAdmin",
        "userWithRoleBackofficeAdminAndValidator",
        "userWithRoleCounsellor",
        "userWithRoleValidator",
      ],
      allowedInitialStatuses: [
        "READY_TO_SIGN",
        "PARTIALLY_SIGNED",
        "IN_REVIEW",
        "ACCEPTED_BY_COUNSELLOR",
      ],
    });
  });

  describe("* -> PARTIALLY_SIGNED transition", () => {
    acceptStatusTransitionTests({
      updateStatusParams: {
        status: "PARTIALLY_SIGNED",
        conventionId: conventionWithAgencyOneStepValidationId,
      },
      expectedDomainTopic: "ConventionPartiallySigned",
      allowedMagicLinkRoles: validSignatoryRoles,
      allowedConnectedUsers: [
        "userWithRoleEstablishmentRepresentative",
        "userWithRoleBeneficiary",
      ],
      allowedInitialStatuses: ["READY_TO_SIGN", "PARTIALLY_SIGNED"],
    });
    rejectStatusTransitionTests({
      updateStatusParams: {
        status: "PARTIALLY_SIGNED",
        conventionId: conventionWithAgencyOneStepValidationId,
      },
      allowedMagicLinkRoles: validSignatoryRoles,
      allowedConnectedUsers: [
        "userWithRoleEstablishmentRepresentative",
        "userWithRoleBeneficiary",
      ],
      allowedInitialStatuses: ["READY_TO_SIGN", "PARTIALLY_SIGNED"],
    });
  });

  describe("* -> ACCEPTED_BY_COUNSELLOR transition", () => {
    const dateApproval = new Date("2021-09-01T10:10:00.000Z");
    acceptStatusTransitionTests({
      updateStatusParams: {
        status: "ACCEPTED_BY_COUNSELLOR",
        conventionId: conventionWithAgencyTwoStepsValidationId,
        firstname: "Counsellor Firstname",
        lastname: "Counsellor Lastname",
      },
      updatedFields: {
        dateApproval: dateApproval.toISOString(),
        validators: {
          agencyCounsellor: {
            firstname: "Counsellor Firstname",
            lastname: "Counsellor Lastname",
          },
        },
      },
      expectedDomainTopic: "ConventionAcceptedByCounsellor",
      allowedMagicLinkRoles: ["counsellor"],
      allowedConnectedUsers: ["userWithRoleCounsellor"],
      allowedInitialStatuses: ["IN_REVIEW"],
    });
    rejectStatusTransitionTests({
      updateStatusParams: {
        status: "ACCEPTED_BY_COUNSELLOR",
        conventionId: conventionWithAgencyOneStepValidationId,
        firstname: "Counsellor Firstname",
        lastname: "Counsellor Lastname",
      },
      allowedMagicLinkRoles: ["counsellor"],
      allowedConnectedUsers: ["userWithRoleCounsellor"],
      allowedInitialStatuses: ["IN_REVIEW"],
    });
  });

  describe("* -> ACCEPTED_BY_VALIDATOR transition", () => {
    const validationDate = new Date("2022-01-01T12:00:00.000");
    acceptStatusTransitionTests({
      updateStatusParams: {
        status: "ACCEPTED_BY_VALIDATOR",
        conventionId: conventionWithAgencyOneStepValidationId,
        firstname: "Validator Firstname",
        lastname: "Validator Lastname",
      },
      expectedDomainTopic: "ConventionAcceptedByValidator",
      allowedMagicLinkRoles: ["validator"],
      allowedConnectedUsers: [
        "userWithRoleValidator",
        "userWithRoleBackofficeAdminAndValidator",
      ],
      allowedInitialStatuses: ["IN_REVIEW", "ACCEPTED_BY_COUNSELLOR"],
      updatedFields: {
        dateValidation: validationDate.toISOString(),
        validators: {
          agencyValidator: {
            firstname: "Validator Firstname",
            lastname: "Validator Lastname",
          },
        },
      },
      nextDate: validationDate,
    });
    rejectStatusTransitionTests({
      updateStatusParams: {
        status: "ACCEPTED_BY_VALIDATOR",
        conventionId: conventionWithAgencyOneStepValidationId,
        firstname: "Validator Firstname",
        lastname: "Validator Lastname",
      },
      allowedMagicLinkRoles: ["validator"],
      allowedConnectedUsers: [
        "userWithRoleValidator",
        "userWithRoleBackofficeAdminAndValidator",
      ],
      allowedInitialStatuses: ["IN_REVIEW", "ACCEPTED_BY_COUNSELLOR"],
    });

    describe("When agency have two steps validation", () => {
      acceptStatusTransitionTests({
        updateStatusParams: {
          status: "ACCEPTED_BY_VALIDATOR",
          conventionId: conventionWithAgencyTwoStepsValidationId,
          firstname: "Validator Firstname",
          lastname: "Validator Lastname",
        },
        expectedDomainTopic: "ConventionAcceptedByValidator",
        allowedMagicLinkRoles: ["validator"],
        allowedConnectedUsers: [
          "userWithRoleValidator",
          "userWithRoleBackofficeAdminAndValidator",
        ],
        allowedInitialStatuses: ["ACCEPTED_BY_COUNSELLOR"],
        updatedFields: {
          dateValidation: validationDate.toISOString(),
          validators: {
            agencyValidator: {
              firstname: "Validator Firstname",
              lastname: "Validator Lastname",
            },
          },
        },
        nextDate: validationDate,
      });

      it("rejects ACCEPTED_BY_VALIDATOR from IN_REVIEW when counsellor validation is required", async () => {
        const {
          updateConventionStatusUseCase,
          conventionRepository,
          timeGateway,
        } = setupInitialState({
          initialStatus: "IN_REVIEW",
          conventionId: conventionWithAgencyTwoStepsValidationId,
        });

        await expectPromiseToFailWithError(
          executeUpdateConventionStatusUseCase({
            jwtPayload: createConventionMagicLinkPayload({
              id: conventionWithAgencyTwoStepsValidationId,
              role: "validator",
              email: "",
              now: timeGateway.now(),
            }),
            updateStatusParams: {
              status: "ACCEPTED_BY_VALIDATOR",
              conventionId: conventionWithAgencyTwoStepsValidationId,
              firstname: "Validator Firstname",
              lastname: "Validator Lastname",
            },
            updateConventionStatusUseCase,
            conventionRepository,
          }),
          new ForbiddenError(
            `Vous ne pouvez pas valider la convention: '${conventionWithAgencyTwoStepsValidationId}', elle doit d'abord être revue et marquée comme éligible par un conseiller.`,
          ),
        );
      });

      it("keeps date approval when going to status ACCEPTED_BY_VALIDATOR", async () => {
        const { uow, updateConventionStatusUseCase } =
          prepareUseCaseForStandAloneTests();
        const user = new ConnectedUserBuilder()
          .withEmail("validator@mail.com")
          .buildUser();
        const agency = toAgencyWithRights(new AgencyDtoBuilder().build(), {
          [user.id]: { roles: ["validator"], isNotifiedByEmail: true },
        });
        const dateApproval = new Date("2024-04-29").toISOString();
        const convention = new ConventionDtoBuilder()
          .withStatus("ACCEPTED_BY_COUNSELLOR")
          .withAgencyId(agency.id)
          .withDateApproval(dateApproval)
          .build();

        uow.userRepository.users = [user];
        await uow.agencyRepository.insert(agency);
        uow.conventionRepository.setConventions([convention]);

        const validatorJwtPayload = createConventionMagicLinkPayload({
          id: convention.id,
          role: "validator",
          email: user.email,
          now: new Date(),
        });

        await updateConventionStatusUseCase.execute(
          {
            status: "ACCEPTED_BY_VALIDATOR",
            conventionId: convention.id,
            firstname: "Joe",
            lastname: "Validator",
          },
          validatorJwtPayload,
        );

        expectObjectInArrayToMatch(uow.conventionRepository.conventions, [
          {
            status: "ACCEPTED_BY_VALIDATOR",
            dateApproval,
          },
        ]);
      });
    });
  });

  describe("* -> REJECTED transition", () => {
    acceptStatusTransitionTests({
      updateStatusParams: {
        status: "REJECTED",
        statusJustification: "my rejection justification",
        conventionId: conventionWithAgencyOneStepValidationId,
      },
      expectedDomainTopic: "ConventionRejected",
      updatedFields: { statusJustification: "my rejection justification" },
      allowedMagicLinkRoles: ["validator", "counsellor"],
      allowedConnectedUsers: [
        "userWithRoleValidator",
        "userWithRoleBackofficeAdmin",
        "userWithRoleBackofficeAdminAndValidator",
      ],
      allowedInitialStatuses: [
        "PARTIALLY_SIGNED",
        "READY_TO_SIGN",
        "IN_REVIEW",
        "ACCEPTED_BY_COUNSELLOR",
      ],
    });
    acceptStatusTransitionTests({
      updateStatusParams: {
        status: "REJECTED",
        statusJustification: "my rejection justification",
        conventionId: conventionWithAgencyTwoStepsValidationId,
      },
      expectedDomainTopic: "ConventionRejected",
      updatedFields: { statusJustification: "my rejection justification" },
      allowedMagicLinkRoles: ["validator", "counsellor"],
      allowedConnectedUsers: [
        "userWithRoleCounsellor",
        "userWithRoleValidator",
        "userWithRoleBackofficeAdmin",
        "userWithRoleBackofficeAdminAndValidator",
      ],
      allowedInitialStatuses: [
        "PARTIALLY_SIGNED",
        "READY_TO_SIGN",
        "IN_REVIEW",
        "ACCEPTED_BY_COUNSELLOR",
      ],
    });

    acceptStatusTransitionTests({
      updateStatusParams: {
        status: "REJECTED",
        statusJustification: "my rejection justification",
        conventionId: conventionWithAgencyTwoStepsValidationId,
      },
      expectedDomainTopic: "ConventionRejected",
      updatedFields: { statusJustification: "my rejection justification" },
      allowedMagicLinkRoles: ["validator", "counsellor"],
      allowedConnectedUsers: [
        "userWithRoleValidator",
        "userWithRoleCounsellor",
        "userWithRoleBackofficeAdmin",
        "userWithRoleBackofficeAdminAndValidator",
      ],
      allowedInitialStatuses: [
        "PARTIALLY_SIGNED",
        "READY_TO_SIGN",
        "IN_REVIEW",
        "ACCEPTED_BY_COUNSELLOR",
      ],
    });
    rejectStatusTransitionTests({
      updateStatusParams: {
        status: "REJECTED",
        statusJustification: "my rejection justification",
        conventionId: conventionWithAgencyOneStepValidationId,
      },
      allowedMagicLinkRoles: ["validator", "counsellor"],
      allowedConnectedUsers: [
        "userWithRoleValidator",
        "userWithRoleCounsellor",
        "userWithRoleBackofficeAdmin",
        "userWithRoleBackofficeAdminAndValidator",
      ],
      allowedInitialStatuses: [
        "PARTIALLY_SIGNED",
        "READY_TO_SIGN",
        "IN_REVIEW",
        "ACCEPTED_BY_COUNSELLOR",
      ],
    });
  });

  describe("* -> CANCELLED transition", () => {
    acceptStatusTransitionTests({
      updateStatusParams: {
        status: "CANCELLED",
        statusJustification: "Cancelled justification",
        conventionId: conventionWithAgencyTwoStepsValidationId,
      },
      expectedDomainTopic: "ConventionCancelled",
      updatedFields: { statusJustification: "Cancelled justification" },
      allowedMagicLinkRoles: ["validator", "counsellor"],
      allowedConnectedUsers: [
        "userWithRoleValidator",
        "userWithRoleBackofficeAdmin",
        "userWithRoleBackofficeAdminAndValidator",
        "userWithRoleCounsellor",
      ],
      allowedInitialStatuses: ["ACCEPTED_BY_VALIDATOR"],
    });
    rejectStatusTransitionTests({
      updateStatusParams: {
        status: "CANCELLED",
        statusJustification: "Cancelled justification",
        conventionId: conventionWithAgencyTwoStepsValidationId,
      },
      allowedMagicLinkRoles: ["validator", "counsellor"],
      allowedConnectedUsers: [
        "userWithRoleValidator",
        "userWithRoleBackofficeAdmin",
        "userWithRoleBackofficeAdminAndValidator",
        "userWithRoleCounsellor",
      ],
      allowedInitialStatuses: ["ACCEPTED_BY_VALIDATOR"],
    });

    it("fails when trying to cancel a convention with an assessment", async () => {
      const {
        updateConventionStatusUseCase,
        conventionRepository,
        timeGateway,
      } = await setupInitialState({
        initialStatus: "ACCEPTED_BY_VALIDATOR",
        conventionId: conventionWithAgencyOneStepValidationId,
        hasAssessment: true,
      });

      await expectPromiseToFailWithError(
        executeUpdateConventionStatusUseCase({
          jwtPayload: createConventionMagicLinkPayload({
            id: conventionWithAgencyOneStepValidationId,
            email: "test@test.fr",
            role: "validator",
            now: timeGateway.now(),
          }),
          updateStatusParams: {
            status: "CANCELLED",
            conventionId: conventionWithAgencyOneStepValidationId,
            statusJustification: "Cancelled justification",
          },
          updateConventionStatusUseCase,
          conventionRepository,
        }),
        errors.convention.notAllowedToCancelConventionWithAssessment(),
      );
    });
  });

  describe("* -> DEPRECATED transition", () => {
    acceptStatusTransitionTests({
      updateStatusParams: {
        status: "DEPRECATED",
        statusJustification: "my deprecation justification",
        conventionId: conventionWithAgencyTwoStepsValidationId,
      },
      expectedDomainTopic: "ConventionDeprecated",
      updatedFields: { statusJustification: "my deprecation justification" },
      allowedMagicLinkRoles: ["validator", "counsellor"],
      allowedConnectedUsers: [
        "userWithRoleCounsellor",
        "userWithRoleValidator",
        "userWithRoleBackofficeAdmin",
        "userWithRoleBackofficeAdminAndValidator",
      ],
      allowedInitialStatuses: [
        "PARTIALLY_SIGNED",
        "READY_TO_SIGN",
        "IN_REVIEW",
        "ACCEPTED_BY_COUNSELLOR",
      ],
    });
  });

  it("fails for unknown convention ids", async () => {
    const missingConventionId: ConventionId =
      "add5c20e-6dd2-45af-affe-000000000000";

    const { updateConventionStatusUseCase, conventionRepository, timeGateway } =
      await setupInitialState({
        initialStatus: "IN_REVIEW",
        conventionId: missingConventionId,
      });

    await expectPromiseToFailWithError(
      executeUpdateConventionStatusUseCase({
        jwtPayload: createConventionMagicLinkPayload({
          id: missingConventionId,
          email: "test@test.fr",
          role: "validator",
          now: timeGateway.now(),
        }),
        updateStatusParams: {
          status: "ACCEPTED_BY_VALIDATOR",
          conventionId: missingConventionId,
          firstname: "Validator Firstname",
          lastname: "Validator Lastname",
        },
        updateConventionStatusUseCase,
        conventionRepository,
      }),
      errors.convention.notFound({
        conventionId: missingConventionId,
      }),
    );
  });
  it("should throw if convention id in payload and in jwt mismatch", async () => {
    const fakeConventionId: ConventionId =
      "add5c20e-6dd2-45af-affe-000000000000";
    const jwtPayload: ConventionDomainJwtPayload = {
      role: "establishment-representative",
      applicationId: "not-matching-convention-id",
      emailHash: "bad-hash",
    };
    const { updateConventionStatusUseCase, conventionRepository } =
      await setupInitialState({
        initialStatus: "IN_REVIEW",
        conventionId: fakeConventionId,
      });
    await expectPromiseToFailWithError(
      executeUpdateConventionStatusUseCase({
        jwtPayload,
        updateStatusParams: {
          status: "ACCEPTED_BY_VALIDATOR",
          conventionId: fakeConventionId,
          firstname: "Validator Firstname",
          lastname: "Validator Lastname",
        },
        updateConventionStatusUseCase,
        conventionRepository,
      }),
      errors.convention.forbiddenConventionIdMismatch({
        jwtConventionId: jwtPayload.applicationId,
        jwtRole: jwtPayload.role,
        requestedConventionId: fakeConventionId,
      }),
    );
  });
});

const prepareUseCaseForStandAloneTests = () => {
  const uow = createInMemoryUow();
  const timeGateway = new CustomTimeGateway();
  const createNewEvent = makeCreateNewEvent({
    timeGateway,
    uuidGenerator: new TestUuidGenerator(),
  });
  const updateConventionStatusUseCase = makeUpdateConventionStatus({
    uowPerformer: new InMemoryUowPerformer(uow),
    deps: {
      createNewEvent,
      timeGateway,
    },
  });

  return {
    uow,
    updateConventionStatusUseCase,
  };
};
