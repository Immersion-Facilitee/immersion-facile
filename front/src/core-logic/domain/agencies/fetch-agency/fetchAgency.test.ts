import { values } from "ramda";
import {
  type AgencyDto,
  AgencyDtoBuilder,
  type AgencyRight,
  type AgencyUserForListing,
  type AgencyUsersForListingById,
  type ConnectedUser,
  expectToEqual,
  noAgencyDashboards,
  noEstablishmentDashboard,
  toAgencyDtoForAgencyUsersAndAdmins,
} from "shared";
import { agenciesPreloadedState } from "src/core-logic/domain/agencies/agenciesPreloadedState";
import { createUserOnAgencySlice } from "src/core-logic/domain/agencies/create-user-on-agency/createUserOnAgency.slice";
import { fetchAgencySelectors } from "src/core-logic/domain/agencies/fetch-agency/fetchAgency.selectors";
import {
  type FetchAgencyState,
  fetchAgencyInitialState,
  fetchAgencySlice,
} from "src/core-logic/domain/agencies/fetch-agency/fetchAgency.slice";
import { removeUserFromAgencySlice } from "src/core-logic/domain/agencies/remove-user-from-agency/removeUserFromAgency.slice";
import { updateAgencySlice } from "src/core-logic/domain/agencies/update-agency/updateAgency.slice";
import { updateUserOnAgencySlice } from "src/core-logic/domain/agencies/update-user-on-agency/updateUserOnAgency.slice";

import { feedbacksSelectors } from "src/core-logic/domain/feedback/feedback.selectors";
import {
  createTestStore,
  type TestDependencies,
} from "src/core-logic/storeConfig/createTestStore";
import type { ReduxStore } from "src/core-logic/storeConfig/store";

const agencyDto = new AgencyDtoBuilder().build();
const agencyWithAdminEmails = toAgencyDtoForAgencyUsersAndAdmins(agencyDto, []);

const user1: AgencyUserForListing = {
  id: "fake-user-id-1",
  email: "jbon8745@wanadoo.fr",
  firstName: "Jean",
  lastName: "Bon",
  agencyRightsByAgencyId: {
    [agencyDto.id]: {
      agency: agencyWithAdminEmails,
      isNotifiedByEmail: true,
      roles: ["agency-admin"],
    },
  },
  isProConnectUser: true,
};

const user2: AgencyUserForListing = {
  id: "user-in-error",
  email: "fake-user-email-4@test.fr",
  firstName: "Jean-Michel",
  lastName: "Jeplante",
  agencyRightsByAgencyId: {
    [agencyDto.id]: {
      agency: agencyWithAdminEmails,
      isNotifiedByEmail: true,
      roles: ["agency-admin"],
    },
  },
  isProConnectUser: true,
};

const fakeAgencyUsers: AgencyUsersForListingById = {
  [user1.id]: user1,
  [user2.id]: user2,
};

