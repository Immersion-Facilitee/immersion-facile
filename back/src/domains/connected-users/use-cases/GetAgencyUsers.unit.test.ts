import {
  type AgencyDto,
  AgencyDtoBuilder,
  type AgencyRight,
  type AgencyRole,
  type AgencyUserForListing,
  type AgencyUserRight,
  type ConnectedUser,
  ConnectedUserBuilder,
  closedOrRejectedAgencyStatuses,
  errors,
  expectPromiseToFailWithError,
  expectToEqual,
  toAgencyDtoForAgencyUsersAndAdmins,
  toAgencyRightsByAgencyId,
  type UserWithAdminRights,
} from "shared";
import { toAgencyWithRights } from "../../../utils/agency";
import { fakeProConnectSiret } from "../../core/authentication/connected-user/adapters/oauth-gateway/InMemoryOAuthGateway";
import {
  createInMemoryUow,
  type InMemoryUnitOfWork,
} from "../../core/unit-of-work/adapters/createInMemoryUow";
import { InMemoryUowPerformer } from "../../core/unit-of-work/adapters/InMemoryUowPerformer";
import { type GetAgencyUsers, makeGetAgencyUsers } from "./GetAgencyUsers";

const toExpectedAgencyUserForListing = (
  user: UserWithAdminRights,
  agencyRights: AgencyRight[],
): AgencyUserForListing => ({
  id: user.id,
  email: user.email,
  firstName: user.firstName,
  lastName: user.lastName,
  isProConnectUser: user.proConnect !== null,
  agencyRightsByAgencyId: toAgencyRightsByAgencyId(agencyRights),
});

