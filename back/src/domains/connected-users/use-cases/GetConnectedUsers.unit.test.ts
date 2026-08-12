import {
  AgencyDtoBuilder,
  type AgencyRight,
  type AgencyUserRight,
  ConnectedUserBuilder,
  errors,
  expectPromiseToFailWithError,
  expectToEqual,
  toAgencyDtoForAgencyUsersAndAdmins,
} from "shared";
import { toAgencyWithRights } from "../../../utils/agency";
import { fakeProConnectSiret } from "../../core/authentication/connected-user/adapters/oauth-gateway/InMemoryOAuthGateway";
import {
  createInMemoryUow,
  type InMemoryUnitOfWork,
} from "../../core/unit-of-work/adapters/createInMemoryUow";
import { InMemoryUowPerformer } from "../../core/unit-of-work/adapters/InMemoryUowPerformer";
import {
  type GetConnectedUsers,
  makeGetConnectedUsers,
} from "./GetConnectedUsers";

describe("GetConnectedUsers", () => {
  const johnBuilder = new ConnectedUserBuilder()
    .withId("john-123")
    .withFirstName("John")
    .withLastName("Lennon")
    .withEmail("john@mail.com")
    .withCreatedAt(new Date())
    .withProConnectInfos({
      externalId: "john-external-id",
      siret: fakeProConnectSiret,
    });

  const johnUser = johnBuilder.buildUser();
  const connectedJohnUser = johnBuilder.build();

  const paulBuilder = new ConnectedUserBuilder()
    .withId("paul-456")
    .withFirstName("Paul")
    .withLastName("McCartney")
    .withEmail("paul@mail.com")
    .withCreatedAt(new Date())
    .withProConnectInfos({
      externalId: "paul-external-id",
      siret: fakeProConnectSiret,
    });

  const paulUser = paulBuilder.buildUser();
  const connectedPaulUser = paulBuilder.build();

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

  const notBackOfficeUserBuilder = new ConnectedUserBuilder(connectedBackOffice)
    .withProConnectInfos({
      externalId: "not-backoffice-admin",
      siret: fakeProConnectSiret,
    })
    .withIsAdmin(false);
  const notBackOfficeUser = notBackOfficeUserBuilder.buildUser();
  const connectedNotBackOffice = notBackOfficeUserBuilder.build();

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
    .withEmail("jack.admin@mail.com")
    .withCreatedAt(new Date())
    .withProConnectInfos({
      externalId: "jack-admin-external-id",
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

  const agencyWithRefersToWithRights = toAgencyWithRights(agencyWithRefersTo, {
    [agencyAdminUser.id]: {
      roles: ["agency-admin"],
      isNotifiedByEmail: true,
    },
  });

  let getConnectedUsers: GetConnectedUsers;
  let uow: InMemoryUnitOfWork;

  beforeEach(() => {
    uow = createInMemoryUow();
    getConnectedUsers = makeGetConnectedUsers({
      uowPerformer: new InMemoryUowPerformer(uow),
    });
  });

  describe("wrong paths", () => {
    it("throws Forbidden if token payload is not backoffice token", async () => {
      uow.userRepository.users = [notBackOfficeUser];

      await expectPromiseToFailWithError(
        getConnectedUsers.execute(
          { agencyRole: "to-review" },
          connectedNotBackOffice,
        ),
        errors.user.forbidden({ userId: notBackOfficeUser.id }),
      );
    });

    it("throws Forbidden if filter has agency id and token payload is not backoffice token neither agency Admin ", async () => {
      uow.userRepository.users = [connectedPaulUser];

      await expectPromiseToFailWithError(
        getConnectedUsers.execute(
          { agencyIds: [agency2.id] },
          connectedPaulUser,
        ),
        errors.user.forbidden({ userId: connectedPaulUser.id }),
      );
    });

    it("throws Forbidden if filter has agencyRole and agencyIds and user is not backoffice nor agency admin", async () => {
      uow.userRepository.users = [connectedPaulUser];

      await expectPromiseToFailWithError(
        getConnectedUsers.execute(
          { agencyRole: "to-review", agencyIds: [agency1.id] },
          connectedPaulUser,
        ),
        errors.user.forbidden({ userId: connectedPaulUser.id }),
      );
    });

    it("throws Forbidden if agency admin requests an agency he is not admin on", async () => {
      uow.userRepository.users = [agencyAdminUser];

      await expectPromiseToFailWithError(
        getConnectedUsers.execute(
          {
            agencyRole: "to-review",
            agencyIds: [agency1.id, agencyWithRefersToWithRights.id],
          },
          agencyAdmin,
        ),
        errors.user.forbidden({ userId: agencyAdminUser.id }),
      );
    });
  });

  describe("params", () => {
    it("gets the users by agencyRole which have at least one agency with the given role", async () => {
      uow.userRepository.users = [johnUser, paulUser, backOfficeUser];
      uow.agencyRepository.agencies = [agency1WithRights, agency2WithRights];

      const users = await getConnectedUsers.execute(
        { agencyRole: "to-review" },
        connectedBackOffice,
      );

      expectToEqual(users, [
        {
          ...connectedJohnUser,
          agencyRights: [
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
          ],
        },
      ]);
    });

    describe("byAgencyId", () => {
      it("gets the users by agencyId which have at least one agency with the given role", async () => {
        uow.userRepository.users = [johnUser, paulUser, backOfficeUser];
        uow.agencyRepository.agencies = [agency1WithRights, agency2WithRights];

        const users = await getConnectedUsers.execute(
          { agencyIds: [agency1.id] },
          connectedBackOffice,
        );

        expectToEqual(users, [
          {
            ...connectedJohnUser,
            agencyRights: [
              {
                agency: toAgencyDtoForAgencyUsersAndAdmins(agency1, []),
                isNotifiedByEmail: true,
                roles: ["to-review"],
              },
            ],
          },
          {
            ...connectedPaulUser,
            agencyRights: [
              {
                agency: toAgencyDtoForAgencyUsersAndAdmins(agency1, []),
                isNotifiedByEmail: true,
                roles: ["counsellor"],
              },
            ],
          },
        ]);
      });

      it("gets the users by agencyId when agency admin request it", async () => {
        uow.userRepository.users = [
          johnUser,
          paulUser,
          backOfficeUser,
          agencyAdminUser,
        ];
        uow.agencyRepository.agencies = [
          agency1WithRights,
          agency2WithRights,
          agencyWithRefersToWithRights,
        ];

        const users = await getConnectedUsers.execute(
          { agencyIds: [agencyWithRefersToWithRights.id] },
          agencyAdmin,
        );

        expectToEqual(users, [
          {
            ...agencyAdmin,
            agencyRights: [
              {
                agency: toAgencyDtoForAgencyUsersAndAdmins(agencyWithRefersTo, [
                  agencyAdminUser.email,
                ]),
                isNotifiedByEmail: true,
                roles: ["agency-admin"],
              },
            ],
          },
        ]);
      });
    });

    describe("byAgencyRoleAndAgencyIds", () => {
      it.each([
        {
          currentUserLabel: "backoffice admin",
          currentUser: connectedBackOffice,
        },
        {
          currentUserLabel: "agency admin",
          currentUser: agencyAdmin,
        },
      ])("gets the users by agencyRole and agencyIds when $currentUserLabel requests it", async ({
        currentUser,
      }) => {
        uow.userRepository.users = [
          johnUser,
          paulUser,
          backOfficeUser,
          agencyAdminUser,
        ];
        uow.agencyRepository.agencies = [
          toAgencyWithRights(agencyWithRefersTo, {
            [johnUser.id]: toReviewAndNotifiedUserRight,
            [agencyAdminUser.id]: {
              roles: ["agency-admin"],
              isNotifiedByEmail: true,
            },
          }),
          agency2WithRights,
        ];

        const users = await getConnectedUsers.execute(
          { agencyRole: "to-review", agencyIds: [agencyWithRefersTo.id] },
          currentUser,
        );

        expectToEqual(users, [
          {
            ...connectedJohnUser,
            agencyRights: [
              {
                agency: toAgencyDtoForAgencyUsersAndAdmins(agencyWithRefersTo, [
                  agencyAdminUser.email,
                ]),
                isNotifiedByEmail: true,
                roles: ["to-review"],
              },
            ],
          },
        ]);
      });
    });
  });

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
      const noNamesConnectedUserA = noNamesUserBuilderA.build();
      const noNamesUserB = noNamesUserBuilderB.buildUser();
      const noNamesConnectedUserB = noNamesUserBuilderB.build();

      uow.userRepository.users = [noNamesUserB, johnUser, noNamesUserA];
      uow.agencyRepository.agencies = [
        toAgencyWithRights(agency1, {
          [johnUser.id]: toReviewAndNotifiedUserRight,
          [noNamesUserB.id]: toReviewAndNotifiedUserRight,
          [noNamesUserA.id]: toReviewAndNotifiedUserRight,
        }),
      ];

      const users = await getConnectedUsers.execute(
        { agencyIds: [agency1.id] },
        connectedBackOffice,
      );

      const commonAgencyRight: AgencyRight = {
        agency: toAgencyDtoForAgencyUsersAndAdmins(agency1, []),
        ...toReviewAndNotifiedUserRight,
      };

      expectToEqual(users, [
        {
          ...noNamesConnectedUserA,
          agencyRights: [commonAgencyRight],
        },
        {
          ...noNamesConnectedUserB,
          agencyRights: [commonAgencyRight],
        },
        {
          ...connectedJohnUser,
          agencyRights: [commonAgencyRight],
        },
      ]);
    });

    it("people with firstnames are ordered alphabetically, and last name alphabeticaly when same firstname", async () => {
      const billyElliotUserBuilder = new ConnectedUserBuilder()
        .withId("billyA")
        .withFirstName("Billy")
        .withLastName("Elliot")
        .withEmail("");

      const billyMartinsUserBuilder = new ConnectedUserBuilder()
        .withId("billyB")
        .withFirstName("Billy")
        .withLastName("Martins")
        .withEmail("");

      const billyElliotUser = billyElliotUserBuilder.buildUser();
      const billyElliotConnectedUser = billyElliotUserBuilder.build();
      const billyMartinsUser = billyMartinsUserBuilder.buildUser();
      const billyMartinsConnectedUser = billyMartinsUserBuilder.build();

      uow.userRepository.users = [johnUser, billyMartinsUser, billyElliotUser];
      uow.agencyRepository.agencies = [
        toAgencyWithRights(agency1, {
          [johnUser.id]: toReviewAndNotifiedUserRight,
          [billyMartinsUser.id]: toReviewAndNotifiedUserRight,
          [billyElliotUser.id]: toReviewAndNotifiedUserRight,
        }),
      ];

      const commonAgencyRight: AgencyRight = {
        agency: toAgencyDtoForAgencyUsersAndAdmins(agency1, []),
        ...toReviewAndNotifiedUserRight,
      };

      expectToEqual(
        await getConnectedUsers.execute(
          { agencyIds: [agency1.id] },
          connectedBackOffice,
        ),
        [
          {
            ...billyElliotConnectedUser,
            agencyRights: [commonAgencyRight],
          },
          {
            ...billyMartinsConnectedUser,
            agencyRights: [commonAgencyRight],
          },
          {
            ...connectedJohnUser,
            agencyRights: [commonAgencyRight],
          },
        ],
      );
    });
  });
});
