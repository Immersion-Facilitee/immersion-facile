import {
  AgencyDtoBuilder,
  type AgencyRightForListing,
  type AgencyUserForListing,
  type AgencyUserRight,
  ConnectedUserBuilder,
  closedOrRejectedAgencyStatuses,
  errors,
  expectPromiseToFailWithError,
  expectToEqual,
  toAgencyDtoForAgencyUsersAndAdmins,
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

const toExpectedAgencyUser = (
  user: UserWithAdminRights,
  agencyRights: AgencyRightForListing[],
): AgencyUserForListing => {
  const {
    isBackofficeAdmin: _,
    proConnect: __,
    ...userWithoutAdminAndProConnect
  } = user;
  return { ...userWithoutAdminAndProConnect, agencyRights };
};

describe("GetAgencyUsers", () => {
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
      uow.userRepository.users = [paulUser];

      await expectPromiseToFailWithError(
        getAgencyUsers.execute(
          { agencyIds: [agency1.id] },
          paulBuilder.build(),
        ),
        errors.user.forbidden({ userId: paulUser.id }),
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

        uow.userRepository.users = [agencyAdmin];
        uow.agencyRepository.agencies = [
          toAgencyWithRights(closedOrRejectedAgency, {
            [agencyAdmin.id]: {
              isNotifiedByEmail: true,
              roles: ["validator", "agency-admin"],
            },
          }),
        ];

        await expectPromiseToFailWithError(
          getAgencyUsers.execute(
            {
              agencyIds: [agency1.id],
            },
            agencyAdmin,
          ),
          errors.user.forbidden({ userId: agencyAdminUser.id }),
        );
      },
    );
  });

  describe("right paths", () => {
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
        uow.userRepository.users = [
          johnUser,
          paulUser,
          backOfficeUser,
          agencyAdminUser,
        ];
        uow.agencyRepository.agencies = [
          agency1WithRights,
          agencyWithRefersToWithRights,
        ];

        const users = await getAgencyUsers.execute(
          { agencyIds: [agencyWithRefersToWithRights.id] },
          currentUser,
        );

        expectToEqual(users, [
          toExpectedAgencyUser(agencyAdminUser, [
            {
              agencyId: agencyWithRefersTo.id,
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
          toAgencyWithRights(agencyWithRefersTo, {
            [johnUser.id]: toReviewAndNotifiedUserRight,
            [agencyAdminUser.id]: {
              roles: ["agency-admin"],
              isNotifiedByEmail: true,
            },
          }),
          agency2WithRights,
        ];

        const users = await getAgencyUsers.execute(
          { agencyRole: "to-review", agencyIds: [agencyWithRefersTo.id] },
          currentUser,
        );

        expectToEqual(users, [
          toExpectedAgencyUser(johnUser, [
            {
              agencyId: agencyWithRefersTo.id,
              isNotifiedByEmail: true,
              roles: ["to-review"],
            },
          ]),
        ]);
      },
    );

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
          toExpectedAgencyUser(agencyAdminUser, [
            {
              agencyId: agencyWithStatus.id,
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

        const commonAgencyRight: AgencyRightForListing = {
          agencyId: agency1.id,
          ...toReviewAndNotifiedUserRight,
        };

        expectToEqual(users, [
          toExpectedAgencyUser(noNamesUserA, [commonAgencyRight]),
          toExpectedAgencyUser(noNamesUserB, [commonAgencyRight]),
          toExpectedAgencyUser(johnUser, [commonAgencyRight]),
        ]);
      });
    });
  });
});
