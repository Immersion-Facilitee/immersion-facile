import { values } from "ramda";
import {
  AgencyDtoBuilder,
  allRoles,
  type BadRequestError,
  type ConventionDto,
  ConventionDtoBuilder,
  type ConventionId,
  type ConventionRelatedJwtPayload,
  type ConventionRole,
  type ConventionStatus,
  conventionStatuses,
  type Email,
  errors,
  expectPromiseToFailWithError,
  expectToEqual,
  getConventionManageAllowedRoles,
  splitCasesBetweenPassingAndFailing,
  toAgencyDtoForAgencyUsersAndAdmins,
  type UnauthorizedError,
  type UpdateConventionStatusRequestDto,
  type UserWithAdminRights,
  type UserWithRights,
} from "shared";
import { toAgencyWithRights } from "../../../utils/agency";
import { createConventionMagicLinkPayload } from "../../../utils/jwt";

import { InMemoryOutboxQueries } from "../../core/events/adapters/InMemoryOutboxQueries";
import type { InMemoryOutboxRepository } from "../../core/events/adapters/InMemoryOutboxRepository";
import type { DomainTopic, TriggeredBy } from "../../core/events/events";
import {
  makeCreateNewEvent,
  type NarrowEvent,
} from "../../core/events/ports/EventBus";
import { CustomTimeGateway } from "../../core/time-gateway/adapters/CustomTimeGateway";
import { createInMemoryUow } from "../../core/unit-of-work/adapters/createInMemoryUow";
import { InMemoryUowPerformer } from "../../core/unit-of-work/adapters/InMemoryUowPerformer";
import { TestUuidGenerator } from "../../core/uuid-generator/adapters/UuidGeneratorImplementations";
import type { InMemoryConventionRepository } from "../adapters/InMemoryConventionRepository";
import {
  makeUpdateConventionStatus,
  type UpdateConventionStatus,
} from "./UpdateConventionStatus";

const allConnectedTestUsers = [
  "userWithRoleToReview",
  "userWithRoleCounsellor",
  "userWithRoleValidator",
  "userWithRoleAgencyAdmin",
  "userWithRoleEstablishmentRepresentative",
  "userWithRoleBeneficiary",
  "userWithRoleBackofficeAdmin",
  "userWithRoleBackofficeAdminAndValidator",
] as const;

type ConnectedTestUser = (typeof allConnectedTestUsers)[number];

const establishmentRepEmail: Email = "establishmentrep@email.com";
const beneficiaryEmail: Email = "beneficiary@email.fr";

const userWithRoleBackofficeAdmin: UserWithAdminRights = {
  email: "userWithRoleBackofficeAdmin@mail.com",
  id: "userWithRoleBackofficeAdmin",
  firstName: "userWithRoleBackofficeAdmin",
  lastName: "BackofficeAdmin",
  proConnect: {
    externalId: "userWithRoleBackOfficeAdmin-external-id",
    siret: "000001111122222",
  },
  createdAt: new Date().toISOString(),
  preventToDelete: false,
  isBackofficeAdmin: true,
};

const userWithRoleToReview: UserWithAdminRights = {
  email: "userWithRoleToReview@mail.com",
  firstName: "userWithRoleToReview",
  id: "userWithRoleToReview",
  lastName: "ToReview",
  proConnect: {
    externalId: "userWithRoleToReview-external-id",
    siret: "000001111122222",
  },
  createdAt: new Date().toISOString(),
  preventToDelete: false,
};
const userWithRoleCounsellor: UserWithAdminRights = {
  email: "userWithRoleCounsellor@mail.com",
  firstName: "userWithRoleCounsellor",
  id: "userWithRoleCounsellor",
  lastName: "Consellor",
  proConnect: {
    externalId: "userWithRoleCounsellor-external-id",
    siret: "000001111122222",
  },
  createdAt: new Date().toISOString(),
  preventToDelete: false,
};

const userWithRoleValidator: UserWithAdminRights = {
  email: "userWithRoleValidator@mail.com",
  firstName: "userWithRoleValidator",
  id: "userWithRoleValidator",
  lastName: "Validator",
  proConnect: {
    externalId: "userWithRoleValidator-external-id",
    siret: "000001111122222",
  },
  createdAt: new Date().toISOString(),
  preventToDelete: false,
};