describe("fetchAgency", () => {
  let store: ReduxStore;
  let dependencies: TestDependencies;

  beforeEach(() => {
    ({ store, dependencies } = createTestStore({
      agency: agenciesPreloadedState({}),
    }));
  });

  describe("Fetch agency", () => {
    it("Fetch agency by id", () => {
      expectFetchAgencyStateToMatch(fetchAgencyInitialState);

      store.dispatch(
        fetchAgencySlice.actions.fetchAgencyRequested({
          agencyId: agencyDto.id,
          feedbackTopic: "agency-for-dashboard",
        }),
      );

      expectFetchAgencyStateToMatch({
        ...fetchAgencyInitialState,
        isLoading: true,
      });

      feedWithFetchedAgency(agencyDto);

      expectFetchAgencyStateToMatch({
        isLoading: false,
        agency: agencyDto,
        agencyUsers: {},
      });
    });

    it("Failed when no agency fetched", () => {
      expectFetchAgencyStateToMatch(fetchAgencyInitialState);

      store.dispatch(
        fetchAgencySlice.actions.fetchAgencyRequested({
          agencyId: agencyDto.id,
          feedbackTopic: "agency-for-dashboard",
        }),
      );

      expectFetchAgencyStateToMatch({
        ...fetchAgencyInitialState,
        isLoading: true,
      });

      dependencies.agencyGateway.fetchedAgency$.error(
        new Error(
          "Une erreur est survenue lors de la récupération des données de cette agence",
        ),
      );

      expectFetchAgencyStateToMatch(fetchAgencyInitialState);

      expectToEqual(
        feedbacksSelectors.feedbacks(store.getState())["agency-for-dashboard"],
        {
          level: "error",
          message:
            "Une erreur est survenue lors de la récupération des données de cette agence",
          on: "fetch",
          title:
            "Problème rencontré lors de la récupération des données de l'agence",
        },
      );
    });
  });

  describe("Fetch agency users", () => {
    it("Fetch agency users by agency id", () => {
      expectFetchAgencyStateToMatch(fetchAgencyInitialState);

      store.dispatch(
        fetchAgencySlice.actions.fetchAgencyUsersRequested({
          agencyId: agencyDto.id,
          feedbackTopic: "agency-user-for-dashboard",
        }),
      );

      expectFetchAgencyStateToMatch({
        ...fetchAgencyInitialState,
        isLoading: true,
      });

      feedWithFetchedAgencyUsers(fakeAgencyUsers);

      expectFetchAgencyStateToMatch({
        isLoading: false,
        agencyUsers: fakeAgencyUsers,
        agency: null,
      });
    });

    it("Failed when no agency users fetched", () => {
      expectFetchAgencyStateToMatch(fetchAgencyInitialState);

      store.dispatch(
        fetchAgencySlice.actions.fetchAgencyUsersRequested({
          agencyId: agencyDto.id,
          feedbackTopic: "agency-user-for-dashboard",
        }),
      );

      expectFetchAgencyStateToMatch({
        ...fetchAgencyInitialState,
        isLoading: true,
      });

      dependencies.agencyGateway.getAgencyUsersResponse$.error(
        new Error(
          "Une erreur est survenue lors de la récupération de la liste des utilisateurs de cette agence",
        ),
      );

      expectFetchAgencyStateToMatch({
        isLoading: false,
        agencyUsers: {},
        agency: null,
      });

      expectToEqual(
        feedbacksSelectors.feedbacks(store.getState())[
          "agency-user-for-dashboard"
        ],
        {
          level: "error",
          message:
            "Une erreur est survenue lors de la récupération de la liste des utilisateurs de cette agence",
          on: "fetch",
          title:
            "Problème rencontré lors de la récupération de la liste des utilisateurs",
        },
      );
    });
  });

  describe("clearAgencyAndUsers", () => {
    it("Clear agency and users", () => {
      ({ store, dependencies } = createTestStore({
        agency: agenciesPreloadedState({
          fetchAgency: {
            ...fetchAgencyInitialState,
            agency: agencyDto,
            agencyUsers: fakeAgencyUsers,
          },
        }),
      }));

      store.dispatch(fetchAgencySlice.actions.clearAgencyAndUsers());

      expectFetchAgencyStateToMatch({
        agency: null,
        agencyUsers: {},
      });
    });
  });

  describe("refetch after mutations", () => {
    describe("updateAgency", () => {
      it("should refetch agency successfully", () => {
        ({ store, dependencies } = createTestStore({
          agency: agenciesPreloadedState({
            fetchAgency: { ...fetchAgencyInitialState, agency: agencyDto },
          }),
        }));

        const updatedAgency = new AgencyDtoBuilder(agencyDto)
          .withName("updated-Name")
          .build();

        store.dispatch(
          updateAgencySlice.actions.updateAgencyRequested({
            ...updatedAgency,
            feedbackTopic: "agency-for-dashboard",
          }),
        );

        dependencies.agencyGateway.updateAgencyResponse$.next(undefined);
        feedWithFetchedAgency(updatedAgency);

        expectFetchAgencyStateToMatch({
          agency: updatedAgency,
          agencyUsers: {},
          isLoading: false,
        });
      });

      it("if it is not agency in state, do nothing", () => {
        ({ store, dependencies } = createTestStore({
          agency: agenciesPreloadedState({
            fetchAgency: { ...fetchAgencyInitialState },
          }),
        }));

        const updatedAgency = new AgencyDtoBuilder(agencyDto)
          .withName("updated-Name")
          .build();

        store.dispatch(
          updateAgencySlice.actions.updateAgencyRequested({
            ...updatedAgency,
            feedbackTopic: "agency-for-dashboard",
          }),
        );

        dependencies.agencyGateway.updateAgencyResponse$.next(undefined);

        expectFetchAgencyStateToMatch({ ...fetchAgencyInitialState });
      });
    });

    describe("createUser", () => {
      it("should refetch agency users successfully", () => {
        ({ store, dependencies } = createTestStore({
          agency: agenciesPreloadedState({
            fetchAgency: {
              ...fetchAgencyInitialState,
              agency: agencyDto,
              agencyUsers: fakeAgencyUsers,
            },
          }),
        }));
        expectFetchAgencyStateToMatch({
          agency: agencyDto,
          agencyUsers: fakeAgencyUsers,
        });

        const agencyRight: AgencyRight = {
          agency: agencyWithAdminEmails,
          roles: ["validator"],
          isNotifiedByEmail: false,
        };

        const userToCreate: AgencyUserForListing = {
          id: "fake-id",
          email: "fake-email@mail.com",
          firstName: "fake-first-name",
          lastName: "fake-last-name",
          isProConnectUser: false,
          agencyRightsByAgencyId: {
            [agencyDto.id]: agencyRight,
          },
        };

        const user: ConnectedUser = {
          id: userToCreate.id,
          email: userToCreate.email,
          firstName: userToCreate.firstName,
          lastName: userToCreate.lastName,
          proConnect: null,
          createdAt: new Date().toISOString(),
          preventToDelete: false,
          dashboards: {
            agencies: noAgencyDashboards,
            establishments: noEstablishmentDashboard,
          },
          agencyRights: [agencyRight],
        };

        const agencyUsersAfterCreate = {
          ...fakeAgencyUsers,
          [userToCreate.id]: userToCreate,
        };

        store.dispatch(
          createUserOnAgencySlice.actions.createUserOnAgencyRequested({
            agencyId: agencyDto.id,
            userId: userToCreate.id,
            isNotifiedByEmail: agencyRight.isNotifiedByEmail,
            email: userToCreate.email,
            roles: agencyRight.roles,
            feedbackTopic: "agency-user-for-dashboard",
          }),
        );

        dependencies.agencyGateway.createUserForAgencyResponse$.next(user);
        feedWithFetchedAgencyUsers(agencyUsersAfterCreate);

        expectFetchAgencyStateToMatch({
          agency: agencyDto,
          agencyUsers: agencyUsersAfterCreate,
        });
      });

      it("if no agency in state, do nothing", () => {
        ({ store, dependencies } = createTestStore({
          agency: agenciesPreloadedState({
            fetchAgency: fetchAgencyInitialState,
          }),
        }));
        expectFetchAgencyStateToMatch(fetchAgencyInitialState);

        const agencyRight: AgencyRight = {
          agency: agencyWithAdminEmails,
          roles: ["validator"],
          isNotifiedByEmail: false,
        };

        const userToCreate: AgencyUserForListing = {
          id: "fake-id",
          email: "fake-email@mail.com",
          firstName: "fake-first-name",
          lastName: "fake-last-name",
          isProConnectUser: false,
          agencyRightsByAgencyId: {
            [agencyDto.id]: agencyRight,
          },
        };

        store.dispatch(
          createUserOnAgencySlice.actions.createUserOnAgencyRequested({
            agencyId: agencyDto.id,
            userId: userToCreate.id,
            isNotifiedByEmail: agencyRight.isNotifiedByEmail,
            email: userToCreate.email,
            roles: agencyRight.roles,
            feedbackTopic: "agency-user-for-dashboard",
          }),
        );

        const user: ConnectedUser = {
          id: userToCreate.id,
          email: userToCreate.email,
          firstName: userToCreate.firstName,
          lastName: userToCreate.lastName,
          proConnect: null,
          createdAt: new Date().toISOString(),
          preventToDelete: false,
          dashboards: {
            agencies: noAgencyDashboards,
            establishments: noEstablishmentDashboard,
          },
          agencyRights: [agencyRight],
        };

        dependencies.agencyGateway.createUserForAgencyResponse$.next(user);

        expectFetchAgencyStateToMatch(fetchAgencyInitialState);
      });
    });

    describe("removeUser", () => {
      it("should refetch agency users successfully", () => {
        ({ store, dependencies } = createTestStore({
          agency: agenciesPreloadedState({
            fetchAgency: {
              ...fetchAgencyInitialState,
              agencyUsers: fakeAgencyUsers,
            },
          }),
        }));
        const userToRemove = fakeAgencyUsers[user2.id];
        const agencyUsersAfterRemove = {
          [user1.id]: fakeAgencyUsers[user1.id],
        };

        expectFetchAgencyStateToMatch({
          agencyUsers: fakeAgencyUsers,
          agency: null,
          isLoading: false,
        });

        store.dispatch(
          removeUserFromAgencySlice.actions.removeUserFromAgencyRequested({
            userId: userToRemove.id,
            agencyId: agencyDto.id,
            feedbackTopic: "agency-user-for-dashboard",
          }),
        );

        dependencies.agencyGateway.removeUserFromAgencyResponse$.next(
          undefined,
        );
        feedWithFetchedAgencyUsers(agencyUsersAfterRemove);

        expectFetchAgencyStateToMatch({
          agency: null,
          isLoading: false,
          agencyUsers: agencyUsersAfterRemove,
        });
      });

      it("if no agency users in state, do nothing", () => {
        ({ store, dependencies } = createTestStore({
          agency: agenciesPreloadedState({
            fetchAgency: fetchAgencyInitialState,
          }),
        }));

        expectFetchAgencyStateToMatch(fetchAgencyInitialState);

        store.dispatch(
          removeUserFromAgencySlice.actions.removeUserFromAgencyRequested({
            agencyId: agencyDto.id,
            userId: "not-in-state",
            feedbackTopic: "agency-user-for-dashboard",
          }),
        );

        dependencies.agencyGateway.removeUserFromAgencyResponse$.next(
          undefined,
        );

        expectFetchAgencyStateToMatch(fetchAgencyInitialState);
      });
    });

    describe("updateUser", () => {
      it("should refetch agency users successfully", () => {
        ({ store, dependencies } = createTestStore({
          agency: agenciesPreloadedState({
            fetchAgency: {
              ...fetchAgencyInitialState,
              agencyUsers: fakeAgencyUsers,
            },
          }),
        }));

        const originalUser = fakeAgencyUsers[user1.id];
        const updatedUser: AgencyUserForListing = {
          ...originalUser,
          email: "updated-email@email.fr",
          agencyRightsByAgencyId: {
            [agencyDto.id]: {
              ...originalUser.agencyRightsByAgencyId[agencyDto.id],
              roles: ["agency-admin", "validator"],
              isNotifiedByEmail: false,
            },
          },
        };
        const agencyUsersAfterUpdate = {
          ...fakeAgencyUsers,
          [originalUser.id]: updatedUser,
        };

        expectFetchAgencyStateToMatch({
          agencyUsers: fakeAgencyUsers,
          agency: null,
          isLoading: false,
        });

        store.dispatch(
          updateUserOnAgencySlice.actions.updateUserAgencyRightRequested({
            userId: user1.id,
            agencyId: agencyDto.id,
            roles: ["agency-admin", "validator"],
            feedbackTopic: "agency-user-for-dashboard",
            isNotifiedByEmail: false,
            email: "updated-email@email.fr",
          }),
        );

        dependencies.agencyGateway.updateUserAgencyRightResponse$.next(
          undefined,
        );
        feedWithFetchedAgencyUsers(agencyUsersAfterUpdate);

        expectFetchAgencyStateToMatch({
          agencyUsers: agencyUsersAfterUpdate,
          agency: null,
          isLoading: false,
        });
      });

      it("if user is not in state, do nothing", () => {
        ({ store, dependencies } = createTestStore({
          agency: agenciesPreloadedState({
            fetchAgency: {
              ...fetchAgencyInitialState,
              agencyUsers: fakeAgencyUsers,
            },
          }),
        }));

        expectFetchAgencyStateToMatch({
          agencyUsers: fakeAgencyUsers,
          agency: null,
          isLoading: false,
        });

        store.dispatch(
          updateUserOnAgencySlice.actions.updateUserAgencyRightRequested({
            userId: "fake",
            agencyId: "fake-agency-id",
            roles: ["counsellor"],
            feedbackTopic: "agency-user-for-dashboard",
            isNotifiedByEmail: false,
            email: "fake-mail",
          }),
        );

        dependencies.agencyGateway.updateUserAgencyRightResponse$.next(
          undefined,
        );

        expectFetchAgencyStateToMatch({
          agencyUsers: { ...fakeAgencyUsers },
          agency: null,
          isLoading: false,
        });
      });
    });
  });

  const expectFetchAgencyStateToMatch = (params: Partial<FetchAgencyState>) => {
    expectToEqual(fetchAgencySelectors.agency(store.getState()), params.agency);
    expectToEqual(
      fetchAgencySelectors.agencyUsers(store.getState()),
      params.agencyUsers,
    );
  };

  const feedWithFetchedAgency = (agency: AgencyDto) => {
    dependencies.agencyGateway.fetchedAgency$.next(agency);
  };
  const feedWithFetchedAgencyUsers = (
    agencyUsers: AgencyUsersForListingById,
  ) => {
    dependencies.agencyGateway.getAgencyUsersResponse$.next(
      values(agencyUsers),
    );
  };
});
