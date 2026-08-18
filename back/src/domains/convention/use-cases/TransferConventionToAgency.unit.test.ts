import type {
  AgencyDto,
  AgencyRole,
  ConnectedUser,
  ConnectedUserDomainJwtPayload,
  ConventionRole,
  ConventionStatus,
  Role,
} from "shared";
import {
  AgencyDtoBuilder,
  ConnectedUserBuilder,
  ConventionDtoBuilder,
  conventionStatusesWithoutJustificationNorValidator,
  errors,
  expectArraysToMatch,
  expectObjectInArrayToMatch,
  expectPromiseToFailWithError,
  expectToEqual,
  UserBuilder,
} from "shared";
import { toAgencyWithRights } from "../../../utils/agency";
import { createConventionMagicLinkPayload } from "../../../utils/jwt";
import type { FtConnectImmersionAdvisorDto } from "../../core/authentication/ft-connect/dto/FtConnectAdvisor.dto";
import type { FtConnectUserDto } from "../../core/authentication/ft-connect/dto/FtConnectUserDto";
import {
  type CreateNewEvent,
  makeCreateNewEvent,
} from "../../core/events/ports/EventBus";
import { CustomTimeGateway } from "../../core/time-gateway/adapters/CustomTimeGateway";
import type { TimeGateway } from "../../core/time-gateway/ports/TimeGateway";
import {
  createInMemoryUow,
  type InMemoryUnitOfWork,
} from "../../core/unit-of-work/adapters/createInMemoryUow";
import { InMemoryUowPerformer } from "../../core/unit-of-work/adapters/InMemoryUowPerformer";
import { TestUuidGenerator } from "../../core/uuid-generator/adapters/UuidGeneratorImplementations";
import {
  makeTransferConventionToAgency,
  type TransferConventionToAgency,
} from "./TransferConventionToAgency";

