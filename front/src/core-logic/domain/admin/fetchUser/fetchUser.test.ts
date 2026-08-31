import {
  AgencyDtoBuilder,
  type AgencyRight,
  type ConnectedUser,
  ConnectedUserBuilder,
  expectToEqual,
  toAgencyDtoForAgencyUsersAndAdmins,
} from "shared";
import { adminPreloadedState } from "src/core-logic/domain/admin/adminPreloadedState";
import { connectedUsersAdminSlice } from "src/core-logic/domain/admin/connectedUsersAdmin/connectedUsersAdmin.slice";
import { adminFetchUserSelectors } from "src/core-logic/domain/admin/fetchUser/fetchUser.selectors";
import {
  type FetchUserState,
  fetchUserInitialState,
  fetchUserSlice,
} from "src/core-logic/domain/admin/fetchUser/fetchUser.slice";
import { removeUserFromAgencySelectors } from "src/core-logic/domain/agencies/remove-user-from-agency/removeUserFromAgency.selectors";
import { removeUserFromAgencySlice } from "src/core-logic/domain/agencies/remove-user-from-agency/removeUserFromAgency.slice";
import { updateUserOnAgencySelectors } from "src/core-logic/domain/agencies/update-user-on-agency/updateUserOnAgency.selectors";
import { updateUserOnAgencySlice } from "src/core-logic/domain/agencies/update-user-on-agency/updateUserOnAgency.slice";
import {
  createTestStore,
  type TestDependencies,
} from "src/core-logic/storeConfig/createTestStore";
import type { ReduxStore } from "src/core-logic/storeConfig/store";

