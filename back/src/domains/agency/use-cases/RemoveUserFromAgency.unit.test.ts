import {
  type AgencyDto,
  AgencyDtoBuilder,
  type AgencyRole,
  ConnectedUserBuilder,
  errors,
  expectArraysToMatch,
  expectPromiseToFailWithError,
  expectToEqual,
  type Role,
  toAgencyDtoForAgencyUsersAndAdmins,
  type User,
  type WithAgencyIdAndUserId,
} from "shared";
import { toAgencyWithRights } from "../../../utils/agency";
import { makeCreateNewEvent } from "../../core/events/ports/EventBus";
import { CustomTimeGateway } from "../../core/time-gateway/adapters/CustomTimeGateway";
import {
  createInMemoryUow,
  type InMemoryUnitOfWork,
} from "../../core/unit-of-work/adapters/createInMemoryUow";
import { InMemoryUowPerformer } from "../../core/unit-of-work/adapters/InMemoryUowPerformer";
import { TestUuidGenerator } from "../../core/uuid-generator/adapters/UuidGeneratorImplementations";
import {
  makeRemoveUserFromAgency,
  type RemoveUserFromAgency,
} from "./RemoveUserFromAgency";

describe("RemoveUserFromAgency", () => {
  const agency = new AgencyDtoBuilder().build();
  const agencyWithRefersTo = new AgencyDtoBuilder()
    .withId("agencyWithRefersTo-ID")
    .withRefersToAgencyInfo({
      refersToAgencyId: agency.id,
      refersToAgencyName: agency.name,
      refersToAgencyContactEmail: agency.contactEmail,
    })
    .build();

  const adminBuilder = new ConnectedUserBuilder()
    .withId("backoffice-admin-id")
    .withIsAdmin(true);

  const connectedAdmin = adminBuilder.build();

  const notAdminBuilder = new ConnectedUserBuilder()
    .withId("not-admin-id")
    .withIsAdmin(false);
  const notAdmin = notAdminBuilder.build();
  const notAdminUser = notAdminBuilder.buildUser();

  const agencyAdminUser = new ConnectedUserBuilder()
    .withId("agency-admin-id")
    .withIsAdmin(false)
    .withAgencyRights([
      {
        agency: toAgencyDtoForAgencyUsersAndAdmins(agency, []),
        roles: ["agency-admin"],
        isNotifiedByEmail: true,
      },
    ])
    .build();

  let uow: InMemoryUnitOfWork;
  let removeUserFromAgency: RemoveUserFromAgency;
  let timeGateway: CustomTimeGateway;

  beforeEach(() => {
    uow = createInMemoryUow();
    timeGateway = new CustomTimeGateway();
    removeUserFromAgency = makeRemoveUserFromAgency({
      uowPerformer: new InMemoryUowPerformer(uow),
      deps: {
        timeGateway,
        createNewEvent: makeCreateNewEvent({
          uuidGenerator: new TestUuidGenerator(),
          timeGateway,
        }),
      },
    });

    uow.agencyRepository.agencies = [toAgencyWithRights(agency, {})];
  });

  describe("Wrong paths", () => {
    it("throws forbidden when token payload is not backoffice token nor agencyAdmin nor himself", async () => {
      await expectPromiseToFailWithError(
        removeUserFromAgency.execute(
          {
            agencyId: "agency-id",
            userId: "user-id",
          },
          notAdmin,
        ),
        errors.user.forbidden({ userId: notAdmin.id }),
      );
    });

    it("throws notFound if user to delete not found", async () => {
      const inputParams: WithAgencyIdAndUserId = {
        agencyId: agency.id,
        userId: "unexisting-user",
      };

      await expectPromiseToFailWithError(
        removeUserFromAgency.execute(inputParams, connectedAdmin),
        errors.user.notFound({ userId: inputParams.userId }),
      );
    });

    it("throws bad request if user attempts to delete validator when agency has refersTo", async () => {
      uow.userRepository.users = [notAdminUser];

      const agencyWithRefersTo = new AgencyDtoBuilder()
        .withId("agency-with-refers-to-id")
        .withRefersToAgencyInfo({
          refersToAgencyId: agency.id,
          refersToAgencyName: agency.name,
          refersToAgencyContactEmail: agency.contactEmail,
        })
        .build();

      uow.agencyRepository.agencies = [
        toAgencyWithRights(agencyWithRefersTo, {
          [notAdminUser.id]: { roles: ["validator"], isNotifiedByEmail: false },
        }),
      ];

      await expectPromiseToFailWithError(
        removeUserFromAgency.execute(
          {
            agencyId: agencyWithRefersTo.id,
            userId: notAdminUser.id,
          },
          connectedAdmin,
        ),
        errors.agency.invalidValidatorEditionWhenAgencyWithRefersTo(
          agencyWithRefersTo.id,
        ),
      );
    });

    it("throws forbidden if user to delete has not rights on agency", async () => {
      const inputParams: WithAgencyIdAndUserId = {
        agencyId: agency.id,
        userId: notAdminUser.id,
      };

      uow.userRepository.users = [notAdminUser];

      await expectPromiseToFailWithError(
        removeUserFromAgency.execute(inputParams, connectedAdmin),
        errors.user.expectedRightsOnAgency(inputParams),
      );
    });

    it("throws forbidden if user to delete is the last validator receiving notifications", async () => {
      uow.userRepository.users = [notAdminUser];
      uow.agencyRepository.agencies = [
        toAgencyWithRights(agency, {
          [notAdminUser.id]: { roles: ["validator"], isNotifiedByEmail: true },
        }),
      ];

      const inputParams: WithAgencyIdAndUserId = {
        agencyId: agency.id,
        userId: notAdmin.id,
      };

      await expectPromiseToFailWithError(
        removeUserFromAgency.execute(inputParams, connectedAdmin),
        errors.agency.notEnoughValidators(inputParams),
      );
    });

    it("throws forbidden if user to delete is the last pre-validator receiving notifications, and agency has other pre-validators", async () => {
      const counsellorNotReceivingNotif: User = {
        ...notAdminUser,
        id: "counsellor-not-receiving-notif-id",
        email: "counsellorNotReceivingNotif@email.com",
      };
      const counsellorReceivingNotif: User = {
        ...notAdminUser,
        id: "counsellor-receiving-notif-id",
        email: "counsellorReceivingNotif@email.com",
      };
      uow.userRepository.users = [
        counsellorNotReceivingNotif,
        counsellorReceivingNotif,
        notAdminUser,
      ];
      uow.agencyRepository.agencies = [
        toAgencyWithRights(agency, {
          [notAdminUser.id]: { roles: ["validator"], isNotifiedByEmail: true },
          [counsellorNotReceivingNotif.id]: {
            roles: ["counsellor"],
            isNotifiedByEmail: false,
          },
          [counsellorReceivingNotif.id]: {
            roles: ["counsellor"],
            isNotifiedByEmail: true,
          },
        }),
      ];

      const inputParams: WithAgencyIdAndUserId = {
        agencyId: agency.id,
        userId: counsellorReceivingNotif.id,
      };

      await expectPromiseToFailWithError(
        removeUserFromAgency.execute(inputParams, connectedAdmin),
        errors.agency.notEnoughCounsellors(inputParams),
      );
    });

    it("throws forbidden if user to delete is the last pre-validator receiving notifications of an agency with refers to", async () => {
      const counsellorReceivingNotif: User = {
        ...notAdminUser,
        id: "counsellor-receiving-notif-id",
        email: "counsellorReceivingNotif@email.com",
      };
      uow.userRepository.users = [counsellorReceivingNotif, notAdminUser];
      uow.agencyRepository.agencies = [
        toAgencyWithRights(agencyWithRefersTo, {
          [notAdminUser.id]: { roles: ["validator"], isNotifiedByEmail: true },
          [counsellorReceivingNotif.id]: {
            roles: ["counsellor"],
            isNotifiedByEmail: true,
          },
        }),
      ];

      const inputParams: WithAgencyIdAndUserId = {
        agencyId: agencyWithRefersTo.id,
        userId: counsellorReceivingNotif.id,
      };

      await expectPromiseToFailWithError(
        removeUserFromAgency.execute(inputParams, connectedAdmin),
        errors.agency.notEnoughCounsellors(inputParams),
      );
    });

    it("throws forbidden if user to delete is the last counsellor receiving notifications on agency with refers to another agency", async () => {
      const agencyWithRefersTo: AgencyDto = new AgencyDtoBuilder()
        .withRefersToAgencyInfo({
          refersToAgencyId: agency.id,
          refersToAgencyName: agency.name,
          refersToAgencyContactEmail: agency.contactEmail,
        })
        .build();

      const counsellorWithNotif: User = {
        ...notAdminUser,
      };
      const counsellorWithoutNotif: User = {
        ...notAdminUser,
        id: "user2",
      };
      uow.userRepository.users = [counsellorWithNotif, counsellorWithoutNotif];
      uow.agencyRepository.agencies = [
        toAgencyWithRights(agency, {}),
        toAgencyWithRights(agencyWithRefersTo, {
          [counsellorWithNotif.id]: {
            roles: ["counsellor"],
            isNotifiedByEmail: true,
          },
          [counsellorWithoutNotif.id]: {
            roles: ["counsellor"],
            isNotifiedByEmail: false,
          },
        }),
      ];

      const inputParams: WithAgencyIdAndUserId = {
        agencyId: agencyWithRefersTo.id,
        userId: notAdmin.id,
      };
      await expectPromiseToFailWithError(
        removeUserFromAgency.execute(inputParams, connectedAdmin),
        errors.agency.notEnoughCounsellors(inputParams),
      );
    });
  });

  describe("Right paths", () => {
    describe("user can remove himself from agency", () => {
      it.each([
        "to-review",
        "agency-viewer",
        "counsellor",
        "validator",
        "agency-admin",
      ] satisfies AgencyRole[])("with right %s", async (role) => {
        const agency2 = new AgencyDtoBuilder().withId("agency-2-id").build();
        const otherUserWithRightOnAgencies: User = {
          ...notAdmin,
          id: "other-user-id",
        };

        uow.userRepository.users = [notAdminUser, otherUserWithRightOnAgencies];
        uow.agencyRepository.agencies = [
          toAgencyWithRights(agency, {
            [notAdminUser.id]: {
              roles: [role],
              isNotifiedByEmail: false,
            },
            [otherUserWithRightOnAgencies.id]: {
              roles: ["validator"],
              isNotifiedByEmail: true,
            },
          }),
          toAgencyWithRights(agency2, {
            [notAdminUser.id]: {
              roles: ["validator"],
              isNotifiedByEmail: true,
            },
            [otherUserWithRightOnAgencies.id]: {
              roles: ["validator"],
              isNotifiedByEmail: true,
            },
          }),
        ];

        const inputParams: WithAgencyIdAndUserId = {
          agencyId: agency.id,
          userId: notAdminUser.id,
        };
        await removeUserFromAgency.execute(inputParams, notAdmin);

        expectToEqual(uow.agencyRepository.agencies, [
          toAgencyWithRights(
            new AgencyDtoBuilder(agency)
              .withUpdatedAt(timeGateway.now())
              .build(),
            {
              [otherUserWithRightOnAgencies.id]: {
                roles: ["validator"],
                isNotifiedByEmail: true,
              },
            },
          ),
          toAgencyWithRights(agency2, {
            [notAdminUser.id]: {
              roles: ["validator"],
              isNotifiedByEmail: true,
            },
            [otherUserWithRightOnAgencies.id]: {
              roles: ["validator"],
              isNotifiedByEmail: true,
            },
          }),
        ]);
        expectArraysToMatch(uow.outboxRepository.events, [
          {
            topic: "ConnectedUserAgencyRightChanged",
            payload: {
              ...inputParams,
              triggeredBy: {
                kind: "connected-user",
                userId: notAdmin.id,
              },
            },
          },
        ]);
      });
    });

    describe("can remove another user from agency", () => {
      it.each([
        {
          userRole: "back-office",
          user: connectedAdmin,
        },
        {
          userRole: "agency-admin",
          user: agencyAdminUser,
        },
      ] satisfies {
        userRole: Role;
        user: User;
      }[])("when user has $userRole role", async ({ user }) => {
        const agency2 = new AgencyDtoBuilder().withId("agency-2-id").build();
        const otherUserWithRightOnAgencies: User = {
          ...notAdmin,
          id: "other-user-id",
        };

        uow.userRepository.users = [notAdminUser, otherUserWithRightOnAgencies];
        uow.agencyRepository.agencies = [
          toAgencyWithRights(agency, {
            [notAdminUser.id]: {
              roles: ["validator"],
              isNotifiedByEmail: true,
            },
            [otherUserWithRightOnAgencies.id]: {
              roles: ["validator"],
              isNotifiedByEmail: true,
            },
          }),
          toAgencyWithRights(agency2, {
            [notAdminUser.id]: {
              roles: ["validator"],
              isNotifiedByEmail: true,
            },
            [otherUserWithRightOnAgencies.id]: {
              roles: ["validator"],
              isNotifiedByEmail: true,
            },
          }),
        ];

        const inputParams: WithAgencyIdAndUserId = {
          agencyId: agency.id,
          userId: notAdminUser.id,
        };
        await removeUserFromAgency.execute(inputParams, user);

        expectToEqual(uow.agencyRepository.agencies, [
          toAgencyWithRights(
            new AgencyDtoBuilder(agency)
              .withUpdatedAt(timeGateway.now())
              .build(),
            {
              [otherUserWithRightOnAgencies.id]: {
                roles: ["validator"],
                isNotifiedByEmail: true,
              },
            },
          ),
          toAgencyWithRights(agency2, {
            [notAdminUser.id]: {
              roles: ["validator"],
              isNotifiedByEmail: true,
            },
            [otherUserWithRightOnAgencies.id]: {
              roles: ["validator"],
              isNotifiedByEmail: true,
            },
          }),
        ]);
        expectArraysToMatch(uow.outboxRepository.events, [
          {
            topic: "ConnectedUserAgencyRightChanged",
            payload: {
              ...inputParams,
              triggeredBy: {
                kind: "connected-user",
                userId: user.id,
              },
            },
          },
        ]);
      });
    });
  });
});