describe("TransferConventionToAgency", () => {
  const conventionId = "add5c20e-6dd2-45af-affe-927358005251";

  const otherAgency = new AgencyDtoBuilder().withId("other-agency-id").build();

  const agency = new AgencyDtoBuilder().build();

  const agencyWithRefersTo = new AgencyDtoBuilder()
    .withId("agency-with-refers-to")
    .withRefersToAgencyInfo({
      refersToAgencyId: agency.id,
      refersToAgencyName: agency.name,
      refersToAgencyContactEmail: agency.contactEmail,
    })
    .build();

  const convention = new ConventionDtoBuilder()
    .withId(conventionId)
    .withStatus("READY_TO_SIGN")
    .withAgencyId(agency.id)
    .signedByEstablishmentRepresentative(undefined)
    .signedByBeneficiary(undefined)
    .withBeneficiarySignedAt(undefined)
    .build();

  const preValidatedConvention = new ConventionDtoBuilder(convention)
    .withAgencyId(agencyWithRefersTo.id)
    .build();

  const notConnectedUser = new UserBuilder()
    .withEmail("validator@mail.com")
    .build();

  const validatorJwtPayload = createConventionMagicLinkPayload({
    id: conventionId,
    role: "validator",
    email: notConnectedUser.email,
    now: new Date(),
  });

  const connectedUserPayload: ConnectedUserDomainJwtPayload = {
    userId: "bcc5c20e-6dd2-45cf-affe-927358005262",
  };

  const connectedUser = new ConnectedUserBuilder()
    .withId(connectedUserPayload.userId)
    .build();

  let createNewEvent: CreateNewEvent;
  let uow: InMemoryUnitOfWork;
  let usecase: TransferConventionToAgency;
  let timeGateway: TimeGateway;

  beforeEach(() => {
    uow = createInMemoryUow();
    timeGateway = new CustomTimeGateway();
    createNewEvent = makeCreateNewEvent({
      timeGateway: timeGateway,
      uuidGenerator: new TestUuidGenerator(),
    });

    usecase = makeTransferConventionToAgency({
      uowPerformer: new InMemoryUowPerformer(uow),
      deps: {
        createNewEvent,
      },
    });
  });

  describe("Wrong paths", () => {
    it.each([
      "REJECTED",
      "CANCELLED",
      "DEPRECATED",
      "ACCEPTED_BY_COUNSELLOR",
      "ACCEPTED_BY_VALIDATOR",
    ] as ConventionStatus[])("should throw an error if convention status %s does not allow convention to be transferred", async (status) => {
      const signedAt = new Date("2024-01-01").toISOString();
      const conventionWithStatus = new ConventionDtoBuilder(convention)
        .withStatus(status)
        .signedByBeneficiary(signedAt)
        .signedByEstablishmentRepresentative(signedAt)
        .build();
      uow.userRepository.users = [notConnectedUser];
      uow.conventionRepository.setConventions([conventionWithStatus]);
      uow.agencyRepository.agencies = [
        toAgencyWithRights(agency, {
          [notConnectedUser.id]: {
            roles: ["validator"],
            isNotifiedByEmail: true,
          },
        }),
        toAgencyWithRights(otherAgency, {}),
      ];

      await expectPromiseToFailWithError(
        usecase.execute(
          {
            conventionId: convention.id,
            agencyId: otherAgency.id,
            justification: "test",
          },
          validatorJwtPayload,
        ),
        errors.convention.transferNotAllowedForStatus({
          status,
        }),
      );

      expectObjectInArrayToMatch(uow.notificationRepository.notifications, []);
      expectObjectInArrayToMatch(uow.outboxRepository.events, []);
    });

    it("throw an error if convention is not found", async () => {
      await expectPromiseToFailWithError(
        usecase.execute(
          {
            conventionId,
            agencyId: otherAgency.id,
            justification: "test",
          },
          validatorJwtPayload,
        ),
        errors.convention.notFound({
          conventionId,
        }),
      );
    });

    it("throw an error if agency is not found", async () => {
      uow.conventionRepository.setConventions([convention]);
      uow.agencyRepository.agencies = [toAgencyWithRights(agency, {})];
      await expectPromiseToFailWithError(
        usecase.execute(
          {
            conventionId,
            agencyId: otherAgency.id,
            justification: "test",
          },
          validatorJwtPayload,
        ),
        errors.agency.notFound({
          agencyId: otherAgency.id,
        }),
      );
    });

    describe("with connected user", () => {
      it("throws not found if connected user does not exist", async () => {
        const unexistingUserPayload: ConnectedUserDomainJwtPayload = {
          userId: "bcc5c20e-6dd2-45cf-affe-927358005267",
        };
        uow.agencyRepository.agencies = [
          toAgencyWithRights(agency, {}),
          toAgencyWithRights(otherAgency, {}),
        ];
        uow.conventionRepository.setConventions([convention]);

        await expectPromiseToFailWithError(
          usecase.execute(
            {
              conventionId,
              agencyId: otherAgency.id,
              justification: "test",
            },
            unexistingUserPayload,
          ),
          errors.user.notFound(unexistingUserPayload),
        );
      });

      it("throws unauthorized if user has no rights on agency", async () => {
        uow.conventionRepository.setConventions([convention]);
        uow.agencyRepository.agencies = [
          toAgencyWithRights(agency, {}),
          toAgencyWithRights(otherAgency, {}),
        ];
        uow.userRepository.users = [connectedUser];

        await expectPromiseToFailWithError(
          usecase.execute(
            {
              conventionId,
              agencyId: otherAgency.id,
              justification: "test",
            },
            connectedUserPayload,
          ),
          errors.convention.transferNotAuthorizedForRole(),
        );
      });

      it.each([
        "agency-viewer",
        "agency-admin",
        "to-review",
      ] as AgencyRole[])("throws unauthorized if user has not enough rights on agency", async (role) => {
        uow.conventionRepository.setConventions([convention]);
        uow.agencyRepository.agencies = [
          toAgencyWithRights(agency, {
            [connectedUserPayload.userId]: {
              roles: [role],
              isNotifiedByEmail: false,
            },
          }),
          toAgencyWithRights(otherAgency, {}),
        ];
        uow.userRepository.users = [connectedUser];

        await expectPromiseToFailWithError(
          usecase.execute(
            {
              conventionId,
              agencyId: otherAgency.id,
              justification: "test",
            },
            connectedUserPayload,
          ),
          errors.convention.transferNotAuthorizedForRole(),
        );
      });

      it("if agencyWithRefersTo, throws an error if validator attempts to change agency", async () => {
        uow.conventionRepository.setConventions([preValidatedConvention]);
        uow.userRepository.users = [connectedUser];
        uow.agencyRepository.agencies = [
          toAgencyWithRights(agency, {
            [connectedUserPayload.userId]: {
              roles: ["validator"],
              isNotifiedByEmail: true,
            },
          }),
          toAgencyWithRights(agencyWithRefersTo, {
            [connectedUserPayload.userId]: {
              roles: ["validator"],
              isNotifiedByEmail: true,
            },
          }),
          toAgencyWithRights(otherAgency, {}),
        ];

        await expectPromiseToFailWithError(
          usecase.execute(
            {
              conventionId: preValidatedConvention.id,
              agencyId: otherAgency.id,
              justification: "test",
            },
            connectedUserPayload,
          ),
          errors.convention.validatorOfAgencyRefersToNotAllowed(),
        );
      });
    });

    describe("with convention jwt payload", () => {
      it("throws bad request if requested convention does not match the one in jwt", async () => {
        const requestedConventionId = "1dd5c20e-6dd2-45af-affe-927358005250";

        await expectPromiseToFailWithError(
          usecase.execute(
            {
              conventionId: requestedConventionId,
              agencyId: otherAgency.id,
              justification: "test",
            },
            validatorJwtPayload,
          ),
          errors.convention.forbiddenConventionIdMismatch({
            jwtConventionId: validatorJwtPayload.applicationId,
            jwtRole: validatorJwtPayload.role,
            requestedConventionId,
          }),
        );
      });

      it.each([
        "to-review",
        "agency-viewer",
        "agency-admin",
      ] as AgencyRole[])("throws bad request if unauthorized if user role is not allowed", async (role) => {
        uow.conventionRepository.setConventions([convention]);
        uow.agencyRepository.agencies = [
          toAgencyWithRights(agency, {}),
          toAgencyWithRights(otherAgency, {}),
        ];
        const jwtPayload = createConventionMagicLinkPayload({
          id: conventionId,
          role: role as ConventionRole,
          email: notConnectedUser.email,
          now: new Date(),
        });

        await expectPromiseToFailWithError(
          usecase.execute(
            {
              conventionId,
              agencyId: otherAgency.id,
              justification: "test",
            },
            jwtPayload,
          ),
          errors.convention.transferNotAuthorizedForRole(),
        );
      });

      it("if agencyWithRefersTo, throws an error if validator attempts to change agency", async () => {
        uow.conventionRepository.setConventions([preValidatedConvention]);
        uow.userRepository.users = [notConnectedUser];
        uow.agencyRepository.agencies = [
          toAgencyWithRights(agency, {
            [notConnectedUser.id]: {
              roles: ["validator"],
              isNotifiedByEmail: true,
            },
          }),
          toAgencyWithRights(agencyWithRefersTo, {
            [notConnectedUser.id]: {
              roles: ["validator"],
              isNotifiedByEmail: true,
            },
          }),
          toAgencyWithRights(otherAgency, {}),
        ];
        const jwtPayload = createConventionMagicLinkPayload({
          id: preValidatedConvention.id,
          role: "validator",
          email: notConnectedUser.email,
          now: new Date(),
        });

        await expectPromiseToFailWithError(
          usecase.execute(
            {
              conventionId: preValidatedConvention.id,
              agencyId: otherAgency.id,
              justification: "test",
            },
            jwtPayload,
          ),
          errors.convention.validatorOfAgencyRefersToNotAllowed(),
        );
      });
    });
  });

  describe("Right paths: transfer of convention", () => {
    describe("with connected user", () => {
      it.each([
        "validator",
        "counsellor",
        "back-office",
      ] as Role[])("triggered by connected-user user with role %s", async (role) => {
        const user: ConnectedUser = {
          ...connectedUser,
          isBackofficeAdmin: role === "back-office",
        };
        uow.conventionRepository.setConventions([convention]);
        uow.userRepository.users = [user];

        uow.agencyRepository.agencies = [
          toAgencyWithRights(
            agency,
            role === "validator" || role === "counsellor"
              ? {
                  [user.id]: {
                    roles: [role],
                    isNotifiedByEmail: true,
                  },
                }
              : {},
          ),
          toAgencyWithRights(otherAgency, {}),
        ];

        await usecase.execute(
          {
            conventionId,
            agencyId: otherAgency.id,
            justification: "change of agency",
          },
          connectedUserPayload,
        );

        const expectedConvention = {
          ...convention,
          agencyId: otherAgency.id,
        };

        expectToEqual(uow.conventionRepository.conventions, [
          expectedConvention,
        ]);
        expectArraysToMatch(uow.outboxRepository.events, [
          {
            topic: "ConventionTransferredToAgency",
            payload: {
              convention: expectedConvention,
              agencyId: otherAgency.id,
              justification: "change of agency",
              previousAgencyId: convention.agencyId,
              shouldNotifyActors: true,
              triggeredBy: {
                kind: "connected-user",
                userId: user.id,
              },
            },
          },
        ]);
      });

      it.each(
        conventionStatusesWithoutJustificationNorValidator,
      )("with status %s", async (status) => {
        const signedAt = new Date("2024-01-01").toISOString();
        const initialConvention = new ConventionDtoBuilder(convention)
          .withStatus(status)
          .signedByBeneficiary(status === "IN_REVIEW" ? signedAt : undefined)
          .signedByEstablishmentRepresentative(
            status === "IN_REVIEW" ? signedAt : undefined,
          )
          .build();
        uow.conventionRepository.setConventions([initialConvention]);
        uow.userRepository.users = [connectedUser];
        uow.agencyRepository.agencies = [
          toAgencyWithRights(agency, {
            [connectedUser.id]: {
              roles: ["validator"],
              isNotifiedByEmail: true,
            },
          }),
          toAgencyWithRights(otherAgency, {}),
        ];

        await usecase.execute(
          {
            conventionId,
            agencyId: otherAgency.id,
            justification: "change of agency",
          },
          connectedUserPayload,
        );

        const expectedConvention = {
          ...initialConvention,
          agencyId: otherAgency.id,
        };

        expectToEqual(uow.conventionRepository.conventions, [
          expectedConvention,
        ]);

        expectArraysToMatch(uow.outboxRepository.events, [
          {
            topic: "ConventionTransferredToAgency",
            payload: {
              agencyId: otherAgency.id,
              convention: expectedConvention,
              justification: "change of agency",
              previousAgencyId: initialConvention.agencyId,
              shouldNotifyActors: true,
              triggeredBy: {
                kind: "connected-user",
                userId: connectedUser.id,
              },
            },
          },
        ]);
      });

      it("triggered by backoffice admin for a convention with agency with refersTo", async () => {
        const backofficeAdmin = new ConnectedUserBuilder()
          .withEmail("counsellor@mail.com")
          .withIsAdmin(true)
          .build();
        const backofficeAdminPayload: ConnectedUserDomainJwtPayload = {
          userId: backofficeAdmin.id,
        };
        const conventionWithAgencyRefersTo = new ConventionDtoBuilder(
          convention,
        )
          .withAgencyId(agencyWithRefersTo.id)
          .build();
        uow.conventionRepository.setConventions([conventionWithAgencyRefersTo]);
        uow.userRepository.users = [backofficeAdmin];
        uow.agencyRepository.agencies = [
          toAgencyWithRights(otherAgency, {}),
          toAgencyWithRights(agencyWithRefersTo, {}),
        ];

        await usecase.execute(
          {
            conventionId: conventionWithAgencyRefersTo.id,
            agencyId: otherAgency.id,
            justification: "change of agency",
          },
          backofficeAdminPayload,
        );

        const expectedConvention = {
          ...conventionWithAgencyRefersTo,
          agencyId: otherAgency.id,
        };

        expectToEqual(uow.conventionRepository.conventions, [
          expectedConvention,
        ]);
        expectArraysToMatch(uow.outboxRepository.events, [
          {
            topic: "ConventionTransferredToAgency",
            payload: {
              agencyId: otherAgency.id,
              convention: expectedConvention,
              justification: "change of agency",
              previousAgencyId: conventionWithAgencyRefersTo.agencyId,
              shouldNotifyActors: true,
              triggeredBy: {
                kind: "connected-user",
                userId: backofficeAdmin.id,
              },
            },
          },
        ]);
      });

      it("counsellor of an agency with refersTo can transfer convention to agency", async () => {
        const counsellor = new UserBuilder()
          .withEmail("counsellor@mail.com")
          .build();
        const counsellorPayload: ConnectedUserDomainJwtPayload = {
          userId: counsellor.id,
        };
        const conventionWithAgencyRefersTo = new ConventionDtoBuilder(
          convention,
        )
          .withAgencyId(agencyWithRefersTo.id)
          .build();
        uow.conventionRepository.setConventions([conventionWithAgencyRefersTo]);
        uow.userRepository.users = [counsellor];
        uow.agencyRepository.agencies = [
          toAgencyWithRights(otherAgency, {}),
          toAgencyWithRights(agencyWithRefersTo, {
            [counsellor.id]: {
              roles: ["counsellor"],
              isNotifiedByEmail: true,
            },
          }),
        ];

        await usecase.execute(
          {
            conventionId: conventionWithAgencyRefersTo.id,
            agencyId: otherAgency.id,
            justification: "change of agency",
          },
          counsellorPayload,
        );

        const expectedConvention = {
          ...conventionWithAgencyRefersTo,
          agencyId: otherAgency.id,
        };

        expectToEqual(uow.conventionRepository.conventions, [
          expectedConvention,
        ]);
        expectArraysToMatch(uow.outboxRepository.events, [
          {
            topic: "ConventionTransferredToAgency",
            payload: {
              agencyId: otherAgency.id,
              convention: expectedConvention,
              justification: "change of agency",
              previousAgencyId: conventionWithAgencyRefersTo.agencyId,
              shouldNotifyActors: true,
              triggeredBy: {
                kind: "connected-user",
                userId: counsellor.id,
              },
            },
          },
        ]);
      });

      describe("federatedIdentity is set in initial convention", () => {
        const userFtExternalId = "92f44bbf-103d-4312-bd74-217c7d79f618";
        const beneficiary: FtConnectUserDto = {
          email: "",
          firstName: "",
          isJobseeker: true,
          lastName: "",
          ftExternalId: userFtExternalId,
          birthdate: "1990-01-01",
        };
        const ftAdvisor: FtConnectImmersionAdvisorDto = {
          firstName: "Jean",
          lastName: "Dupont",
          email: "jean.dupont@pole-emploi.fr",
          type: "PLACEMENT",
        };

        beforeEach(async () => {
          await uow.conventionFranceTravailAdvisorRepository.saveFtUserAndAdvisor(
            {
              advisor: ftAdvisor,
              user: beneficiary,
            },
          );
          await uow.conventionFranceTravailAdvisorRepository.associateConventionAndUserAdvisor(
            conventionId,
            userFtExternalId,
          );

          uow.conventionRepository.setConventions([convention]);
          uow.userRepository.users = [connectedUser];
        });

        it("should keep federated identity if new agency is france-travail", async () => {
          const transferredToAgency: AgencyDto = {
            ...otherAgency,
            kind: "france-travail",
          };

          uow.agencyRepository.agencies = [
            toAgencyWithRights(agency, {
              [connectedUser.id]: {
                roles: ["validator"],
                isNotifiedByEmail: true,
              },
            }),
            toAgencyWithRights(transferredToAgency, {}),
          ];

          await usecase.execute(
            {
              conventionId,
              agencyId: transferredToAgency.id,
              justification: "change of agency",
            },
            connectedUserPayload,
          );

          const expectedConvention = {
            ...convention,
            agencyId: otherAgency.id,
          };

          expectToEqual(uow.conventionRepository.conventions, [
            expectedConvention,
          ]);
          expectToEqual(
            await uow.conventionFranceTravailAdvisorRepository.getByConventionId(
              conventionId,
            ),
            {
              conventionId,
              advisor: ftAdvisor,
              ftExternalId: userFtExternalId,
              _entityName: "ConventionFranceTravailAdvisor",
            },
          );
          expectArraysToMatch(uow.outboxRepository.events, [
            {
              topic: "ConventionTransferredToAgency",
              payload: {
                convention: expectedConvention,
                agencyId: otherAgency.id,
                justification: "change of agency",
                previousAgencyId: convention.agencyId,
                shouldNotifyActors: true,
                triggeredBy: {
                  kind: "connected-user",
                  userId: connectedUser.id,
                },
              },
            },
          ]);
        });

        it("should keep federated identity if new agency is not france-travail", async () => {
          const transferredToAgency: AgencyDto = {
            ...otherAgency,
            kind: "mission-locale",
          };

          uow.agencyRepository.agencies = [
            toAgencyWithRights(agency, {
              [connectedUser.id]: {
                roles: ["validator"],
                isNotifiedByEmail: true,
              },
            }),
            toAgencyWithRights(transferredToAgency, {}),
          ];

          await usecase.execute(
            {
              conventionId,
              agencyId: transferredToAgency.id,
              justification: "change of agency kind",
            },
            connectedUserPayload,
          );

          const expectedConvention = {
            ...convention,
            agencyId: otherAgency.id,
          };

          expectToEqual(uow.conventionRepository.conventions, [
            expectedConvention,
          ]);
          expectToEqual(
            await uow.conventionFranceTravailAdvisorRepository.getByConventionId(
              conventionId,
            ),
            {
              conventionId,
              advisor: ftAdvisor,
              ftExternalId: userFtExternalId,
              _entityName: "ConventionFranceTravailAdvisor",
            },
          );

          expectArraysToMatch(uow.outboxRepository.events, [
            {
              topic: "ConventionTransferredToAgency",
              payload: {
                convention: expectedConvention,
                agencyId: otherAgency.id,
                justification: "change of agency kind",
                previousAgencyId: convention.agencyId,
                shouldNotifyActors: true,
                triggeredBy: {
                  kind: "connected-user",
                  userId: connectedUser.id,
                },
              },
            },
          ]);
        });
      });
    });

    describe("with convention jwt payload", () => {
      it.each([
        "validator",
        "counsellor",
      ] as ConventionRole[])("triggered by jwt role %s", async (role) => {
        uow.conventionRepository.setConventions([convention]);
        uow.userRepository.users = [notConnectedUser];

        uow.agencyRepository.agencies = [
          toAgencyWithRights(
            agency,
            role === "validator" || role === "counsellor"
              ? {
                  [notConnectedUser.id]: {
                    roles: [role],
                    isNotifiedByEmail: true,
                  },
                }
              : {},
          ),
          toAgencyWithRights(otherAgency, {}),
        ];

        const jwtPayload = createConventionMagicLinkPayload({
          id: conventionId,
          role,
          email: notConnectedUser.email,
          now: new Date(),
        });

        await usecase.execute(
          {
            conventionId,
            agencyId: otherAgency.id,
            justification: "change of agency",
          },
          jwtPayload,
        );

        const expectedConvention = {
          ...convention,
          agencyId: otherAgency.id,
        };

        expectToEqual(uow.conventionRepository.conventions, [
          expectedConvention,
        ]);

        expectArraysToMatch(uow.outboxRepository.events, [
          {
            topic: "ConventionTransferredToAgency",
            payload: {
              convention: expectedConvention,
              agencyId: otherAgency.id,
              justification: "change of agency",
              previousAgencyId: convention.agencyId,
              shouldNotifyActors: true,
              triggeredBy: {
                kind: "convention-magic-link",
                role: jwtPayload.role,
              },
            },
          },
        ]);
      });

      it.each(
        conventionStatusesWithoutJustificationNorValidator,
      )("with status %s", async (status) => {
        const signedAt = new Date("2024-01-01").toISOString();
        const initialConvention = new ConventionDtoBuilder(convention)
          .withStatus(status)
          .signedByBeneficiary(status === "IN_REVIEW" ? signedAt : undefined)
          .signedByEstablishmentRepresentative(
            status === "IN_REVIEW" ? signedAt : undefined,
          )
          .build();
        uow.conventionRepository.setConventions([initialConvention]);
        uow.userRepository.users = [notConnectedUser];
        uow.agencyRepository.agencies = [
          toAgencyWithRights(agency, {
            [notConnectedUser.id]: {
              roles: ["validator"],
              isNotifiedByEmail: true,
            },
          }),
          toAgencyWithRights(otherAgency, {}),
        ];

        await usecase.execute(
          {
            conventionId,
            agencyId: otherAgency.id,
            justification: "change of agency",
          },
          validatorJwtPayload,
        );

        const expectedConvention = {
          ...initialConvention,
          agencyId: otherAgency.id,
        };

        expectToEqual(uow.conventionRepository.conventions, [
          expectedConvention,
        ]);

        expectArraysToMatch(uow.outboxRepository.events, [
          {
            topic: "ConventionTransferredToAgency",
            payload: {
              agencyId: otherAgency.id,
              convention: expectedConvention,
              justification: "change of agency",
              previousAgencyId: initialConvention.agencyId,
              shouldNotifyActors: true,
              triggeredBy: {
                kind: "convention-magic-link",
                role: validatorJwtPayload.role,
              },
            },
          },
        ]);
      });

      it("counsellor of an agency with refersTo can transfer convention to agency", async () => {
        const counsellorPayload = createConventionMagicLinkPayload({
          id: conventionId,
          role: "counsellor",
          email: notConnectedUser.email,
          now: new Date(),
        });
        const conventionWithAgencyRefersTo = new ConventionDtoBuilder(
          convention,
        )
          .withAgencyId(agencyWithRefersTo.id)
          .build();
        uow.conventionRepository.setConventions([conventionWithAgencyRefersTo]);
        uow.userRepository.users = [notConnectedUser];
        uow.agencyRepository.agencies = [
          toAgencyWithRights(otherAgency, {}),
          toAgencyWithRights(agencyWithRefersTo, {
            [notConnectedUser.id]: {
              roles: ["counsellor"],
              isNotifiedByEmail: true,
            },
          }),
        ];

        await usecase.execute(
          {
            conventionId: conventionWithAgencyRefersTo.id,
            agencyId: otherAgency.id,
            justification: "change of agency",
          },
          counsellorPayload,
        );

        const expectedConvention = {
          ...conventionWithAgencyRefersTo,
          agencyId: otherAgency.id,
        };

        expectToEqual(uow.conventionRepository.conventions, [
          expectedConvention,
        ]);

        expectArraysToMatch(uow.outboxRepository.events, [
          {
            topic: "ConventionTransferredToAgency",
            payload: {
              agencyId: otherAgency.id,
              convention: expectedConvention,
              justification: "change of agency",
              previousAgencyId: conventionWithAgencyRefersTo.agencyId,
              shouldNotifyActors: true,
              triggeredBy: {
                kind: "convention-magic-link",
                role: "counsellor",
              },
            },
          },
        ]);
      });

      describe("federatedIdentity is set in initial convention", () => {
        const userFtExternalId = "92f44bbf-103d-4312-bd74-217c7d79f618";
        const beneficiary: FtConnectUserDto = {
          email: "",
          firstName: "",
          isJobseeker: true,
          lastName: "",
          ftExternalId: userFtExternalId,
          birthdate: "1990-01-01",
        };
        const ftAdvisor: FtConnectImmersionAdvisorDto = {
          firstName: "Jean",
          lastName: "Dupont",
          email: "jean.dupont@pole-emploi.fr",
          type: "PLACEMENT",
        };

        beforeEach(async () => {
          await uow.conventionFranceTravailAdvisorRepository.saveFtUserAndAdvisor(
            {
              advisor: ftAdvisor,
              user: beneficiary,
            },
          );
          await uow.conventionFranceTravailAdvisorRepository.associateConventionAndUserAdvisor(
            conventionId,
            userFtExternalId,
          );

          uow.conventionRepository.setConventions([convention]);
          uow.userRepository.users = [notConnectedUser];
        });

        it("should keep federated identity if new agency is france-travail", async () => {
          const transferredToAgency: AgencyDto = {
            ...otherAgency,
            kind: "france-travail",
          };

          uow.agencyRepository.agencies = [
            toAgencyWithRights(agency, {
              [notConnectedUser.id]: {
                roles: ["validator"],
                isNotifiedByEmail: true,
              },
            }),
            toAgencyWithRights(transferredToAgency, {}),
          ];

          const jwtPayload = createConventionMagicLinkPayload({
            id: conventionId,
            role: "validator",
            email: notConnectedUser.email,
            now: new Date(),
          });

          await usecase.execute(
            {
              conventionId,
              agencyId: transferredToAgency.id,
              justification: "change of agency",
            },
            jwtPayload,
          );

          const expectedConvention = {
            ...convention,
            agencyId: otherAgency.id,
          };

          expectToEqual(uow.conventionRepository.conventions, [
            expectedConvention,
          ]);
          expectToEqual(
            await uow.conventionFranceTravailAdvisorRepository.getByConventionId(
              conventionId,
            ),
            {
              conventionId,
              advisor: ftAdvisor,
              ftExternalId: userFtExternalId,
              _entityName: "ConventionFranceTravailAdvisor",
            },
          );

          expectArraysToMatch(uow.outboxRepository.events, [
            {
              topic: "ConventionTransferredToAgency",
              payload: {
                convention: expectedConvention,
                agencyId: otherAgency.id,
                justification: "change of agency",
                previousAgencyId: convention.agencyId,
                shouldNotifyActors: true,
                triggeredBy: {
                  kind: "convention-magic-link",
                  role: jwtPayload.role,
                },
              },
            },
          ]);
        });

        it("should keep federated identity if new agency is not france-travail", async () => {
          const transferredToAgency: AgencyDto = {
            ...otherAgency,
            kind: "mission-locale",
          };

          uow.agencyRepository.agencies = [
            toAgencyWithRights(agency, {
              [notConnectedUser.id]: {
                roles: ["validator"],
                isNotifiedByEmail: true,
              },
            }),
            toAgencyWithRights(transferredToAgency, {}),
          ];

          const jwtPayload = createConventionMagicLinkPayload({
            id: conventionId,
            role: "validator",
            email: notConnectedUser.email,
            now: new Date(),
          });

          await usecase.execute(
            {
              conventionId,
              agencyId: transferredToAgency.id,
              justification: "change of agency kind",
            },
            jwtPayload,
          );

          const expectedConvention = {
            ...convention,
            agencyId: otherAgency.id,
          };

          expectToEqual(uow.conventionRepository.conventions, [
            expectedConvention,
          ]);
          expectToEqual(
            await uow.conventionFranceTravailAdvisorRepository.getByConventionId(
              conventionId,
            ),
            {
              conventionId,
              advisor: ftAdvisor,
              ftExternalId: userFtExternalId,
              _entityName: "ConventionFranceTravailAdvisor",
            },
          );
          expectArraysToMatch(uow.outboxRepository.events, [
            {
              topic: "ConventionTransferredToAgency",
              payload: {
                convention: expectedConvention,
                agencyId: otherAgency.id,
                justification: "change of agency kind",
                previousAgencyId: convention.agencyId,
                shouldNotifyActors: true,
                triggeredBy: {
                  kind: "convention-magic-link",
                  role: jwtPayload.role,
                },
              },
            },
          ]);
        });
      });
    });
  });
});