describe("GetAgencyUsers", () => {
  const johnUser = new ConnectedUserBuilder()
    .withId("john-123")
    .withFirstName("John")
    .withLastName("Lennon")
    .withEmail("john@mail.com")
    .withCreatedAt(new Date())
    .withProConnectInfos({
      externalId: "john-external-id",
      siret: fakeProConnectSiret,
    })
    .buildUser();

  const paulUser = new ConnectedUserBuilder()
    .withId("paul-456")
    .withFirstName("Paul")
    .withLastName("McCartney")
    .withEmail("paul@mail.com")
    .withCreatedAt(new Date())
    .withProConnectInfos({
      externalId: "paul-external-id",
      siret: fakeProConnectSiret,
    })
    .buildUser();

  const backOfficeUserBuilder = new ConnectedUserBuilder()
    .withId("backoffice-admin")
    .withFirstName("Jack")
    .withLastName("The Admin")
    .withEmail("jack.admin@mail.com")
    .withCreatedAt(new Date())
    .withProConnectInfos({
      externalId: "jack-admin-external-id",
      siret: fakeProConnectSiret,
    })
    .withIsAdmin(true);

  const backOfficeUser = backOfficeUserBuilder.buildUser();
  const connectedBackOffice = backOfficeUserBuilder.build();

  const toReviewAndNotifiedUserRight: AgencyUserRight = {
    roles: ["to-review"],
    isNotifiedByEmail: true,
  };

  const agency1 = new AgencyDtoBuilder().withId("agency-1").build();
  const agency2 = new AgencyDtoBuilder().withId("agency-2").build();
  const agencyWithRefersTo = new AgencyDtoBuilder()
    .withId("agency-with-refers-to")
    .withRefersToAgencyInfo({
      refersToAgencyId: agency2.id,
      refersToAgencyName: agency2.name,
      refersToAgencyContactEmail: agency2.contactEmail,
    })
    .build();

  const agencyAdminUserBuilder = new ConnectedUserBuilder()
    .withId("agency-admin")
    .withFirstName("Jack")
    .withLastName("The agency Admin")
    .withEmail("jack.agency.admin@mail.com")
    .withCreatedAt(new Date())
    .withProConnectInfos({
      externalId: "jack-agency-admin-external-id",
      siret: fakeProConnectSiret,
    })
    .withAgencyRights([
      {
        agency: toAgencyDtoForAgencyUsersAndAdmins(agencyWithRefersTo, []),
        roles: ["agency-admin"],
        isNotifiedByEmail: true,
      },
    ]);

  const agencyAdminUser = agencyAdminUserBuilder.buildUser();
  const agencyAdmin = agencyAdminUserBuilder.build();

  const agencyWithRefersToWithRights = toAgencyWithRights(agencyWithRefersTo, {
    [agencyAdminUser.id]: {
      roles: ["agency-admin"],
      isNotifiedByEmail: true,
    },
  });

  const agency1WithRights = toAgencyWithRights(agency1, {
    [johnUser.id]: toReviewAndNotifiedUserRight,
    [paulUser.id]: {
      roles: ["counsellor"],
      isNotifiedByEmail: true,
    },
  });

  const agency2WithRights = toAgencyWithRights(agency2, {
    [johnUser.id]: {
      roles: ["validator"],
      isNotifiedByEmail: true,
    },
    [paulUser.id]: {
      roles: ["validator"],
      isNotifiedByEmail: true,
    },
  });

  let getAgencyUsers: GetAgencyUsers;
  let uow: InMemoryUnitOfWork;

  beforeEach(() => {
    uow = createInMemoryUow();
    getAgencyUsers = makeGetAgencyUsers({
      uowPerformer: new InMemoryUowPerformer(uow),
    });
  });

  describe("wrong paths", () => {
    it("throws Forbidden if user is not backoffice nor agency admin", async () => {
      const paul = new ConnectedUserBuilder().withId(paulUser.id).build();

      uow.userRepository.users = [paulUser];

      await expectPromiseToFailWithError(
        getAgencyUsers.execute({ agencyIds: [agency1.id] }, paul),
        errors.user.forbidden({ userId: paulUser.id }),
      );
    });

    it("throws Forbidden if agency admin requests without agencyIds", async () => {
      uow.userRepository.users = [agencyAdminUser];

      await expectPromiseToFailWithError(
        getAgencyUsers.execute({ agencyRole: "to-review" }, agencyAdmin),
        errors.user.forbidden({ userId: agencyAdminUser.id }),
      );
    });

    it("throws Forbidden if agency admin requests an agency he is not admin on", async () => {
      uow.userRepository.users = [agencyAdminUser];

      await expectPromiseToFailWithError(
        getAgencyUsers.execute(
          {
            agencyIds: [agency1.id],
          },
          agencyAdmin,
        ),
        errors.user.forbidden({ userId: agencyAdminUser.id }),
      );
    });

    it("throws BadRequest if agencyRole is to-review and an agency has status needsReview", async () => {
      const needsReviewAgency = new AgencyDtoBuilder(agencyWithRefersTo)
        .withStatus("needsReview")
        .build();

      const agencyAdminOnNeedsReviewAgency = new ConnectedUserBuilder(
        agencyAdmin,
      )
        .withAgencyRights([
          {
            agency: toAgencyDtoForAgencyUsersAndAdmins(needsReviewAgency, []),
            roles: ["agency-admin"],
            isNotifiedByEmail: true,
          },
        ])
        .build();

      uow.userRepository.users = [agencyAdminOnNeedsReviewAgency];
      uow.agencyRepository.agencies = [
        toAgencyWithRights(needsReviewAgency, {
          [agencyAdminOnNeedsReviewAgency.id]: {
            roles: ["agency-admin"],
            isNotifiedByEmail: true,
          },
        }),
      ];

      await expectPromiseToFailWithError(
        getAgencyUsers.execute(
          {
            agencyRole: "to-review",
            agencyIds: [needsReviewAgency.id],
          },
          agencyAdminOnNeedsReviewAgency,
        ),
        errors.agency.cannotGetToReviewUsersWhenNeedsReview(),
      );
    });

    it.each(closedOrRejectedAgencyStatuses)(
      "throws Forbidden if current user is not backoffice admin and agency to get by id is %s",
      async (status) => {
        const closedOrRejectedAgency = new AgencyDtoBuilder(agency1)
          .withStatus(status)
          .withStatusJustification("some reason")
          .build();

        const agencyAdminOnClosedOrRejectedAgency = new ConnectedUserBuilder(
          agencyAdmin,
        )
          .withAgencyRights([
            {
              agency: toAgencyDtoForAgencyUsersAndAdmins(
                closedOrRejectedAgency,
                [],
              ),
              roles: ["agency-admin"],
              isNotifiedByEmail: true,
            },
          ])
          .build();

        uow.userRepository.users = [agencyAdminOnClosedOrRejectedAgency];
        uow.agencyRepository.agencies = [
          toAgencyWithRights(closedOrRejectedAgency, {
            [agencyAdminOnClosedOrRejectedAgency.id]: {
              isNotifiedByEmail: true,
              roles: ["validator", "agency-admin"],
            },
          }),
        ];

        await expectPromiseToFailWithError(
          getAgencyUsers.execute(
            {
              agencyIds: [closedOrRejectedAgency.id],
            },
            agencyAdminOnClosedOrRejectedAgency,
          ),
          errors.user.forbidden({
            userId: agencyAdminOnClosedOrRejectedAgency.id,
          }),
        );
      },
    );
  });

  describe("right paths", () => {
    it("gets users by agencyRole without agencyIds when backoffice admin requests it, with all rights", async () => {
      uow.userRepository.users = [johnUser, paulUser, backOfficeUser];
      uow.agencyRepository.agencies = [agency1WithRights, agency2WithRights];

      const users = await getAgencyUsers.execute(
        { agencyRole: "to-review" },
        connectedBackOffice,
      );

      expectToEqual(users, [
        toExpectedAgencyUserForListing(johnUser, [
          {
            agency: toAgencyDtoForAgencyUsersAndAdmins(agency1, []),
            isNotifiedByEmail: true,
            roles: ["to-review"],
          },
          {
            agency: toAgencyDtoForAgencyUsersAndAdmins(agency2, []),
            isNotifiedByEmail: true,
            roles: ["validator"],
          },
        ]),
      ]);
    });

    it("backoffice admin can request to-review users on needsReview agencies", async () => {
      const needsReviewAgency = new AgencyDtoBuilder(agency1)
        .withStatus("needsReview")
        .build();

      uow.userRepository.users = [johnUser, backOfficeUser];
      uow.agencyRepository.agencies = [
        toAgencyWithRights(needsReviewAgency, {
          [johnUser.id]: toReviewAndNotifiedUserRight,
        }),
      ];

      const users = await getAgencyUsers.execute(
        {
          agencyRole: "to-review",
          agencyIds: [needsReviewAgency.id],
        },
        connectedBackOffice,
      );

      expectToEqual(users, [
        toExpectedAgencyUserForListing(johnUser, [
          {
            agency: toAgencyDtoForAgencyUsersAndAdmins(needsReviewAgency, []),
            isNotifiedByEmail: true,
            roles: ["to-review"],
          },
        ]),
      ]);
    });

    it.each([
      {
        currentUserLabel: "backoffice admin",
        currentUser: connectedBackOffice,
      },
      {
        currentUserLabel: "agency admin",
        currentUser: agencyAdmin,
      },
    ])(
      "gets the users by agencyId when $currentUserLabel requests it",
      async ({ currentUser }) => {
        uow.userRepository.users = [agencyAdminUser];
        uow.agencyRepository.agencies = [agencyWithRefersToWithRights];

        const users = await getAgencyUsers.execute(
          { agencyIds: [agencyWithRefersToWithRights.id] },
          currentUser,
        );

        expectToEqual(users, [
          toExpectedAgencyUserForListing(agencyAdminUser, [
            {
              agency: toAgencyDtoForAgencyUsersAndAdmins(agencyWithRefersTo, [
                agencyAdminUser.email,
              ]),
              isNotifiedByEmail: true,
              roles: ["agency-admin"],
            },
          ]),
        ]);
      },
    );

    it.each([
      {
        currentUserLabel: "backoffice admin",
        currentUser: connectedBackOffice,
      },
      {
        currentUserLabel: "agency admin",
        currentUser: agencyAdmin,
      },
    ])(
      "gets the users by agencyRole and agencyIds when $currentUserLabel requests it",
      async ({ currentUser }) => {
        uow.userRepository.users = [
          johnUser,
          paulUser,
          backOfficeUser,
          agencyAdminUser,
        ];
        uow.agencyRepository.agencies = [
          {
            ...agencyWithRefersToWithRights,
            usersRights: {
              ...agencyWithRefersToWithRights.usersRights,
              [johnUser.id]: toReviewAndNotifiedUserRight,
            },
          },
          agency2WithRights,
        ];

        const users = await getAgencyUsers.execute(
          { agencyRole: "to-review", agencyIds: [agencyWithRefersTo.id] },
          currentUser,
        );

        expectToEqual(users, [
          toExpectedAgencyUserForListing(johnUser, [
            {
              agency: toAgencyDtoForAgencyUsersAndAdmins(agencyWithRefersTo, [
                agencyAdminUser.email,
              ]),
              isNotifiedByEmail: true,
              roles: ["to-review"],
            },
          ]),
        ]);
      },
    );

    it("returns all rights on requested agencies when agency-admin filters by to-review", async () => {
      const agencyAdminOnBothAgencies = new ConnectedUserBuilder()
        .withId("agency-admin-on-both")
        .withEmail("admin.both@mail.com")
        .withAgencyRights([
          {
            agency: toAgencyDtoForAgencyUsersAndAdmins(agency1, []),
            roles: ["agency-admin"],
            isNotifiedByEmail: true,
          },
          {
            agency: toAgencyDtoForAgencyUsersAndAdmins(agency2, []),
            roles: ["agency-admin"],
            isNotifiedByEmail: true,
          },
        ])
        .build();

      const agencyAdminRight: AgencyUserRight = {
        roles: ["agency-admin"],
        isNotifiedByEmail: true,
      };

      uow.userRepository.users = [johnUser, agencyAdminOnBothAgencies];
      uow.agencyRepository.agencies = [
        toAgencyWithRights(agency1, {
          [johnUser.id]: toReviewAndNotifiedUserRight,
          [agencyAdminOnBothAgencies.id]: agencyAdminRight,
        }),
        toAgencyWithRights(agency2, {
          [johnUser.id]: {
            roles: ["counsellor"],
            isNotifiedByEmail: true,
          },
          [agencyAdminOnBothAgencies.id]: agencyAdminRight,
        }),
      ];

      const users = await getAgencyUsers.execute(
        {
          agencyRole: "to-review",
          agencyIds: [agency1.id, agency2.id],
        },
        agencyAdminOnBothAgencies,
      );

      expectToEqual(users, [
        toExpectedAgencyUserForListing(johnUser, [
          {
            agency: toAgencyDtoForAgencyUsersAndAdmins(agency1, [
              agencyAdminOnBothAgencies.email,
            ]),
            isNotifiedByEmail: true,
            roles: ["to-review"],
          },
          {
            agency: toAgencyDtoForAgencyUsersAndAdmins(agency2, [
              agencyAdminOnBothAgencies.email,
            ]),
            isNotifiedByEmail: true,
            roles: ["counsellor"],
          },
        ]),
      ]);
    });

    it.each(closedOrRejectedAgencyStatuses)(
      "when current user is backoffice admin and agency is %s",
      async (status) => {
        const agencyWithStatus = new AgencyDtoBuilder(agency1)
          .withStatus(status)
          .withStatusJustification("some reason")
          .build();

        uow.userRepository.users = [agencyAdminUser, backOfficeUser];
        uow.agencyRepository.agencies = [
          toAgencyWithRights(agencyWithStatus, {
            [agencyAdminUser.id]: {
              isNotifiedByEmail: true,
              roles: ["validator", "agency-admin"],
            },
          }),
        ];

        const users = await getAgencyUsers.execute(
          { agencyIds: [agencyWithStatus.id] },
          connectedBackOffice,
        );

        expectToEqual(users, [
          toExpectedAgencyUserForListing(agencyAdminUser, [
            {
              agency: toAgencyDtoForAgencyUsersAndAdmins(agencyWithStatus, [
                agencyAdminUser.email,
              ]),
              isNotifiedByEmail: true,
              roles: ["validator", "agency-admin"],
            },
          ]),
        ]);
      },
    );

    describe("sort users, by priorities", () => {
      it("people with no firstnames should be first, ordered alphabetically by email", async () => {
        const noNamesUserBuilderA = new ConnectedUserBuilder()
          .withId("noNameA")
          .withFirstName("")
          .withLastName("LastNameA")
          .withEmail("a@mail.com")
          .withCreatedAt(new Date());

        const noNamesUserBuilderB = new ConnectedUserBuilder()
          .withId("noNameB")
          .withFirstName("")
          .withLastName("")
          .withEmail("b@mail.com")
          .withCreatedAt(new Date());

        const noNamesUserA = noNamesUserBuilderA.buildUser();
        const noNamesUserB = noNamesUserBuilderB.buildUser();

        uow.userRepository.users = [noNamesUserB, johnUser, noNamesUserA];
        uow.agencyRepository.agencies = [
          toAgencyWithRights(agency1, {
            [johnUser.id]: toReviewAndNotifiedUserRight,
            [noNamesUserB.id]: toReviewAndNotifiedUserRight,
            [noNamesUserA.id]: toReviewAndNotifiedUserRight,
          }),
        ];

        const users = await getAgencyUsers.execute(
          { agencyIds: [agency1.id] },
          connectedBackOffice,
        );

        const commonAgencyRight: AgencyRight = {
          agency: toAgencyDtoForAgencyUsersAndAdmins(agency1, []),
          ...toReviewAndNotifiedUserRight,
        };

        expectToEqual(users, [
          toExpectedAgencyUserForListing(noNamesUserA, [commonAgencyRight]),
          toExpectedAgencyUserForListing(noNamesUserB, [commonAgencyRight]),
          toExpectedAgencyUserForListing(johnUser, [commonAgencyRight]),
        ]);
      });
    });
  });

  describe("when a non admin agency user requests users to review", () => {
    const connectedUserWithRole = (
      role: AgencyRole,
      agency: AgencyDto,
      id: string,
    ): ConnectedUser =>
      new ConnectedUserBuilder()
        .withId(id)
        .withEmail(`${id}@mail.com`)
        .withAgencyRights([
          {
            agency: toAgencyDtoForAgencyUsersAndAdmins(agency, []),
            roles: [role],
            isNotifiedByEmail: false,
          },
        ])
        .build();

    it.each(["counsellor", "validator", "agency-viewer"])(
      "gets to-review users of their agency when current user is %s",
      async (role) => {
        const agencyUser = connectedUserWithRole(role, agency1, `${role}-user`);

        uow.userRepository.users = [johnUser];
        uow.agencyRepository.agencies = [
          toAgencyWithRights(agency1, {
            [johnUser.id]: toReviewAndNotifiedUserRight,
            [agencyUser.id]: {
              roles: [role],
              isNotifiedByEmail: false,
            },
          }),
        ];

        const users = await getAgencyUsers.execute(
          { agencyRole: "to-review", agencyIds: [agency1.id] },
          agencyUser,
        );

        expectToEqual(users, [
          toExpectedAgencyUserForListing(johnUser, [
            {
              agency: toAgencyDtoForAgencyUsersAndAdmins(agency1, []),
              ...toReviewAndNotifiedUserRight,
            },
          ]),
        ]);
      },
    );

    it("throws Forbidden when a valid agency role requests to-review users of an agency where they have no role", async () => {
      const counsellorOnAgency1 = connectedUserWithRole(
        "counsellor",
        agency1,
        "counsellor-user",
      );

      await expectPromiseToFailWithError(
        getAgencyUsers.execute(
          { agencyRole: "to-review", agencyIds: [agency2.id] },
          counsellorOnAgency1,
        ),
        errors.user.forbidden({ userId: counsellorOnAgency1.id }),
      );
    });

    it("throws Forbidden when the user only has the to-review role", async () => {
      const userWithOnlyToReviewRole = connectedUserWithRole(
        "to-review",
        agency1,
        "to-review-only",
      );

      await expectPromiseToFailWithError(
        getAgencyUsers.execute(
          { agencyRole: "to-review", agencyIds: [agency1.id] },
          userWithOnlyToReviewRole,
        ),
        errors.user.forbidden({ userId: userWithOnlyToReviewRole.id }),
      );
    });

    it("throws Forbidden when a non admin user with a valid agency role requests to-review users of several agencies", async () => {
      const notAdminUserWithValidRoleOnMultipleAgencies =
        new ConnectedUserBuilder()
          .withId("counsellor-on-both")
          .withEmail("counsellor.both@mail.com")
          .withAgencyRights([
            {
              agency: toAgencyDtoForAgencyUsersAndAdmins(agency1, []),
              roles: ["counsellor"],
              isNotifiedByEmail: false,
            },
            {
              agency: toAgencyDtoForAgencyUsersAndAdmins(agency2, []),
              roles: ["counsellor"],
              isNotifiedByEmail: false,
            },
          ])
          .build();

      await expectPromiseToFailWithError(
        getAgencyUsers.execute(
          {
            agencyRole: "to-review",
            agencyIds: [agency1.id, agency2.id],
          },
          notAdminUserWithValidRoleOnMultipleAgencies,
        ),
        errors.user.forbidden({
          userId: notAdminUserWithValidRoleOnMultipleAgencies.id,
        }),
      );
    });
  });
});
