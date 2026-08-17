import {
  AgencyDtoBuilder,
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
  const connectedUser = new ConnectedUserBuilder().build();
  const agency = new AgencyDtoBuilder().build();

  beforeEach(() => {
    ({ store, dependencies } = createTestStore({
      usersToReview: usersToReviewState,
    }));
  });

  it("should get users in review", () => {
    store.dispatch(
      usersToReviewSlice.actions.fetchUsersToReviewRequested({
        feedbackTopic: "agency-users-to-review",
        agencyIds: ["agency-id"],
      }),
    );

    expectToEqual(store.getState().usersToReview, {
      usersToReview: [],
      isLoading: true,
    });

    dependencies.authGateway.getConnectedUsersResponse$.next([
      {
        ...connectedUser,
        agencyRights: [
          {
            agency: toAgencyDtoForAgencyUsersAndAdmins(agency, []),
            roles: ["to-review"],
            isNotifiedByEmail: false,
          },
        ],
      },
    ]);

    expectToEqual(store.getState().usersToReview, {
      usersToReview: [
        {
          id: connectedUser.id,
          email: connectedUser.email,
          firstName: connectedUser.firstName,
          lastName: connectedUser.lastName,
          agency: toAgencyDtoForAgencyUsersAndAdmins(agency, []),
        },
      ],
      isLoading: false,
    });
  });

  it("should stop loading when fetching users to review fails", () => {
    store.dispatch(
      usersToReviewSlice.actions.fetchUsersToReviewRequested({
        feedbackTopic: "agency-users-to-review",
        agencyIds: ["agency-id"],
      }),
    );

    expectToEqual(store.getState().usersToReview, {
      usersToReview: [],
      isLoading: true,
    });

    const errorMessage = "Error fetching users in review";
    dependencies.authGateway.getConnectedUsersResponse$.error(
      new Error(errorMessage),
    );

    expectToEqual(store.getState().usersToReview, {
      usersToReview: [],
      isLoading: false,
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

  it("should remove the rejected user registration from the list", () => {
    const otherAgency = new AgencyDtoBuilder()
      .withId("other-agency-id")
      .withName("Other agency")
      .build();

    const userToReview: UserToReview = {
      id: connectedUser.id,
      email: connectedUser.email,
      firstName: connectedUser.firstName,
      lastName: connectedUser.lastName,
      agency: toAgencyDtoForAgencyUsersAndAdmins(agency, []),
    };
    const otherUserToReview: UserToReview = {
      ...userToReview,
      agency: toAgencyDtoForAgencyUsersAndAdmins(otherAgency, []),
    };

    ({ store } = createTestStore({
      usersToReview: {
        usersToReview: [userToReview, otherUserToReview],
        isLoading: false,
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

    expectToEqual(store.getState().usersToReview, {
      usersToReview: [otherUserToReview],
      isLoading: false,
    });

    expectToEqual(
      feedbacksSelectors.feedbacks(store.getState())["agency-users-to-review"],
      {
        level: "success",
        message:
          "Le rattachement de cet utilisateur à l'organisme a bien été rejeté.",
        on: "delete",
        title: "Demande de rattachement refusée",
      },
    );
  });

  it("should remove the registered user from the list", () => {
    const otherAgency = new AgencyDtoBuilder()
      .withId("other-agency-id")
      .withName("Other agency")
      .build();

    const userToReview: UserToReview = {
      id: connectedUser.id,
      email: connectedUser.email,
      firstName: connectedUser.firstName,
      lastName: connectedUser.lastName,
      agency: toAgencyDtoForAgencyUsersAndAdmins(agency, []),
    };
    const otherUserToReview: UserToReview = {
      ...userToReview,
      agency: toAgencyDtoForAgencyUsersAndAdmins(otherAgency, []),
    };

    ({ store } = createTestStore({
      usersToReview: {
        usersToReview: [userToReview, otherUserToReview],
        isLoading: false,
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

    expectToEqual(store.getState().usersToReview, {
      usersToReview: [otherUserToReview],
      isLoading: false,
    });

    expectToEqual(
      feedbacksSelectors.feedbacks(store.getState())["agency-users-to-review"],
      {
        level: "success",
        message:
          "L'utilisateur a bien été rattaché à l'organisme avec les droits demandés.",
        on: "update",
        title: "L'utilisateur a bien été rattaché à l'organisme",
      },
    );
  });
});
