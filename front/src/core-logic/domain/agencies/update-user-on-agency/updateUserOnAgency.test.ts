import {
  AgencyDtoBuilder,
  type AgencyRight,
  type ConnectedUser,
  ConnectedUserBuilder,
  expectToEqual,
  toAgencyDtoForAgencyUsersAndAdmins,
  type UserParamsForAgency,
} from "shared";
import { adminPreloadedState } from "src/core-logic/domain/admin/adminPreloadedState";
import type { ConnectedUserWithNormalizedAgencyRights } from "src/core-logic/domain/admin/connectedUsersAdmin/connectedUsersAdmin.slice";

import { agenciesPreloadedState } from "src/core-logic/domain/agencies/agenciesPreloadedState";
import { updateUserOnAgencySelectors } from "src/core-logic/domain/agencies/update-user-on-agency/updateUserOnAgency.selectors";
import { updateUserOnAgencySlice } from "src/core-logic/domain/agencies/update-user-on-agency/updateUserOnAgency.slice";
import type { FeedbackTopic } from "src/core-logic/domain/feedback/feedback.content";
import { feedbacksSelectors } from "src/core-logic/domain/feedback/feedback.selectors";
import {
  createTestStore,
  type TestDependencies,
} from "src/core-logic/storeConfig/createTestStore";
import type { ReduxStore } from "src/core-logic/storeConfig/store";

describe("UpdateUserOnAgency slice", () => {
  let store: ReduxStore;
  let dependencies: TestDependencies;
  const agency = new AgencyDtoBuilder().build();

  const agencyRight: AgencyRight = {
    agency: toAgencyDtoForAgencyUsersAndAdmins(agency, []),
    roles: ["validator"],
    isNotifiedByEmail: false,
  };
  const user: ConnectedUser = new ConnectedUserBuilder()
    .withId("user-id")
    .withIsAdmin(false)
    .withAgencyRights([agencyRight])
    .build();

  const userParams: UserParamsForAgency = {
    userId: user.id,
    agencyId: agency.id,
    email: "user@email.fr",
    roles: ["counsellor"],
    isNotifiedByEmail: true,
  };

  const normalizedUser: ConnectedUserWithNormalizedAgencyRights = {
    ...user,
    agencyRights: { [agency.id]: agencyRight },
  };

  beforeEach(() => {
    ({ store, dependencies } = createTestStore({
      admin: adminPreloadedState({
        fetchUser: {
          user,
          isFetching: false,
        },
      }),
      agency: {
        ...agenciesPreloadedState({
          fetchAgency: {
            agency,
            agencyUsers: { [user.id]: normalizedUser },
            isLoading: false,
          },
          updateUserOnAgency: {
            isLoading: false,
          },
        }),
      },
    }));
  });

  it("update the user rights successfully and store the feedback in user feedbacks", () => {
    store.dispatch(
      updateUserOnAgencySlice.actions.updateUserAgencyRightRequested({
        ...userParams,
        feedbackTopic: "user",
      }),
    );

    expectToEqual(
      updateUserOnAgencySelectors.isLoading(store.getState()),
      true,
    );

    dependencies.agencyGateway.updateUserAgencyRightResponse$.next(undefined);

    expectToEqual(
      updateUserOnAgencySelectors.isLoading(store.getState()),
      false,
    );
    expectToEqual(feedbacksSelectors.feedbacks(store.getState()).user, {
      level: "success",
      message: "Les données de l'utilisateur (rôles) ont été mises à jour.",
      on: "update",
      title: "L'utilisateur a été mis à jour",
    });
  });

  it("update the user rights successfully and store the feedback in agency-user-for-dashboard feedbacks", () => {
    store.dispatch(
      updateUserOnAgencySlice.actions.updateUserAgencyRightRequested({
        ...userParams,
        feedbackTopic: "agency-user-for-dashboard",
      }),
    );

    expectToEqual(
      updateUserOnAgencySelectors.isLoading(store.getState()),
      true,
    );

    dependencies.agencyGateway.updateUserAgencyRightResponse$.next(undefined);

    expectToEqual(
      updateUserOnAgencySelectors.isLoading(store.getState()),
      false,
    );

    expectToEqual(
      feedbacksSelectors.feedbacks(store.getState())[
        "agency-user-for-dashboard"
      ],
      {
        level: "success",
        message: "Les données de l'utilisateur (rôles) ont été mises à jour.",
        on: "update",
        title: "L'utilisateur a été mis à jour",
      },
    );
  });

  it.each(["user", "agency-user-for-dashboard"] as const)(
    "not update the user rights if error, and store the feedback in feedback topic %s",
    (feedbackTopic: FeedbackTopic) => {
      store.dispatch(
        updateUserOnAgencySlice.actions.updateUserAgencyRightRequested({
          ...userParams,
          feedbackTopic,
        }),
      );

      expectToEqual(
        updateUserOnAgencySelectors.isLoading(store.getState()),
        true,
      );

      dependencies.agencyGateway.updateUserAgencyRightResponse$.error(
        "Une erreur est survenue lors de la mise à jour de l'utilisateur",
      );

      expectToEqual(
        updateUserOnAgencySelectors.isLoading(store.getState()),
        false,
      );
      expectToEqual(
        feedbacksSelectors.feedbacks(store.getState())[feedbackTopic],
        {
          level: "error",
          message:
            "Une erreur est survenue lors de la mise à jour de l'utilisateur",
          on: "update",
          title: "Problème lors de la mise à jour de l'utilisateur",
        },
      );
    },
  );
});