const userWithRoleBackofficeAdminAndValidator: UserWithAdminRights = {
  email: "userWithRoleBackofficeAdminAndValidator@mail.com",
  firstName: "userWithRoleBackofficeAdminAndValidator",
  id: "userWithRoleBackofficeAdminAndValidator",
  lastName: "Validator",
  proConnect: {
    externalId: "userWithRoleBackofficeAdminAndValidator-external-id",
    siret: "000001111122222",
  },
  createdAt: new Date().toISOString(),
  preventToDelete: false,
};
const userWithRoleAgencyAdmin: UserWithAdminRights = {
  email: "userWithRoleAgencyAdmin@mail.com",
  firstName: "userWithRoleAgencyAdmin",
  id: "userWithRoleAgencyAdmin",
  lastName: "Owner",
  proConnect: {
    externalId: "userWithRoleAgencyAdmin-external-id",
    siret: "000001111122222",
  },
  createdAt: new Date().toISOString(),
  preventToDelete: false,
};
const userWithRoleEstablishmentRepresentative: UserWithAdminRights = {
  email: establishmentRepEmail,
  firstName: "userWithRoleEstablishmentRepresentativeFirstName",
  id: "userWithRoleEstablishmentRepresentative",
  lastName: "Owner",
  proConnect: {
    externalId: "userWithRoleEstablishmentRepresentative-external-id",
    siret: "000001111122222",
  },
  createdAt: new Date().toISOString(),
  preventToDelete: false,
};
const userWithRoleBeneficiary: UserWithAdminRights = {
  email: beneficiaryEmail,
  firstName: "userWithRoleBeneficiaryFirstName",
  id: "userWithRoleBeneficiary",
  lastName: "Beneficiary",
  proConnect: {
    externalId: "userWithRoleBeneficiary-external-id",
    siret: "000001111122222",
  },
  createdAt: new Date().toISOString(),
  preventToDelete: false,
};
const makeUserIdMapConnectedUser: Record<
  ConnectedTestUser,
  UserWithAdminRights
> = {
  userWithRoleBackofficeAdmin,
  userWithRoleToReview,
  userWithRoleCounsellor,
  userWithRoleValidator,
  userWithRoleBackofficeAdminAndValidator,
  userWithRoleAgencyAdmin,
  userWithRoleEstablishmentRepresentative,
  userWithRoleBeneficiary,
};

const agencyWithoutCounsellorEmail = toAgencyWithRights(
  new AgencyDtoBuilder().withId("agency-without-counsellors").build(),
  {
    [userWithRoleAgencyAdmin.id]: {
      isNotifiedByEmail: false,
      roles: ["agency-admin"],
    },
    [userWithRoleBackofficeAdminAndValidator.id]: {
      isNotifiedByEmail: false,
      roles: ["validator"],
    },
    [userWithRoleValidator.id]: {
      isNotifiedByEmail: false,
      roles: ["validator"],
    },
    [userWithRoleToReview.id]: {
      isNotifiedByEmail: false,
      roles: ["to-review"],
    },
  },
);

const agencyWithCounsellorEmails = toAgencyWithRights(
  new AgencyDtoBuilder().withId("agency-with-two-step-validation").build(),
  {
    [userWithRoleAgencyAdmin.id]: {
      isNotifiedByEmail: false,
      roles: ["agency-admin"],
    },
    [userWithRoleBackofficeAdminAndValidator.id]: {
      isNotifiedByEmail: false,
      roles: ["validator"],
    },
    [userWithRoleValidator.id]: {
      isNotifiedByEmail: false,
      roles: ["validator"],
    },
    [userWithRoleCounsellor.id]: {
      isNotifiedByEmail: true,
      roles: ["counsellor"],
    },
    [userWithRoleToReview.id]: {
      isNotifiedByEmail: false,
      roles: ["to-review"],
    },
  },
);

