import {
  AgencyDtoBuilder,
  ConnectedUserBuilder,
  expectToEqual,
  toAgencyDtoForAgencyUsersAndAdmins,
} from "shared";
import {
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
          agencyId: agency.id,
          agencyName: agency.name,
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
});
