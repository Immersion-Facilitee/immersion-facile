import {
  type AgencyDto,
  AgencyDtoBuilder,
  type AgencyRole,
  ConnectedUserBuilder,
  errors,
  expectArraysToEqualIgnoringOrder,
  expectPromiseToFailWithError,
  expectToEqual,
  toAgencyDtoForAgencyUsersAndAdmins,
  type User,
  type UserParamsForAgency,
  type UserWithAdminRights,
} from "shared";
import { toAgencyWithRights } from "../../../utils/agency";
import {
  type CreateNewEvent,
  makeCreateNewEvent,
} from "../../core/events/ports/EventBus";
import { CustomTimeGateway } from "../../core/time-gateway/adapters/CustomTimeGateway";
import {
  createInMemoryUow,
  type InMemoryUnitOfWork,
} from "../../core/unit-of-work/adapters/createInMemoryUow";
import { InMemoryUowPerformer } from "../../core/unit-of-work/adapters/InMemoryUowPerformer";
import { TestUuidGenerator } from "../../core/uuid-generator/adapters/UuidGeneratorImplementations";
import {
  makeUpdateUserForAgency,
  type UpdateUserForAgency,
} from "./UpdateUserForAgency";

describe("UpdateUserForAgency", () => {
  const adminBuilder = new ConnectedUserBuilder()
    .withId("backoffice-admin-id")
    .withIsAdmin(true);
  const admin = adminBuilder.build();
  const adminUser = adminBuilder.buildUser();

  const notAdminBuilder = new ConnectedUserBuilder()
    .withId("not-admin-id")
    .withIsAdmin(false);
  const notAdmin = notAdminBuilder.build();
  const notAdminUser = notAdminBuilder.buildUser();

  const agencyAdminBuilder = new ConnectedUserBuilder()
    .withId("agency-admin")
    .withIsAdmin(false);
  const agencyAdmin = agencyAdminBuilder.build();
  const agencyAdminUser = agencyAdminBuilder.buildUser();
  const notAgencyAdminUserBuilder = new ConnectedUserBuilder()
    .withId("not-agency-admin-id")
    .withIsAdmin(false);
  const notAgencyAdminUser = notAgencyAdminUserBuilder.build();

  const counsellor = new ConnectedUserBuilder()
    .withId("counsellor")
    .withEmail("counsellor@mail.com")
    .buildUser();

  const timeGateway: CustomTimeGateway = new CustomTimeGateway();

  let updateUserForAgency: UpdateUserForAgency;
  let createNewEvent: CreateNewEvent;
  let uow: InMemoryUnitOfWork;

  beforeEach(() => {
    uow = createInMemoryUow();
    createNewEvent = makeCreateNewEvent({
      timeGateway,
      uuidGenerator: new TestUuidGenerator(),
    });

    uow.userRepository.users = [adminUser, notAdminUser, agencyAdminUser];
    updateUserForAgency = makeUpdateUserForAgency({
      uowPerformer: new InMemoryUowPerformer(uow),
      deps: {
        createNewEvent,
        timeGateway,
      },
    });
  });

  describe("Wrong paths", () => {
    it("throws Forbidden if token payload is user has no right on agency", async () => {
      await expectPromiseToFailWithError(
        updateUserForAgency.execute(
          {
            roles: ["counsellor"],
            agencyId: "agency-1",
            userId: "john-123",
            isNotifiedByEmail: true,
            email: "any@email.fr",
          },
          notAdmin,
        ),
        errors.user.forbidden({ userId: notAdmin.id }),
      );
    });

    it("throws Forbidden if token payload is not admin on agency", async () => {
      await expectPromiseToFailWithError(
        updateUserForAgency.execute(
          {
            roles: ["counsellor"],
            agencyId: "agency-1",
            userId: "john-123",
            isNotifiedByEmail: true,
            email: "any@email.fr",
          },
          notAgencyAdminUser,
        ),
        errors.user.forbidden({ userId: notAgencyAdminUser.id }),
      );
    });

    it("throws not found if agency does not exist", async () => {
      uow.userRepository.users = [adminUser, notAdminUser];

      const agencyId = "Fake-Agency-Id";

      await expectPromiseToFailWithError(
        updateUserForAgency.execute(
          {
            roles: ["counsellor"],
            agencyId,
            userId: notAdminUser.id,
            isNotifiedByEmail: true,
            email: notAdminUser.email,
          },
          admin,
        ),
        errors.agency.notFound({
          agencyId,
        }),
      );
    });

    it("throws forbidden if user has no rights on agency", async () => {
      const agency = new AgencyDtoBuilder().build();
      uow.agencyRepository.agencies = [toAgencyWithRights(agency, {})];
      uow.userRepository.users = [adminUser, notAdminUser];

      await expectPromiseToFailWithError(
        updateUserForAgency.execute(
          {
            roles: ["counsellor"],
            agencyId: agency.id,
            userId: notAdmin.id,
            isNotifiedByEmail: true,
            email: "notAdminUser@email.fr",
          },
          admin,
        ),
        errors.user.noRightsOnAgency({
          agencyId: agency.id,
          userId: notAdmin.id,
        }),
      );
    });

    it("throws forbidden if user who isn't IF admin or agency admin attempts to update another user email", async () => {
      const agency = new AgencyDtoBuilder().build();

      const userToUpdate: UserWithAdminRights = {
        ...notAdminUser,
        id: "user-to-update",
        isBackofficeAdmin: false,
        proConnect: null,
      };
      uow.agencyRepository.agencies = [
        toAgencyWithRights(agency, {
          [userToUpdate.id]: { roles: ["validator"], isNotifiedByEmail: true },
          [notAdmin.id]: { roles: ["validator"], isNotifiedByEmail: true },
        }),
      ];
      uow.userRepository.users = [userToUpdate, notAdminUser];

      await expectPromiseToFailWithError(
        updateUserForAgency.execute(
          {
            roles: ["validator"],
            agencyId: agency.id,
            userId: userToUpdate.id,
            isNotifiedByEmail: false,
            email: "updated-email@email.fr",
          },
          {
            ...notAdmin,
            agencyRights: [
              {
                agency: toAgencyDtoForAgencyUsersAndAdmins(agency, []),
                roles: ["validator"],
                isNotifiedByEmail: true,
              },
            ],
          },
        ),
        errors.user.forbiddenNotificationsPreferencesUpdate(),
      );
    });

    it("throws bad request if update of email to another email that already exist in agency", async () => {
      const agency = new AgencyDtoBuilder().build();
      const userToUpdate: UserWithAdminRights = {
        ...notAdminUser,
        email: "user-to-update@mail.fr",
        id: "user-to-update",
        isBackofficeAdmin: false,
        proConnect: null,
      };
      uow.agencyRepository.agencies = [
        toAgencyWithRights(agency, {
          [userToUpdate.id]: { roles: ["validator"], isNotifiedByEmail: true },
          [notAdmin.id]: {
            roles: ["validator"],
            isNotifiedByEmail: true,
          },
        }),
      ];
      uow.userRepository.users = [userToUpdate, notAdminUser];

      await expectPromiseToFailWithError(
        updateUserForAgency.execute(
          {
            roles: ["validator"],
            agencyId: agency.id,
            userId: userToUpdate.id,
            isNotifiedByEmail: false,
            email: notAdmin.email,
          },
          admin,
        ),
        errors.agency.userAlreadyExist(),
      );
    });

    it("throws bad request if attempt to add counsellor role to a user in a FT agency", async () => {
      const agency = new AgencyDtoBuilder().withKind("france-travail").build();
      uow.agencyRepository.agencies = [
        toAgencyWithRights(agency, {
          [notAdminUser.id]: { roles: ["validator"], isNotifiedByEmail: true },
        }),
      ];

      await expectPromiseToFailWithError(
        updateUserForAgency.execute(
          {
            roles: ["counsellor"],
            agencyId: agency.id,
            userId: notAdminUser.id,
            isNotifiedByEmail: true,
            email: notAdminUser.email,
          },
          admin,
        ),
        errors.agency.invalidCounsellorRoleForFTAgency(),
      );
    });
  });

  describe("when updating email", () => {
    const agency: AgencyDto = new AgencyDtoBuilder().build();

    beforeEach(() => {
      uow.agencyRepository.agencies = [toAgencyWithRights(agency, {})];
    });

    it("throws forbidden if attemps modify email of an ProConnected user", async () => {
      uow.userRepository.users = [notAdminUser];
      uow.agencyRepository.agencies = [
        toAgencyWithRights(agency, {
          [notAdminUser.id]: { roles: ["validator"], isNotifiedByEmail: true },
        }),
      ];

      await expectPromiseToFailWithError(
        updateUserForAgency.execute(
          {
            agencyId: agency.id,
            roles: ["validator"],
            userId: notAdminUser.id,
            isNotifiedByEmail: true,
            email: "new-email@email.com",
          },
          admin,
        ),
        errors.user.forbiddenToChangeEmailForConnectedUser(),
      );
    });

    it("does not modify email if it hasn't changed", async () => {
      uow.userRepository.users = [notAdminUser];
      uow.agencyRepository.agencies = [
        toAgencyWithRights(agency, {
          [notAdminUser.id]: { roles: ["validator"], isNotifiedByEmail: true },
        }),
      ];

      await updateUserForAgency.execute(
        {
          agencyId: agency.id,
          roles: ["validator"],
          userId: notAdminUser.id,
          isNotifiedByEmail: true,
          email: notAdminUser.email,
        },
        admin,
      );

      const updatedUser = await uow.userRepository.getById(notAdminUser.id);
      expectToEqual(updatedUser?.email, notAdminUser.email);
    });

    it("backoffice-admin can update the user email for a non ic user", async () => {
      const nonIcUser: User = {
        ...notAdminUser,
        proConnect: null,
      };
      uow.userRepository.users = [nonIcUser];
      uow.agencyRepository.agencies = [
        toAgencyWithRights(agency, {
          [nonIcUser.id]: { roles: ["validator"], isNotifiedByEmail: true },
        }),
      ];

      await updateUserForAgency.execute(
        {
          agencyId: agency.id,
          roles: ["validator"],
          userId: nonIcUser.id,
          isNotifiedByEmail: true,
          email: "new-email@email.com",
        },
        admin,
      );

      const updatedUser = await uow.userRepository.getById(nonIcUser.id);
      expectToEqual(updatedUser?.email, "new-email@email.com");
    });

    it("throws forbidden if non-admin user with agency-viewer role tries to update another user's email", async () => {
      const victim: User = {
        ...notAdminUser,
        email: "victim@mail.com",
        id: "victim-id",
        proConnect: null,
      };

      const attackerBuilder = new ConnectedUserBuilder()
        .withId("attacker-id")
        .withEmail("attacker@mail.com")
        .withIsAdmin(false);

      const attackerUser = attackerBuilder.buildUser();

      uow.agencyRepository.agencies = [
        toAgencyWithRights(agency, {
          [victim.id]: { roles: ["validator"], isNotifiedByEmail: true },
          [attackerUser.id]: {
            roles: ["agency-viewer"],
            isNotifiedByEmail: false,
          },
        }),
      ];
      uow.userRepository.users = [victim, attackerUser];

      await expectPromiseToFailWithError(
        updateUserForAgency.execute(
          {
            roles: ["validator"],
            agencyId: agency.id,
            userId: victim.id,
            isNotifiedByEmail: true,
            email: "attacker-controlled@email.com",
          },
          {
            ...attackerBuilder.build(),
            agencyRights: [
              {
                agency: toAgencyDtoForAgencyUsersAndAdmins(agency, []),
                roles: ["agency-viewer"],
                isNotifiedByEmail: false,
              },
            ],
          },
        ),
        errors.user.forbiddenEmailUpdate(),
      );
    });

    it("agency-admin can update the user email for a non ic user", async () => {
      const nonIcUser: User = {
        ...notAdminUser,
        proConnect: null,
      };
      uow.userRepository.users = [nonIcUser, agencyAdminUser];
      uow.agencyRepository.agencies = [
        toAgencyWithRights(agency, {
          [nonIcUser.id]: { roles: ["validator"], isNotifiedByEmail: true },
          [agencyAdminUser.id]: {
            roles: ["agency-admin"],
            isNotifiedByEmail: false,
          },
        }),
      ];

      await updateUserForAgency.execute(
        {
          agencyId: agency.id,
          roles: ["validator"],
          userId: nonIcUser.id,
          isNotifiedByEmail: true,
          email: "new-email@email.com",
        },
        {
          ...agencyAdmin,
          agencyRights: [
            {
              agency: toAgencyDtoForAgencyUsersAndAdmins(agency, []),
              roles: ["agency-admin"],
              isNotifiedByEmail: false,
            },
          ],
        },
      );

      const updatedUser = await uow.userRepository.getById(nonIcUser.id);
      expectToEqual(updatedUser?.email, "new-email@email.com");
    });
  });

  describe("when roles are updated", () => {
    it("can change to more than one role", async () => {
      const agency = new AgencyDtoBuilder().build();

      const validator: User = {
        ...notAdminUser,
        id: "validator-id",
        email: "validator@email.fr",
      };
      uow.userRepository.users = [
        adminUser,
        notAdminUser,
        validator,
        counsellor,
      ];
      uow.agencyRepository.agencies = [
        toAgencyWithRights(agency, {
          [notAdminUser.id]: { roles: ["to-review"], isNotifiedByEmail: false },
          [validator.id]: { roles: ["validator"], isNotifiedByEmail: true },
          [counsellor.id]: { roles: ["counsellor"], isNotifiedByEmail: false },
        }),
      ];

      const userRoleForAgency: UserParamsForAgency = {
        roles: ["agency-admin", "counsellor", "validator"],
        agencyId: agency.id,
        userId: notAdminUser.id,
        isNotifiedByEmail: true,
        email: notAdminUser.email,
      };

      await updateUserForAgency.execute(userRoleForAgency, admin);

      expectToEqual(uow.userRepository.users, [
        adminUser,
        notAdminUser,
        validator,
        counsellor,
      ]);
      expectToEqual(uow.agencyRepository.agencies, [
        toAgencyWithRights(
          new AgencyDtoBuilder(agency).withUpdatedAt(timeGateway.now()).build(),
          {
            [notAdminUser.id]: {
              roles: userRoleForAgency.roles,
              isNotifiedByEmail: userRoleForAgency.isNotifiedByEmail,
            },
            [validator.id]: { roles: ["validator"], isNotifiedByEmail: true },
            [counsellor.id]: {
              roles: ["counsellor"],
              isNotifiedByEmail: false,
            },
          },
        ),
      ]);
      expectToEqual(uow.outboxRepository.events, [
        createNewEvent({
          topic: "ConnectedUserAgencyRightChanged",
          payload: {
            ...userRoleForAgency,
            triggeredBy: {
              kind: "connected-user",
              userId: admin.id,
            },
          },
        }),
      ]);
    });

    it("should save ConnectedUserAgencyRightChanged event when successful", async () => {
      const agency = new AgencyDtoBuilder().build();

      uow.userRepository.users = [adminUser, notAdminUser];
      uow.agencyRepository.agencies = [
        toAgencyWithRights(agency, {
          [notAdminUser.id]: { roles: ["to-review"], isNotifiedByEmail: false },
        }),
      ];

      const userRoleForAgency: UserParamsForAgency = {
        userId: notAdminUser.id,
        agencyId: agency.id,
        roles: ["validator"],
        isNotifiedByEmail: true,
        email: notAdminUser.email,
      };

      await updateUserForAgency.execute(userRoleForAgency, admin);

      expectToEqual(uow.outboxRepository.events, [
        createNewEvent({
          topic: "ConnectedUserAgencyRightChanged",
          payload: {
            ...userRoleForAgency,
            triggeredBy: {
              kind: "connected-user",
              userId: admin.id,
            },
          },
        }),
      ]);
    });

    it("backoffice-admin can changes the role and email notification of a user for a given agency", async () => {
      const agency = new AgencyDtoBuilder().build();

      const userWithNotif: User = {
        ...notAdmin,
        id: "receiving-notif-id",
        email: "icuserwithnotif@email.fr",
      };
      const userToUpdate: User = {
        ...notAdmin,
        id: "user-to-update",
        email: "usertoupdate@email.fr",
      };

      uow.userRepository.users = [
        adminUser,
        userWithNotif,
        userToUpdate,
        notAdminUser,
      ];
      uow.agencyRepository.agencies = [
        toAgencyWithRights(agency, {
          [notAdminUser.id]: { isNotifiedByEmail: true, roles: ["counsellor"] },
          [userWithNotif.id]: {
            roles: ["validator"],
            isNotifiedByEmail: true,
          },
          [userToUpdate.id]: { roles: ["validator"], isNotifiedByEmail: false },
        }),
      ];

      const newRole: AgencyRole = "validator";

      await updateUserForAgency.execute(
        {
          roles: [newRole],
          agencyId: agency.id,
          userId: userToUpdate.id,
          isNotifiedByEmail: false,
          email: userToUpdate.email,
        },
        admin,
      );

      expectToEqual(uow.userRepository.users, [
        adminUser,
        userWithNotif,
        userToUpdate,
        notAdminUser,
      ]);
      expectToEqual(uow.agencyRepository.agencies, [
        toAgencyWithRights(
          new AgencyDtoBuilder(agency).withUpdatedAt(timeGateway.now()).build(),
          {
            [notAdminUser.id]: {
              isNotifiedByEmail: true,
              roles: ["counsellor"],
            },
            [userWithNotif.id]: {
              roles: ["validator"],
              isNotifiedByEmail: true,
            },
            [userToUpdate.id]: { roles: [newRole], isNotifiedByEmail: false },
          },
        ),
      ]);
    });

    it("agency-admin can changes the role of a user for a given agency", async () => {
      const agency = new AgencyDtoBuilder().build();

      const userToUpdate: User = {
        ...notAdmin,
        id: "user-to-update",
        email: "usertoupdate@email.fr",
      };

      uow.userRepository.users = [agencyAdminUser, userToUpdate];
      uow.agencyRepository.agencies = [
        toAgencyWithRights(agency, {
          [userToUpdate.id]: { roles: ["validator"], isNotifiedByEmail: true },
          [agencyAdminUser.id]: {
            roles: ["agency-admin"],
            isNotifiedByEmail: false,
          },
        }),
      ];

      const newRole: AgencyRole = "counsellor";

      await updateUserForAgency.execute(
        {
          roles: ["validator", newRole],
          agencyId: agency.id,
          userId: userToUpdate.id,
          isNotifiedByEmail: true,
          email: userToUpdate.email,
        },
        {
          ...agencyAdmin,
          agencyRights: [
            {
              agency: toAgencyDtoForAgencyUsersAndAdmins(agency, []),
              roles: ["agency-admin"],
              isNotifiedByEmail: false,
            },
          ],
        },
      );

      expectArraysToEqualIgnoringOrder(uow.userRepository.users, [
        userToUpdate,
        agencyAdminUser,
      ]);
      expectArraysToEqualIgnoringOrder(uow.agencyRepository.agencies, [
        toAgencyWithRights(
          new AgencyDtoBuilder(agency).withUpdatedAt(timeGateway.now()).build(),
          {
            [userToUpdate.id]: {
              roles: [newRole, "validator"],
              isNotifiedByEmail: true,
            },
            [agencyAdminUser.id]: {
              roles: ["agency-admin"],
              isNotifiedByEmail: false,
            },
          },
        ),
      ]);
    });

    describe("cannot remove the last validator receiving notifications of an agency", () => {
      const agencyWithCounsellor: AgencyDto = new AgencyDtoBuilder().build();
      const counsellor = new ConnectedUserBuilder()
        .withId("counsellor")
        .withEmail("counsellor@mail.com")
        .buildUser();

      it("when last validator role is updated to counsellor", async () => {
        const userReceivingNotif: User = {
          ...notAdminUser,
        };

        const userWithoutNotif: User = {
          ...notAdminUser,
          id: "not-receiving-notif-id",
        };

        uow.userRepository.users = [
          adminUser,
          userReceivingNotif,
          userWithoutNotif,
          counsellor,
        ];
        uow.agencyRepository.agencies = [
          toAgencyWithRights(agencyWithCounsellor, {
            [userReceivingNotif.id]: {
              roles: ["validator"],
              isNotifiedByEmail: true,
            },
            [userWithoutNotif.id]: {
              roles: ["validator"],
              isNotifiedByEmail: false,
            },
            [counsellor.id]: {
              roles: ["counsellor"],
              isNotifiedByEmail: false,
            },
          }),
        ];

        await expectPromiseToFailWithError(
          updateUserForAgency.execute(
            {
              agencyId: agencyWithCounsellor.id,
              roles: ["counsellor"],
              userId: userReceivingNotif.id,
              isNotifiedByEmail: true,
              email: userReceivingNotif.email,
            },
            admin,
          ),
          errors.agency.notEnoughValidators({
            agencyId: agencyWithCounsellor.id,
          }),
        );
      });

      it("when last validator role is not notified by email", async () => {
        const user: User = {
          id: "user1",
          email: "user1@email.com",
          createdAt: timeGateway.now().toISOString(),
          preventToDelete: false,
          proConnect: null,
          lastName: "",
          firstName: "",
        };
        uow.userRepository.users = [user, counsellor];
        uow.agencyRepository.agencies = [
          toAgencyWithRights(agencyWithCounsellor, {
            [counsellor.id]: {
              roles: ["counsellor"],
              isNotifiedByEmail: true,
            },
            [user.id]: {
              roles: ["validator"],
              isNotifiedByEmail: true,
            },
          }),
        ];

        await expectPromiseToFailWithError(
          updateUserForAgency.execute(
            {
              agencyId: agencyWithCounsellor.id,
              roles: ["validator"],
              userId: user.id,
              isNotifiedByEmail: false,
              email: user.email,
            },
            admin,
          ),
          errors.agency.notEnoughValidators({
            agencyId: agencyWithCounsellor.id,
          }),
        );
      });
    });

    describe("when counsellor role", () => {
      const user: User = {
        id: "user",
        email: "user1@email.com",
        createdAt: new Date().toISOString(),
        preventToDelete: false,
        proConnect: null,
        lastName: "",
        firstName: "",
      };
      const validator: User = {
        id: "validator-notified",
        email: "validator@email.com",
        createdAt: new Date().toISOString(),
        preventToDelete: false,
        proConnect: null,
        lastName: "",
        firstName: "",
      };

      describe("is added", () => {
        it("throw an error if not notified by email and no other user of same agency is counsellor notified by email", async () => {
          const agency = new AgencyDtoBuilder().build();

          uow.userRepository.users = [user, validator];
          uow.agencyRepository.agencies = [
            toAgencyWithRights(agency, {
              [user.id]: { roles: ["to-review"], isNotifiedByEmail: false },
              [validator.id]: { roles: ["validator"], isNotifiedByEmail: true },
            }),
          ];

          await expectPromiseToFailWithError(
            updateUserForAgency.execute(
              {
                agencyId: agency.id,
                roles: ["counsellor"],
                userId: user.id,
                isNotifiedByEmail: false,
                email: user.email,
              },
              admin,
            ),
            errors.agency.notEnoughCounsellors({ agencyId: agency.id }),
          );
        });
      });

      describe("is updated", () => {
        it("throw when trying to remove notifications from last counsellor receiving notifications", async () => {
          const counsellor: User = {
            id: "counsellor-not-notified",
            email: "counsellor@email.com",
            createdAt: timeGateway.now().toISOString(),
            preventToDelete: false,
            proConnect: null,
            lastName: "",
            firstName: "",
          };
          const agency = new AgencyDtoBuilder().build();

          uow.agencyRepository.agencies = [
            toAgencyWithRights(agency, {
              [user.id]: { roles: ["counsellor"], isNotifiedByEmail: true },
              [counsellor.id]: {
                roles: ["counsellor"],
                isNotifiedByEmail: false,
              },
              [validator.id]: { roles: ["validator"], isNotifiedByEmail: true },
            }),
          ];

          uow.userRepository.users = [user, validator, counsellor];

          await expectPromiseToFailWithError(
            updateUserForAgency.execute(
              {
                agencyId: agency.id,
                roles: ["counsellor"],
                userId: user.id,
                isNotifiedByEmail: false,
                email: user.email,
              },
              admin,
            ),
            errors.agency.notEnoughCounsellors({ agencyId: agency.id }),
          );
        });

        it("can update remove notifications from a counsellor receiving notifications (not the last one)", async () => {
          const counsellor: User = {
            id: "counsellor-not-notified",
            email: "counsellor@email.com",
            createdAt: timeGateway.now().toISOString(),
            preventToDelete: false,
            proConnect: null,
            lastName: "",
            firstName: "",
          };
          const agency = new AgencyDtoBuilder().build();
          uow.agencyRepository.agencies = [
            toAgencyWithRights(agency, {
              [user.id]: { roles: ["counsellor"], isNotifiedByEmail: true },
              [counsellor.id]: {
                roles: ["counsellor"],
                isNotifiedByEmail: true,
              },
              [validator.id]: { roles: ["validator"], isNotifiedByEmail: true },
            }),
          ];
          uow.userRepository.users = [user, validator, counsellor];

          await updateUserForAgency.execute(
            {
              agencyId: agency.id,
              roles: ["counsellor"],
              userId: user.id,
              isNotifiedByEmail: false,
              email: user.email,
            },
            admin,
          );

          expectToEqual(uow.agencyRepository.agencies, [
            toAgencyWithRights(
              new AgencyDtoBuilder(agency)
                .withUpdatedAt(timeGateway.now())
                .build(),
              {
                [user.id]: { roles: ["counsellor"], isNotifiedByEmail: false },
                [counsellor.id]: {
                  roles: ["counsellor"],
                  isNotifiedByEmail: true,
                },
                [validator.id]: {
                  roles: ["validator"],
                  isNotifiedByEmail: true,
                },
              },
            ),
          ]);
        });
      });

      describe("is removed", () => {
        it("can remove counsellor if no other", async () => {
          const agency = new AgencyDtoBuilder().build();
          uow.agencyRepository.agencies = [
            toAgencyWithRights(agency, {
              [user.id]: { roles: ["counsellor"], isNotifiedByEmail: true },
              [validator.id]: { roles: ["validator"], isNotifiedByEmail: true },
            }),
          ];
          uow.userRepository.users = [user, validator];

          await updateUserForAgency.execute(
            {
              agencyId: agency.id,
              roles: ["agency-viewer"],
              userId: user.id,
              isNotifiedByEmail: false,
              email: user.email,
            },
            admin,
          );

          expectToEqual(uow.agencyRepository.agencies, [
            toAgencyWithRights(
              new AgencyDtoBuilder(agency)
                .withUpdatedAt(timeGateway.now())
                .build(),
              {
                [user.id]: {
                  roles: ["agency-viewer"],
                  isNotifiedByEmail: false,
                },
                [validator.id]: {
                  roles: ["validator"],
                  isNotifiedByEmail: true,
                },
              },
            ),
          ]);
        });

        it("throw error if not notified and there are other counsellor but none is notified by email", async () => {
          const counsellor: User = {
            id: "counsellor-not-notified",
            email: "counsellor@email.com",
            createdAt: timeGateway.now().toISOString(),
            preventToDelete: false,
            proConnect: null,
            lastName: "",
            firstName: "",
          };
          const agency = new AgencyDtoBuilder().build();
          uow.agencyRepository.agencies = [
            toAgencyWithRights(agency, {
              [user.id]: { roles: ["counsellor"], isNotifiedByEmail: true },
              [counsellor.id]: {
                roles: ["counsellor"],
                isNotifiedByEmail: false,
              },
              [validator.id]: {
                roles: ["validator"],
                isNotifiedByEmail: true,
              },
            }),
          ];
          uow.userRepository.users = [user, validator, counsellor];

          await expectPromiseToFailWithError(
            updateUserForAgency.execute(
              {
                agencyId: agency.id,
                roles: ["agency-viewer"],
                userId: user.id,
                isNotifiedByEmail: false,
                email: user.email,
              },
              admin,
            ),
            errors.agency.notEnoughCounsellors({ agencyId: agency.id }),
          );
        });
      });
    });

    describe("cannot remove the last counsellor receiving notifications of an agency with refersTo", () => {
      const counsellor1: User = {
        id: "user1",
        email: "user1@email.com",
        createdAt: timeGateway.now().toISOString(),
        preventToDelete: false,
        proConnect: null,
        lastName: "",
        firstName: "",
      };
      const counsellor2: User = {
        id: "user2",
        email: "user2@email.com",
        createdAt: timeGateway.now().toISOString(),
        preventToDelete: false,
        proConnect: null,
        lastName: "",
        firstName: "",
      };
      const agency: AgencyDto = new AgencyDtoBuilder().build();
      const agencyWithRefersTo: AgencyDto = new AgencyDtoBuilder()
        .withId("agency-with-refers-to")
        .withRefersToAgencyInfo({
          refersToAgencyId: agency.id,
          refersToAgencyName: agency.name,
          refersToAgencyContactEmail: agency.contactEmail,
        })
        .build();

      beforeEach(() => {
        uow.userRepository.users = [counsellor1, counsellor2];
      });

      it("when last counsellor role is updated to validator", async () => {
        uow.agencyRepository.agencies = [
          toAgencyWithRights(agency, {}),
          toAgencyWithRights(agencyWithRefersTo, {
            [counsellor1.id]: {
              roles: ["counsellor"],
              isNotifiedByEmail: true,
            },
          }),
        ];

        await expectPromiseToFailWithError(
          updateUserForAgency.execute(
            {
              agencyId: agencyWithRefersTo.id,
              roles: ["validator"],
              userId: counsellor1.id,
              isNotifiedByEmail: false,
              email: counsellor1.email,
            },
            admin,
          ),
          errors.agency.invalidValidatorEditionWhenAgencyWithRefersTo(
            agencyWithRefersTo.id,
          ),
        );
      });
      it("when last counsellor role is not notified by email", async () => {
        uow.agencyRepository.agencies = [
          toAgencyWithRights(agency, {}),
          toAgencyWithRights(agencyWithRefersTo, {
            [counsellor1.id]: {
              roles: ["counsellor"],
              isNotifiedByEmail: true,
            },
            [counsellor2.id]: {
              roles: ["counsellor"],
              isNotifiedByEmail: false,
            },
          }),
        ];

        await expectPromiseToFailWithError(
          updateUserForAgency.execute(
            {
              agencyId: agencyWithRefersTo.id,
              roles: ["counsellor"],
              userId: counsellor1.id,
              isNotifiedByEmail: false,
              email: counsellor1.email,
            },
            admin,
          ),
          errors.agency.notEnoughCounsellors({
            agencyId: agencyWithRefersTo.id,
          }),
        );
      });
      it("Throw an error when trying to update user Role to counsellor when agency is only one step validation", async () => {
        const oneStepValidationAgency = new AgencyDtoBuilder().build();

        uow.userRepository.users = [notAdminUser, admin];
        uow.agencyRepository.agencies = [
          toAgencyWithRights(oneStepValidationAgency, {
            [notAdminUser.id]: {
              roles: ["validator"],
              isNotifiedByEmail: true,
            },
          }),
        ];

        await expectPromiseToFailWithError(
          updateUserForAgency.execute(
            {
              agencyId: oneStepValidationAgency.id,
              roles: ["counsellor"],
              userId: notAdminUser.id,
              isNotifiedByEmail: true,
              email: notAdminUser.email,
            },
            admin,
          ),
          errors.agency.notEnoughValidators({
            agencyId: oneStepValidationAgency.id,
          }),
        );
      });
    });
  });

  describe("when isNotifiedByEmail is updated", () => {
    const agency: AgencyDto = new AgencyDtoBuilder().build();

    beforeEach(() => {
      uow.agencyRepository.agencies = [toAgencyWithRights(agency, {})];
    });

    it("backoffice-admin can update isNotifiedByEmail for another user", async () => {
      const nonIcUser: User = {
        ...notAdminUser,
        proConnect: null,
      };
      uow.userRepository.users = [nonIcUser, admin];
      uow.agencyRepository.agencies = [
        toAgencyWithRights(agency, {
          [nonIcUser.id]: { roles: ["validator"], isNotifiedByEmail: true },
          [admin.id]: { roles: ["validator"], isNotifiedByEmail: true },
        }),
      ];

      await updateUserForAgency.execute(
        {
          agencyId: agency.id,
          roles: ["validator"],
          userId: nonIcUser.id,
          isNotifiedByEmail: false,
          email: nonIcUser.email,
        },
        admin,
      );

      expectToEqual(uow.agencyRepository.agencies, [
        toAgencyWithRights(
          new AgencyDtoBuilder(agency).withUpdatedAt(timeGateway.now()).build(),
          {
            [nonIcUser.id]: { roles: ["validator"], isNotifiedByEmail: false },
            [admin.id]: { roles: ["validator"], isNotifiedByEmail: true },
          },
        ),
      ]);
    });

    it("agency-admin can update isNotifiedByEmail for another user", async () => {
      const nonIcUser: User = {
        ...notAdminUser,
        proConnect: null,
      };
      uow.userRepository.users = [nonIcUser, agencyAdminUser];
      uow.agencyRepository.agencies = [
        toAgencyWithRights(agency, {
          [nonIcUser.id]: { roles: ["validator"], isNotifiedByEmail: true },
          [agencyAdminUser.id]: {
            roles: ["agency-admin", "validator"],
            isNotifiedByEmail: true,
          },
        }),
      ];

      await updateUserForAgency.execute(
        {
          agencyId: agency.id,
          roles: ["validator"],
          userId: nonIcUser.id,
          isNotifiedByEmail: false,
          email: nonIcUser.email,
        },
        {
          ...agencyAdmin,
          agencyRights: [
            {
              agency: toAgencyDtoForAgencyUsersAndAdmins(agency, []),
              roles: ["agency-admin", "validator"],
              isNotifiedByEmail: false,
            },
          ],
        },
      );

      expectToEqual(uow.agencyRepository.agencies, [
        toAgencyWithRights(
          new AgencyDtoBuilder(agency).withUpdatedAt(timeGateway.now()).build(),
          {
            [nonIcUser.id]: { roles: ["validator"], isNotifiedByEmail: false },
            [agencyAdmin.id]: {
              roles: ["agency-admin", "validator"],
              isNotifiedByEmail: true,
            },
          },
        ),
      ]);
    });

    it("user can update its own isNotifiedByEmail", async () => {
      uow.userRepository.users = [notAdmin, agencyAdminUser];
      uow.agencyRepository.agencies = [
        toAgencyWithRights(agency, {
          [notAdmin.id]: { roles: ["validator"], isNotifiedByEmail: true },
          [agencyAdminUser.id]: {
            roles: ["agency-admin", "validator"],
            isNotifiedByEmail: true,
          },
        }),
      ];

      await updateUserForAgency.execute(
        {
          agencyId: agency.id,
          roles: ["validator"],
          userId: notAdmin.id,
          isNotifiedByEmail: false,
          email: notAdmin.email,
        },
        {
          ...notAdmin,
          agencyRights: [
            {
              agency: toAgencyDtoForAgencyUsersAndAdmins(agency, []),
              roles: ["validator"],
              isNotifiedByEmail: true,
            },
          ],
        },
      );

      expectToEqual(uow.agencyRepository.agencies, [
        toAgencyWithRights(
          new AgencyDtoBuilder(agency).withUpdatedAt(timeGateway.now()).build(),
          {
            [notAdmin.id]: { roles: ["validator"], isNotifiedByEmail: false },
            [agencyAdmin.id]: {
              roles: ["agency-admin", "validator"],
              isNotifiedByEmail: true,
            },
          },
        ),
      ]);
    });
  });
});