const makeUserWithRights = (userId: ConnectedTestUser): UserWithRights => {
  const user = makeUserIdMapConnectedUser[userId];
  const agencyRights = [
    agencyWithoutCounsellorEmail,
    agencyWithCounsellorEmails,
  ].flatMap((agency) => {
    const rights = agency.usersRights[userId];
    if (!rights) return [];
    return [
      {
        agency: toAgencyDtoForAgencyUsersAndAdmins(agency, []),
        roles: rights.roles,
        isNotifiedByEmail: rights.isNotifiedByEmail,
      },
    ];
  });
  return { ...user, agencyRights };
};

type ExtractFromDomainTopics<T extends DomainTopic> = Extract<DomainTopic, T>;

type ConventionDomainTopic = ExtractFromDomainTopics<
  | "ConventionSubmittedByBeneficiary"
  | "ConventionPartiallySigned"
  | "ConventionFullySigned"
  | "ConventionAcceptedByCounsellor"
  | "ConventionAcceptedByValidator"
  | "ConventionRejected"
  | "ConventionCancelled"
  | "ConventionDeprecated"
> | null; // null is used to indicate that no domain event should be sent

type SetupInitialStateParams = {
  initialStatus: ConventionStatus;
  conventionId: ConventionId;
  alreadySigned?: boolean;
  hasAssessment?: boolean;
};
export const conventionWithAgencyOneStepValidationId: ConventionId =
  "add5c20e-6dd2-45af-affe-927358005251";
export const conventionWithAgencyTwoStepsValidationId: ConventionId =
  "add5c20e-6dd2-45af-affe-927358005252";

export const setupInitialState = ({
  initialStatus,
  alreadySigned = true,
  conventionId,
  hasAssessment = false,
}: SetupInitialStateParams) => {
  const conventionBuilder = new ConventionDtoBuilder()
    .withId(conventionWithAgencyOneStepValidationId)
    .withStatus(initialStatus)
    .withEstablishmentRepresentativeEmail(establishmentRepEmail)
    .withBeneficiaryEmail(beneficiaryEmail)
    .withAgencyId(agencyWithoutCounsellorEmail.id);

  const originalConvention = alreadySigned
    ? conventionBuilder.build()
    : conventionBuilder.notSigned().build();

  const conventionWithAgencyTwoStepsValidationBuilder =
    new ConventionDtoBuilder()
      .withId(conventionWithAgencyTwoStepsValidationId)
      .withStatus(initialStatus)
      .withEstablishmentRepresentativeEmail(establishmentRepEmail)
      .withBeneficiaryEmail(beneficiaryEmail)
      .withAgencyId(agencyWithCounsellorEmails.id);

  const conventionWithAgencyTwoStepsValidation: ConventionDto = {
    ...(alreadySigned
      ? conventionWithAgencyTwoStepsValidationBuilder.build()
      : conventionWithAgencyTwoStepsValidationBuilder.notSigned().build()),
    dateApproval: undefined,
  };

  const conventionsToTest = {
    [originalConvention.id]: originalConvention,
    [conventionWithAgencyTwoStepsValidation.id]:
      conventionWithAgencyTwoStepsValidation,
  };

  const uow = createInMemoryUow();
  const conventionRepository = uow.conventionRepository;
  const agencyRepository = uow.agencyRepository;
  const outboxRepository = uow.outboxRepository;
  const assessmentRepository = uow.assessmentRepository;
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

  agencyRepository.agencies = [
    agencyWithCounsellorEmails,
    agencyWithoutCounsellorEmail,
  ];
  conventionRepository.setConventions(values(conventionsToTest));
  uow.userRepository.users = values(makeUserIdMapConnectedUser);
  if (hasAssessment) {
    assessmentRepository.assessments = [
      {
        conventionId,
        status: "COMPLETED",
        endedWithAJob: false,
        establishmentFeedback: "osef",
        numberOfHoursActuallyMade: 35,
        establishmentAdvices: "pas de conseil",
        beneficiaryAgreement: null,
        beneficiaryFeedback: null,
        signedAt: null,
        createdAt: new Date().toISOString(),
        _entityName: "Assessment",
      },
    ];
  }

  return {
    originalConvention: conventionsToTest[conventionId],
    updateConventionStatusUseCase,
    conventionRepository,
    outboxRepository,
    timeGateway,
  };
};

