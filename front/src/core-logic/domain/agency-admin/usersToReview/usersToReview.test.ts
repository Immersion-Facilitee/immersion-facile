import {
  AgencyDtoBuilder,
  type AgencyUserForListing,
  ConnectedUserBuilder,
  expectToEqual,
  toAgencyDtoForAgencyUsersAndAdmins,
} from "shared";
import { connectedUsersAdminSlice } from "src/core-logic/domain/admin/connectedUsersAdmin/connectedUsersAdmin.slice";
import {
  type UserToReview,
  usersToReviewSlice,
  usersToReviewState,
} from "src/core-logic/domain/agency-admin/usersToReview/usersToReview.slice";
import { feedbacksSelectors } from "src/core-logic/domain/feedback/feedback.selectors";
import {
  createTestStore,
  type TestDependencies,
} from "src/core-logic/storeConfig/createTestStore";
import type { ReduxStore } from "src/core-logic/storeConfig/store";

describe("usersToReview", () => {
  let store: ReduxStore;
  let dependencies: TestDependencies;
  const agency = new AgencyDtoBuilder().build();
  const agencyForUsers = toAgencyDtoForAgencyUsersAndAdmins(agency, []);
  const connectedUser = new ConnectedUserBuilder()
    .withAgencyRights([
      {
        agency: agencyForUsers,
        roles: ["agency-admin"],
        isNotifiedByEmail: false,
      },
    ])
    .build();

  beforeEach(() => {
    ({ store, dependencies } = createTestStore({
      usersToReview: usersToReviewState,
    }));
  });

  it("should get users in review", () => {
    store.dispatch(
      usersToReviewSlice.actions.fetchUsersToReviewRequested({
        feedbackTopic: "agency-users-to-review",
        agencies: [agencyForUsers],
      }),
    );

    expectToEqual(store.getState().usersToReview, {
      usersToReview: [],
      isLoading: true,
      filters: { agencies: [agencyForUsers] },
    });

    const agencyUser: AgencyUserForListing = {
      id: connectedUser.id,
      email: connectedUser.email,
      firstName: connectedUser.firstName,
      lastName: connectedUser.lastName,
      isProConnectUser: connectedUser.proConnect !== null,
      agencyRightsByAgencyId: {
        [agencyForUsers.id]: {
          agency: agencyForUsers,
          roles: ["to-review"],
          isNotifiedByEmail: false,
        },
      },
    };

    dependencies.agencyGateway.getAgencyUsersResponse$.next([agencyUser]);

    expectToEqual(store.getState().usersToReview, {
      usersToReview: [
        {
          id: connectedUser.id,
          email: connectedUser.email,
          firstName: connectedUser.firstName,
          lastName: connectedUser.lastName,
          agency: agencyForUsers,
        },
      ],
      isLoading: false,
      filters: { agencies: [agencyForUsers] },
    });
  });

  it("should stop loading when fetching users to review fails", () => {
    store.dispatch(
      usersToReviewSlice.actions.fetchUsersToReviewRequested({
        feedbackTopic: "agency-users-to-review",
        agencies: [agencyForUsers],
      }),
    );

    expectToEqual(store.getState().usersToReview, {
      usersToReview: [],
      isLoading: true,
      filters: { agencies: [agencyForUsers] },
    });

    const errorMessage = "Error fetching users in review";
    dependencies.agencyGateway.getAgencyUsersResponse$.error(
      new Error(errorMessage),
    );

    expectToEqual(store.getState().usersToReview, {
      usersToReview: [],
      isLoading: false,
      filters: { agencies: [agencyForUsers] },
    });

    expectToEqual(
      feedbacksSelectors.feedbacks(store.getState())["agency-users-to-review"],
      {
        level: "error",
        message: errorMessage,
        on: "fetch",
        title:
          "Problème rencontré lors de la récupération des rattachements en attente",
      },
    );
  });

  it("should refetch users after rejecting a registration", () => {
    const otherAgency = new AgencyDtoBuilder()
      .withId("other-agency-id")
      .withName("Other agency")
      .build();
    const otherAgencyForUsers = toAgencyDtoForAgencyUsersAndAdmins(
      otherAgency,
      [],
    );

    const userToReview: UserToReview = {
      id: connectedUser.id,
      email: connectedUser.email,
      firstName: connectedUser.firstName,
      lastName: connectedUser.lastName,
      agency: agencyForUsers,
    };
    const otherUserToReview: UserToReview = {
      ...userToReview,
      agency: otherAgencyForUsers,
    };

    ({ store, dependencies } = createTestStore({
      usersToReview: {
        usersToReview: [userToReview, otherUserToReview],
        isLoading: false,
        filters: {
          agencies: [agencyForUsers, otherAgencyForUsers],
        },
      },
    }));

    store.dispatch(
      connectedUsersAdminSlice.actions.rejectAgencyWithRoleToUserSucceeded({
        agencyId: agency.id,
        justification: "osef",
        userId: connectedUser.id,
        feedbackTopic: "agency-users-to-review",
      }),
    );

    expectToEqual(store.getState().usersToReview.isLoading, true);

    const remainingAgencyUser: AgencyUserForListing = {
      id: connectedUser.id,
      email: connectedUser.email,
      firstName: connectedUser.firstName,
      lastName: connectedUser.lastName,
      isProConnectUser: connectedUser.proConnect !== null,
      agencyRightsByAgencyId: {
        [otherAgencyForUsers.id]: {
          agency: otherAgencyForUsers,
          roles: ["to-review"],
          isNotifiedByEmail: false,
        },
      },
    };

    dependencies.agencyGateway.getAgencyUsersResponse$.next([
      remainingAgencyUser,
    ]);

    expectToEqual(store.getState().usersToReview, {
      usersToReview: [otherUserToReview],
      isLoading: false,
      filters: {
        agencies: [agencyForUsers, otherAgencyForUsers],
      },
    });

    expectToEqual(
      feedbacksSelectors.feedbacks(store.getState())["agency-users-to-review"],
      {
        level: "success",
        message: "La demande de cet utilisateur a bien été rejetée.",
        on: "delete",
        title: "Demande de rattachement rejetée",
      },
    );
  });

  it("should refetch users after registering a user", () => {
    const otherAgency = new AgencyDtoBuilder()
      .withId("other-agency-id")
      .withName("Other agency")
      .build();
    const otherAgencyForUsers = toAgencyDtoForAgencyUsersAndAdmins(
      otherAgency,
      [],
    );

    const userToReview: UserToReview = {
      id: connectedUser.id,
      email: connectedUser.email,
      firstName: connectedUser.firstName,
      lastName: connectedUser.lastName,
      agency: agencyForUsers,
    };
    const otherUserToReview: UserToReview = {
      ...userToReview,
      agency: otherAgencyForUsers,
    };

    ({ store, dependencies } = createTestStore({
      usersToReview: {
        usersToReview: [userToReview, otherUserToReview],
        isLoading: false,
        filters: {
          agencies: [agencyForUsers, otherAgencyForUsers],
        },
      },
    }));

    store.dispatch(
      connectedUsersAdminSlice.actions.registerAgencyWithRoleToUserSucceeded({
        agencyId: agency.id,
        userId: connectedUser.id,
        roles: ["validator"],
        email: connectedUser.email,
        isNotifiedByEmail: false,
        feedbackTopic: "agency-users-to-review",
      }),
    );

    expectToEqual(store.getState().usersToReview.isLoading, true);

    const remainingAgencyUser: AgencyUserForListing = {
      id: connectedUser.id,
      email: connectedUser.email,
      firstName: connectedUser.firstName,
      lastName: connectedUser.lastName,
      isProConnectUser: connectedUser.proConnect !== null,
      agencyRightsByAgencyId: {
        [otherAgencyForUsers.id]: {
          agency: otherAgencyForUsers,
          roles: ["to-review"],
          isNotifiedByEmail: false,
        },
      },
    };

    dependencies.agencyGateway.getAgencyUsersResponse$.next([
      remainingAgencyUser,
    ]);

    expectToEqual(store.getState().usersToReview, {
      usersToReview: [otherUserToReview],
      isLoading: false,
      filters: {
        agencies: [agencyForUsers, otherAgencyForUsers],
      },
    });

    expectToEqual(
      feedbacksSelectors.feedbacks(store.getState())["agency-users-to-review"],
      {
        level: "success",
        message:
          "L'utilisateur a bien été rattaché à l'organisme avec les droits demandés.",
        on: "update",
        title: "L'utilisateur a bien été ajouté",
      },
    );
  });
});