describe("Admin Users slice", () => {
  const user = new ConnectedUserBuilder().build();
  let store: ReduxStore;
  let dependencies: TestDependencies;

  beforeEach(() => {
    ({ store, dependencies } = createTestStore());
  });

  describe("fetchUserRequested", () => {
    it("fetches the user successfully", () => {
      expectAdminFetchUserSelectors(fetchUserInitialState);

      store.dispatch(
        fetchUserSlice.actions.fetchUserRequested({ userId: user.id }),
      );

      expectAdminFetchUserSelectors({
        ...fetchUserInitialState,
        isFetching: true,
      });

      feedWithUsers(user);

      expectAdminFetchUserSelectors({
        user,
        isFetching: false,
      });
    });
  });

  describe("when current user has successfully requested an update of another user", () => {
    it("if this other user is in the state, update this user rights successfully", () => {
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

      ({ store, dependencies } = createTestStore({
        admin: adminPreloadedState({
          fetchUser: {
            user,
            isFetching: false,
          },
        }),
      }));

      store.dispatch(
        updateUserOnAgencySlice.actions.updateUserAgencyRightRequested({
          userId: user.id,
          agencyId: agency.id,
          email: user.email,
          roles: [...agencyRight.roles, "counsellor"],
          isNotifiedByEmail: agencyRight.isNotifiedByEmail,
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

      expectAdminFetchUserSelectors({
        isFetching: false,
        user: {
          ...user,
          agencyRights: [
            {
              ...agencyRight,
              roles: [...agencyRight.roles, "counsellor"],
            },
          ],
        },
      });
    });

    it("if it is not user in state, do nothing", () => {
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

      ({ store, dependencies } = createTestStore({
        admin: adminPreloadedState({
          fetchUser: {
            user,
            isFetching: false,
          },
        }),
      }));

      store.dispatch(
        updateUserOnAgencySlice.actions.updateUserAgencyRightRequested({
          userId: "another-user-id",
          agencyId: agency.id,
          email: "another-user-id@email.com",
          roles: [...agencyRight.roles, "counsellor"],
          isNotifiedByEmail: agencyRight.isNotifiedByEmail,
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

      expectAdminFetchUserSelectors({
        isFetching: false,
        user,
      });
    });
  });

  describe("when user has successfully requested removal from agency", () => {
    it("if it is himself, remove the user rights successfully", () => {
      const agency = new AgencyDtoBuilder().build();
      const agencyRight: AgencyRight = {
        agency: toAgencyDtoForAgencyUsersAndAdmins(
          new AgencyDtoBuilder().build(),
          [],
        ),
        roles: ["to-review"],
        isNotifiedByEmail: false,
      };
      const user: ConnectedUser = new ConnectedUserBuilder()
        .withId("user-id")
        .withIsAdmin(false)
        .withAgencyRights([agencyRight])
        .build();

      ({ store, dependencies } = createTestStore({
        admin: adminPreloadedState({
          fetchUser: {
            user,
            isFetching: false,
          },
        }),
      }));

      store.dispatch(
        removeUserFromAgencySlice.actions.removeUserFromAgencyRequested({
          userId: user.id,
          agencyId: agency.id,
          feedbackTopic: "user",
        }),
      );
      expectToEqual(
        removeUserFromAgencySelectors.isLoading(store.getState()),
        true,
      );
      dependencies.agencyGateway.removeUserFromAgencyResponse$.next(undefined);

      expectToEqual(
        removeUserFromAgencySelectors.isLoading(store.getState()),
        false,
      );

      expectAdminFetchUserSelectors({
        isFetching: false,
        user: {
          ...user,
          agencyRights: [],
        },
      });
    });

    it("if it is not user in state, do nothing", () => {
      const agency = new AgencyDtoBuilder().build();
      const agencyRight: AgencyRight = {
        agency: toAgencyDtoForAgencyUsersAndAdmins(
          new AgencyDtoBuilder().build(),
          [],
        ),
        roles: ["to-review"],
        isNotifiedByEmail: false,
      };
      const user: ConnectedUser = new ConnectedUserBuilder()
        .withId("user-id")
        .withIsAdmin(false)
        .withAgencyRights([agencyRight])
        .build();

      ({ store, dependencies } = createTestStore({
        admin: adminPreloadedState({
          fetchUser: {
            user,
            isFetching: false,
          },
        }),
      }));

      store.dispatch(
        removeUserFromAgencySlice.actions.removeUserFromAgencyRequested({
          userId: "another-user-id",
          agencyId: agency.id,
          feedbackTopic: "user",
        }),
      );
      expectToEqual(
        removeUserFromAgencySelectors.isLoading(store.getState()),
        true,
      );
      dependencies.agencyGateway.removeUserFromAgencyResponse$.next(undefined);

      expectToEqual(
        removeUserFromAgencySelectors.isLoading(store.getState()),
        false,
      );
      expectAdminFetchUserSelectors({
        isFetching: false,
        user,
      });
    });
  });

  describe("when current user has successfully requested an update of preventToDelete", () => {
    it("if this other user is in the state, fetch user to update it", () => {
      const user: ConnectedUser = new ConnectedUserBuilder()
        .withId("user-id")
        .withPreventToDelete(false)
        .build();
      const updatedUser: ConnectedUser = {
        ...user,
        preventToDelete: true,
      };

      ({ store, dependencies } = createTestStore({
        admin: adminPreloadedState({
          fetchUser: {
            user,
            isFetching: false,
          },
        }),
      }));

      store.dispatch(
        connectedUsersAdminSlice.actions.updateUserPreventToDeleteRequested({
          userId: user.id,
          preventToDelete: true,
          feedbackTopic: "user-prevent-to-delete",
        }),
      );
      dependencies.adminGateway.updateUserPreventToDeleteResponse$.next(
        undefined,
      );

      expectAdminFetchUserSelectors({
        isFetching: true,
        user,
      });

      feedWithUsers(updatedUser);

      expectAdminFetchUserSelectors({
        isFetching: false,
        user: updatedUser,
      });
    });

    it("if it is not user in state, do nothing", () => {
      const user: ConnectedUser = new ConnectedUserBuilder()
        .withId("user-id")
        .withPreventToDelete(false)
        .build();

      ({ store, dependencies } = createTestStore({
        admin: adminPreloadedState({
          fetchUser: {
            user,
            isFetching: false,
          },
        }),
      }));

      store.dispatch(
        connectedUsersAdminSlice.actions.updateUserPreventToDeleteRequested({
          userId: "another-user-id",
          preventToDelete: true,
          feedbackTopic: "user-prevent-to-delete",
        }),
      );
      dependencies.adminGateway.updateUserPreventToDeleteResponse$.next(
        undefined,
      );

      expectAdminFetchUserSelectors({
        isFetching: false,
        user,
      });
    });
  });

  const feedWithUsers = (icUser: ConnectedUser) => {
    dependencies.authGateway.getConnectedUserResponse$.next(icUser);
  };

  const expectAdminFetchUserSelectors = (expectedValues: FetchUserState) => {
    const state = store.getState();
    expectToEqual(
      adminFetchUserSelectors.isFetching(state),
      expectedValues.isFetching,
    );
    expectToEqual(
      adminFetchUserSelectors.fetchedUser(state),
      expectedValues.user,
    );
  };
});