type ExecuteUseCaseParamsByUserId = {
  jwtPayload: ConventionRelatedJwtPayload;
  updateStatusParams: UpdateConventionStatusRequestDto;
  updateConventionStatusUseCase: UpdateConventionStatus;
  conventionRepository: InMemoryConventionRepository;
};

export const executeUpdateConventionStatusUseCase = async ({
  jwtPayload,
  updateStatusParams,
  updateConventionStatusUseCase,
  conventionRepository,
}: ExecuteUseCaseParamsByUserId): Promise<ConventionDto> => {
  const response = await updateConventionStatusUseCase.execute(
    updateStatusParams,
    jwtPayload,
  );
  expect(response.id).toEqual(updateStatusParams.conventionId);
  const storedConvention = await conventionRepository.getById(
    updateStatusParams.conventionId,
  );
  if (!storedConvention)
    throw errors.convention.notFound({
      conventionId: updateStatusParams.conventionId,
    });
  return storedConvention;
};

const expectNewEvent = async <T extends DomainTopic>(
  _topic: T,
  expectedEvent: Partial<NarrowEvent<T>>,
  outboxRepository: InMemoryOutboxRepository,
) => {
  const allEvents = await new InMemoryOutboxQueries(
    outboxRepository,
  ).getEventsToPublish();
  expect(allEvents).toHaveLength(1);
  expect(allEvents[0]).toMatchObject(expectedEvent);
};

type TestAcceptNewStatusParams = {
  initialStatus: ConventionStatus;
} & ({ role: ConventionRole } | { userId: ConnectedTestUser });

type UpdatedFields = Partial<
  Omit<
    ConventionDto,
    "isEstablishmentBanned" | "establishmentBannishmentJustification"
  > & {
    establishmentRepresentativeSignedAt: string | undefined;
    beneficiarySignedAt: string | undefined;
  }
>;

type TestAcceptExpectation = {
  updateStatusParams: UpdateConventionStatusRequestDto;
  expectedDomainTopic: ConventionDomainTopic;
  updatedFields?: UpdatedFields;
  nextDate?: Date;
};

const makeTestAcceptsStatusUpdate =
  ({
    updateStatusParams,
    expectedDomainTopic,
    updatedFields = {},
    nextDate,
  }: TestAcceptExpectation) =>
  async (testAcceptNewStatusParams: TestAcceptNewStatusParams) => {
    const {
      originalConvention,
      updateConventionStatusUseCase,
      conventionRepository,
      outboxRepository,
      timeGateway,
    } = await setupInitialState({
      initialStatus: testAcceptNewStatusParams.initialStatus,
      conventionId: updateStatusParams.conventionId,
    });

    if (nextDate) timeGateway.setNextDate(nextDate);

    const jwt: ConventionRelatedJwtPayload =
      "role" in testAcceptNewStatusParams
        ? createConventionMagicLinkPayload({
            id: originalConvention.id,
            role: testAcceptNewStatusParams.role,
            email: "",
            now: new Date(),
          })
        : {
            userId: testAcceptNewStatusParams.userId,
          };

    const triggeredBy: TriggeredBy =
      "role" in testAcceptNewStatusParams
        ? {
            kind: "convention-magic-link",
            role: testAcceptNewStatusParams.role,
          }
        : {
            kind: "connected-user",
            userId: testAcceptNewStatusParams.userId,
          };

    const storedConvention = await executeUpdateConventionStatusUseCase({
      jwtPayload: jwt,
      updateStatusParams,
      updateConventionStatusUseCase,
      conventionRepository,
    });

    const {
      beneficiarySignedAt,
      establishmentRepresentativeSignedAt,
      signatories: _1,
      internshipKind: _2,
      ...restOfUpdatedFields
    } = updatedFields;

    const hasSignedProperty: boolean =
      Object.hasOwn(updatedFields, "beneficiarySignedAt") ||
      Object.hasOwn(updatedFields, "establishementRepresentativeSignedAt");

    const expectedConvention = new ConventionDtoBuilder({
      ...originalConvention,
      ...restOfUpdatedFields,
    })
      .withStatusJustification(
        restOfUpdatedFields.statusJustification
          ? restOfUpdatedFields.statusJustification
          : originalConvention.statusJustification,
      )
      .withStatus(updateStatusParams.status)
      .signedByBeneficiary(
        hasSignedProperty
          ? beneficiarySignedAt
          : originalConvention.signatories.beneficiary.signedAt,
      )
      .signedByEstablishmentRepresentative(
        hasSignedProperty
          ? establishmentRepresentativeSignedAt
          : originalConvention.signatories.establishmentRepresentative.signedAt,
      )
      .build();

    expectToEqual(storedConvention, expectedConvention);

    if (expectedDomainTopic) {
      await expectNewEvent(
        expectedDomainTopic,
        {
          topic: expectedDomainTopic,
          payload: {
            convention: expectedConvention,
            triggeredBy,
          },
        },
        outboxRepository,
      );
    }
  };

