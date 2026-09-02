import type {
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
import { makeCreateNewEvent } from "../../core/events/ports/EventBus";
import { CustomTimeGateway } from "../../core/time-gateway/adapters/CustomTimeGateway";
import {
  createInMemoryUow,
  type InMemoryUnitOfWork,
} from "../../core/unit-of-work/adapters/createInMemoryUow";
import { InMemoryUowPerformer } from "../../core/unit-of-work/adapters/InMemoryUowPerformer";
import { TestUuidGenerator } from "../../core/uuid-generator/adapters/UuidGeneratorImplementations";

import {
  type EditConventionCounsellorName,
  makeEditConventionCounsellorName,
} from "./EditConventionCounsellorName";

describe("EditCounsellorName", () => {
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

  const conventionWithAgencyRefersTo = new ConventionDtoBuilder(convention)
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

  const connectedUser = new ConnectedUserBuilder()
    .withId("bcc5c20e-6dd2-45cf-affe-927358005262")
    .build();

  let uow: InMemoryUnitOfWork;
  let usecase: EditConventionCounsellorName;

  beforeEach(() => {
    uow = createInMemoryUow();
    usecase = makeEditConventionCounsellorName({
      uowPerformer: new InMemoryUowPerformer(uow),
      deps: {
        createNewEvent: makeCreateNewEvent({
          timeGateway: new CustomTimeGateway(),
          uuidGenerator: new TestUuidGenerator(),
        }),
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
    ] satisfies ConventionStatus[])(
      "should throw an error if convention status %s does not allow counsellor names to be edited",
      async (status) => {
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
            },
            validatorJwtPayload,
          ),
          errors.convention.editCounsellorNameNotAllowedForStatus({
            status,
          }),
        );
        expectObjectInArrayToMatch(uow.outboxRepository.events, []);
      },
    );

    it("throw an error if convention is not found", async () => {
      await expectPromiseToFailWithError(
        usecase.execute(
          {
            conventionId,
            firstname: "ali",
            lastname: "baba",
          },
          validatorJwtPayload,
        ),
        errors.convention.notFound({
          conventionId,
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
              firstname: "ali",
              lastname: "baba",
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
              firstname: "ali",
              lastname: "baba",
            },
            {
              userId: connectedUser.id,
            },
          ),
          errors.convention.editCounsellorNameNotAuthorizedForRole(),
        );
      });

      it.each([
        "agency-viewer",
        "agency-admin",
        "to-review",
      ] satisfies AgencyRole[])(
        "throws unauthorized if user has not enough rights on agency",
        async (role) => {
          uow.conventionRepository.setConventions([convention]);
          uow.agencyRepository.agencies = [
            toAgencyWithRights(agency, {
              [connectedUser.id]: {
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
                firstname: "ali",
                lastname: "baba",
              },
              {
                userId: connectedUser.id,
              },
            ),
            errors.convention.editCounsellorNameNotAuthorizedForRole(),
          );
        },
      );

      it("if agencyWithRefersTo, throws an error if validator attempts to edit counsellor's names", async () => {
        uow.conventionRepository.setConventions([conventionWithAgencyRefersTo]);
        uow.userRepository.users = [connectedUser];
        uow.agencyRepository.agencies = [
          toAgencyWithRights(agency, {
            [connectedUser.id]: {
              roles: ["validator"],
              isNotifiedByEmail: true,
            },
          }),
          toAgencyWithRights(agencyWithRefersTo, {
            [connectedUser.id]: {
              roles: ["validator"],
              isNotifiedByEmail: true,
            },
          }),
          toAgencyWithRights(otherAgency, {}),
        ];

        await expectPromiseToFailWithError(
          usecase.execute(
            {
              conventionId: conventionWithAgencyRefersTo.id,
              firstname: "ali",
              lastname: "baba",
            },
            {
              userId: connectedUser.id,
            },
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
              firstname: "ali",
              lastname: "baba",
            },
            validatorJwtPayload,
          ),
          errors.convention.forbiddenConventionIdMismatch({
            requestedConventionId,
            jwtConventionId: validatorJwtPayload.applicationId,
            jwtRole: validatorJwtPayload.role,
          }),
        );
      });

      it.each([
        "to-review",
        "agency-viewer",
        "agency-admin",
      ] satisfies AgencyRole[])(
        "throws unauthorized if user role is not allowed",
        async (role) => {
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
                firstname: "ali",
                lastname: "baba",
              },
              jwtPayload,
            ),
            errors.convention.editCounsellorNameNotAuthorizedForRole(),
          );
        },
      );

      it("if agencyWithRefersTo, throws an error if validator attempts to change agency", async () => {
        uow.conventionRepository.setConventions([conventionWithAgencyRefersTo]);
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
          id: conventionWithAgencyRefersTo.id,
          role: "validator",
          email: notConnectedUser.email,
          now: new Date(),
        });

        await expectPromiseToFailWithError(
          usecase.execute(
            {
              conventionId: conventionWithAgencyRefersTo.id,
              firstname: "ali",
              lastname: "baba",
            },
            jwtPayload,
          ),
          errors.convention.validatorOfAgencyRefersToNotAllowed(),
        );
      });
    });
  });

  describe("Right paths: edit counsellor names on convention", () => {
    describe("with connected user", () => {
      it.each(["validator", "counsellor", "back-office"] satisfies Role[])(
        "triggered by connected-user user with role %s",
        async (role) => {
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
              firstname: "ali",
              lastname: "baba",
            },
            {
              userId: connectedUser.id,
            },
          );

          expectToEqual(uow.conventionRepository.conventions, [
            {
              ...convention,
              agencyReferent: {
                firstname: "ali",
                lastname: "baba",
              },
            },
          ]);
          expectToEqual(uow.conventionRepository.conventions, [
            {
              ...convention,
              agencyReferent: {
                firstname: "ali",
                lastname: "baba",
              },
            },
          ]);
          expectArraysToMatch(uow.outboxRepository.events, [
            {
              topic: "ConventionCounsellorNameEdited",
              payload: {
                conventionId: convention.id,
                triggeredBy: {
                  kind: "connected-user",
                  userId: user.id,
                },
              },
            },
          ]);
        },
      );

      it("edit counsellor names with empty firstname and lastname", async () => {
        const conventionWithAgencyReferent = new ConventionDtoBuilder(
          convention,
        )
          .withAgencyReferent({ firstname: "ali", lastname: "baba" })
          .build();
        uow.conventionRepository.setConventions([conventionWithAgencyReferent]);
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
            firstname: "",
            lastname: "",
          },
          {
            userId: connectedUser.id,
          },
        );

        expectToEqual(uow.conventionRepository.conventions, [
          {
            ...convention,
            agencyReferent: {
              firstname: "",
              lastname: "",
            },
          },
        ]);
        expectArraysToMatch(uow.outboxRepository.events, [
          {
            topic: "ConventionCounsellorNameEdited",
            payload: {
              conventionId: conventionWithAgencyReferent.id,
              triggeredBy: {
                kind: "connected-user",
                userId: connectedUser.id,
              },
            },
          },
        ]);
      });

      it.each(conventionStatusesWithoutJustificationNorValidator)(
        "with status %s",
        async (status) => {
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
              firstname: "ali",
              lastname: "baba",
            },
            {
              userId: connectedUser.id,
            },
          );

          expectToEqual(uow.conventionRepository.conventions, [
            {
              ...initialConvention,
              agencyReferent: {
                firstname: "ali",
                lastname: "baba",
              },
            },
          ]);

          expectArraysToMatch(uow.outboxRepository.events, [
            {
              topic: "ConventionCounsellorNameEdited",
              payload: {
                conventionId: initialConvention.id,
                triggeredBy: {
                  kind: "connected-user",
                  userId: connectedUser.id,
                },
              },
            },
          ]);
        },
      );

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
            firstname: "ali",
            lastname: "baba",
          },
          backofficeAdminPayload,
        );

        expectToEqual(uow.conventionRepository.conventions, [
          {
            ...conventionWithAgencyRefersTo,
            agencyReferent: {
              firstname: "ali",
              lastname: "baba",
            },
          },
        ]);

        expectArraysToMatch(uow.outboxRepository.events, [
          {
            topic: "ConventionCounsellorNameEdited",
            payload: {
              conventionId: conventionWithAgencyRefersTo.id,
              triggeredBy: {
                kind: "connected-user",
                userId: backofficeAdmin.id,
              },
            },
          },
        ]);
      });

      it("counsellor of an agency with refersTo can edit counsellor name", async () => {
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
            firstname: "ali",
            lastname: "baba",
          },
          counsellorPayload,
        );

        expectToEqual(uow.conventionRepository.conventions, [
          {
            ...conventionWithAgencyRefersTo,
            agencyReferent: {
              firstname: "ali",
              lastname: "baba",
            },
          },
        ]);

        expectArraysToMatch(uow.outboxRepository.events, [
          {
            topic: "ConventionCounsellorNameEdited",
            payload: {
              conventionId: conventionWithAgencyRefersTo.id,
              triggeredBy: {
                kind: "connected-user",
                userId: counsellor.id,
              },
            },
          },
        ]);
      });
    });

    describe("with convention jwt payload", () => {
      it.each(["validator", "counsellor"] satisfies Role[])(
        "triggered by jwt role %s",
        async (role) => {
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
              firstname: "ali",
              lastname: "baba",
            },
            jwtPayload,
          );

          expectToEqual(uow.conventionRepository.conventions, [
            {
              ...convention,
              agencyReferent: {
                firstname: "ali",
                lastname: "baba",
              },
            },
          ]);

          expectArraysToMatch(uow.outboxRepository.events, [
            {
              topic: "ConventionCounsellorNameEdited",
              payload: {
                conventionId: convention.id,
                triggeredBy: {
                  kind: "convention-magic-link",
                  role: jwtPayload.role,
                },
              },
            },
          ]);
        },
      );

      it.each(conventionStatusesWithoutJustificationNorValidator)(
        "with status %s",
        async (status) => {
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
              firstname: "ali",
              lastname: "baba",
            },
            validatorJwtPayload,
          );

          expectToEqual(uow.conventionRepository.conventions, [
            {
              ...initialConvention,
              agencyReferent: {
                firstname: "ali",
                lastname: "baba",
              },
            },
          ]);

          expectArraysToMatch(uow.outboxRepository.events, [
            {
              topic: "ConventionCounsellorNameEdited",
              payload: {
                conventionId: initialConvention.id,
                triggeredBy: {
                  kind: "convention-magic-link",
                  role: validatorJwtPayload.role,
                },
              },
            },
          ]);
        },
      );

      it("counsellor of an agency with refersTo can edit counsellor name", async () => {
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
            firstname: "ali",
            lastname: "baba",
          },
          counsellorPayload,
        );

        expectToEqual(uow.conventionRepository.conventions, [
          {
            ...conventionWithAgencyRefersTo,
            agencyReferent: {
              firstname: "ali",
              lastname: "baba",
            },
          },
        ]);

        expectArraysToMatch(uow.outboxRepository.events, [
          {
            topic: "ConventionCounsellorNameEdited",
            payload: {
              conventionId: conventionWithAgencyRefersTo.id,
              triggeredBy: {
                kind: "convention-magic-link",
                role: "counsellor",
              },
            },
          },
        ]);
      });
    });
  });
});