type TestRejectsNewStatusParams = {
  initialStatus: ConventionStatus;
  expectedError: UnauthorizedError | BadRequestError;
} & (
  | {
      role: ConventionRole;
    }
  | {
      userId: ConnectedTestUser;
    }
);

type TestRejectsExpectation = {
  updateStatusParams: UpdateConventionStatusRequestDto;
};

const makeTestRejectsStatusUpdate =
  ({ updateStatusParams }: TestRejectsExpectation) =>
  async (testRejectsNewStatusParams: TestRejectsNewStatusParams) => {
    const {
      originalConvention,
      updateConventionStatusUseCase,
      conventionRepository,
      timeGateway,
    } = await setupInitialState({
      initialStatus: testRejectsNewStatusParams.initialStatus,
      conventionId: updateStatusParams.conventionId,
    });
    const jwtPayload: ConventionRelatedJwtPayload =
      "role" in testRejectsNewStatusParams
        ? createConventionMagicLinkPayload({
            id: originalConvention.id,
            email: "",
            role: testRejectsNewStatusParams.role,
            now: timeGateway.now(),
          })
        : {
            userId: testRejectsNewStatusParams.userId,
          };
    await expectPromiseToFailWithError(
      executeUpdateConventionStatusUseCase({
        jwtPayload,
        updateStatusParams,
        updateConventionStatusUseCase,
        conventionRepository,
      }),
      testRejectsNewStatusParams.expectedError,
    );
  };

export const rejectStatusTransitionTests = ({
  allowedMagicLinkRoles,
  allowedInitialStatuses,
  allowedConnectedUsers,
  updateStatusParams,
}: {
  allowedMagicLinkRoles: ConventionRole[];
  allowedInitialStatuses: ConventionStatus[];
  allowedConnectedUsers: ConnectedTestUser[];
  updateStatusParams: UpdateConventionStatusRequestDto;
}) => {
  const [allowedRolesToUpdate, notAllowedRolesToUpdate] =
    splitCasesBetweenPassingAndFailing(allRoles, allowedMagicLinkRoles);
  const [_allowedConnectedUsers, notAllowedConnectedUsers] =
    splitCasesBetweenPassingAndFailing(
      allConnectedTestUsers,
      allowedConnectedUsers,
    );

  const notAllowedConnectedUsersToUpdate = [
    ...notAllowedConnectedUsers,
  ] as ConnectedTestUser[];

  const [authorizedInitialStatuses, forbiddenInitalStatuses] =
    splitCasesBetweenPassingAndFailing(
      conventionStatuses,
      allowedInitialStatuses,
    );

  const someValidInitialStatus = authorizedInitialStatuses[0];
  const someValidRole = allowedRolesToUpdate[0];

  const conventionAgencyId =
    updateStatusParams.conventionId === conventionWithAgencyTwoStepsValidationId
      ? agencyWithCounsellorEmails.id
      : agencyWithoutCounsellorEmail.id;

  const conventionForRoles = new ConventionDtoBuilder()
    .withId(updateStatusParams.conventionId)
    .withStatus(someValidInitialStatus)
    .withEstablishmentRepresentativeEmail(establishmentRepEmail)
    .withBeneficiaryEmail(beneficiaryEmail)
    .withAgencyId(conventionAgencyId)
    .build();

  describe("Rejected", () => {
    const testRejectsStatusUpdate = makeTestRejectsStatusUpdate({
      updateStatusParams,
    });

    if (notAllowedRolesToUpdate.length) {
      it.each(
        notAllowedRolesToUpdate.map((role) => ({ role })),
      )("Rejected from role '$role'", ({ role }) => {
        const userId = "userWithRoleEstablishmentRepresentative";
        return testRejectsStatusUpdate({
          userId,
          role: role as ConventionRole,
          initialStatus: someValidInitialStatus,
          expectedError: errors.convention.badRoleStatusChange({
            roles: [role],
            status: updateStatusParams.status,
            conventionId: updateStatusParams.conventionId,
          }),
        });
      });
    }

    if (notAllowedConnectedUsersToUpdate.length) {
      it.each(
        notAllowedConnectedUsersToUpdate.map((userId) => ({ userId })),
      )("Rejected from userId '$userId'", ({ userId }) => {
        const roles = getConventionManageAllowedRoles(
          conventionForRoles,
          makeUserWithRights(userId),
        );
        return testRejectsStatusUpdate({
          userId,
          initialStatus: someValidInitialStatus,
          expectedError: errors.convention.badRoleStatusChange({
            roles,
            status: updateStatusParams.status,
            conventionId: updateStatusParams.conventionId,
          }),
        });
      });
    }

    it.each(
      forbiddenInitalStatuses.map((status) => ({ status })),
    )("Rejected from status $status", ({ status }) => {
      // this case is handle separately cause we don't have yet another way to test refined transition config
      // TODO refactor this to handle all refine
      const agencyHasTwoStepsAndValidatorTriesToValidate =
        updateStatusParams.status === "ACCEPTED_BY_VALIDATOR" &&
        status === "IN_REVIEW";

      const error = agencyHasTwoStepsAndValidatorTriesToValidate
        ? errors.convention.twoStepsValidationBadStatus({
            targetStatus: updateStatusParams.status,
            conventionId: updateStatusParams.conventionId,
          })
        : errors.convention.badStatusTransition({
            currentStatus: status,
            targetStatus: updateStatusParams.status,
          });

      return testRejectsStatusUpdate({
        role: someValidRole,
        initialStatus: status,
        expectedError: error,
      });
    });
  });
};

export const acceptStatusTransitionTests = ({
  allowedMagicLinkRoles,
  expectedDomainTopic,
  updatedFields = {},
  allowedInitialStatuses,
  allowedConnectedUsers,
  nextDate,
  updateStatusParams,
}: {
  allowedMagicLinkRoles: ConventionRole[];
  expectedDomainTopic: ConventionDomainTopic;
  updatedFields?: UpdatedFields;
  allowedInitialStatuses: ConventionStatus[];
  allowedConnectedUsers: ConnectedTestUser[];
  nextDate?: Date;
  updateStatusParams: UpdateConventionStatusRequestDto;
}) => {
  describe(`Accepted with convention id ${updateStatusParams.conventionId}`, () => {
    const someValidInitialStatus = allowedInitialStatuses[0];
    const someValidRole = allowedMagicLinkRoles[0];

    const testAcceptsStatusUpdate = makeTestAcceptsStatusUpdate({
      updateStatusParams,
      expectedDomainTopic,
      updatedFields,
      nextDate,
    });

    it.each(
      allowedMagicLinkRoles.map((role) => ({ role })),
    )("Accepted from role '$role'", ({ role }) =>
      testAcceptsStatusUpdate({
        role,
        initialStatus: someValidInitialStatus,
      }));

    if (allowedConnectedUsers.length)
      it.each(
        allowedConnectedUsers.map((userId) => ({ userId })),
      )("Accepted from userId '$userId'", ({ userId }) =>
        testAcceptsStatusUpdate({
          userId,
          initialStatus: someValidInitialStatus,
        }));

    it.each(
      allowedInitialStatuses.map((status) => ({ status })),
    )("Accepted from status $status", ({ status }) =>
      testAcceptsStatusUpdate({
        role: someValidRole,
        initialStatus: status,
      }));
  });
};
