import { values } from "ramda";
import {
  type AgencyDto,
  AgencyDtoBuilder,
  type AgencyRight,
  type ConnectedUser,
  expectToEqual,
  noAgencyDashboards,
  noEstablishmentDashboard,
  toAgencyDtoForAgencyUsersAndAdmins,
} from "shared";
import type {
  ConnectedUsersWithNormalizedAgencyRightsById,
  ConnectedUserWithNormalizedAgencyRights,
} from "src/core-logic/domain/admin/connectedUsersAdmin/connectedUsersAdmin.slice";
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

const user1: ConnectedUserWithNormalizedAgencyRights = {
  id: "fake-user-id-1",
  email: "jbon8745@wanadoo.fr",
  firstName: "Jean",
  lastName: "Bon",
  agencyRights: {
    [agencyDto.id]: {
      agency: agencyWithAdminEmails,
      isNotifiedByEmail: true,
      roles: ["agency-admin"],
    },
  },
  dashboards: {
    agencies: noAgencyDashboards,
    establishments: noEstablishmentDashboard,
  },
  proConnect: {
    externalId: "fake-user-external-id-1",
    siret: "00000000001111",
  },
  createdAt: new Date().toISOString(),
  preventToDelete: false,
};

const user2: ConnectedUserWithNormalizedAgencyRights = {
  id: "user-in-error",
  email: "fake-user-email-4@test.fr",
  firstName: "Jean-Michel",
  lastName: "Jeplante",
  agencyRights: {
    [agencyDto.id]: {
      agency: agencyWithAdminEmails,
      isNotifiedByEmail: true,
      roles: ["agency-admin"],
    },
  },
  dashboards: {
    agencies: noAgencyDashboards,
    establishments: noEstablishmentDashboard,
  },
  proConnect: {
    externalId: "fake-user-in-error-external-id",
    siret: "00000000000000",
  },
  createdAt: new Date().toISOString(),
  preventToDelete: false,
};

const fakeAgencyUsers: ConnectedUsersWithNormalizedAgencyRightsById = {
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

      dependencies.authGateway.getConnectedUsersResponse$.error(
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

  describe("extra reducers", () => {
    describe("updateAgency", () => {
      it("should update agency successfully", () => {
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
      it("should create user successfully", () => {
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

        const userToCreate: ConnectedUserWithNormalizedAgencyRights = {
          id: "fake-id",
          email: "fake-email@mail.com",
          firstName: "fake-first-name",
          lastName: "fake-last-name",
          proConnect: null,
          createdAt: new Date().toISOString(),
          preventToDelete: false,
          agencyRights: {
            [agencyDto.id]: agencyRight,
          },
          dashboards: {
            agencies: noAgencyDashboards,
            establishments: noEstablishmentDashboard,
          },
        };

        const user: ConnectedUser = {
          ...userToCreate,
          agencyRights: [agencyRight],
        };

        store.dispatch(
          createUserOnAgencySlice.actions.createUserOnAgencyRequested({
            agencyId: agencyDto.id,
            userId: userToCreate.id,
            isNotifiedByEmail:
              userToCreate.agencyRights[agencyDto.id].isNotifiedByEmail,
            email: userToCreate.email,
            roles: userToCreate.agencyRights[agencyDto.id].roles,
            feedbackTopic: "agency-user-for-dashboard",
          }),
        );

        dependencies.agencyGateway.createUserForAgencyResponse$.next(user);

        expectFetchAgencyStateToMatch({
          agency: agencyDto,
          agencyUsers: {
            ...fakeAgencyUsers,
            [userToCreate.id]: {
              ...user,
              agencyRights: {
                [agencyDto.id]: {
                  agency: agencyWithAdminEmails,
                  roles: ["validator"],
                  isNotifiedByEmail: false,
                },
              },
            },
          },
        });
      });

      it("if  no agency in state, do nothing", () => {
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

        const userToCreate: ConnectedUserWithNormalizedAgencyRights = {
          id: "fake-id",
          email: "fake-email@mail.com",
          firstName: "fake-first-name",
          lastName: "fake-last-name",
          proConnect: null,
          createdAt: new Date().toISOString(),
          preventToDelete: false,
          agencyRights: {
            [agencyDto.id]: agencyRight,
          },
          dashboards: {
            agencies: noAgencyDashboards,
            establishments: noEstablishmentDashboard,
          },
        };

        store.dispatch(
          createUserOnAgencySlice.actions.createUserOnAgencyRequested({
            agencyId: agencyDto.id,
            userId: userToCreate.id,
            isNotifiedByEmail:
              userToCreate.agencyRights[agencyDto.id].isNotifiedByEmail,
            email: userToCreate.email,
            roles: userToCreate.agencyRights[agencyDto.id].roles,
            feedbackTopic: "agency-user-for-dashboard",
          }),
        );

        const user: ConnectedUser = {
          ...userToCreate,
          agencyRights: [agencyRight],
        };

        dependencies.agencyGateway.createUserForAgencyResponse$.next(user);

        expectFetchAgencyStateToMatch(fetchAgencyInitialState);
      });
    });

    describe("removeUser", () => {
      it("should remove user successfully", () => {
        ({ store, dependencies } = createTestStore({
          agency: agenciesPreloadedState({
            fetchAgency: {
              ...fetchAgencyInitialState,
              agencyUsers: fakeAgencyUsers,
            },
          }),
        }));
        const userToRemove = fakeAgencyUsers[user2.id];

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

        expectFetchAgencyStateToMatch({
          agency: null,
          isLoading: false,
          agencyUsers: { [user1.id]: fakeAgencyUsers[user1.id] },
        });
      });

      it("if  no agency in state, do nothing", () => {
        ({ store, dependencies } = createTestStore({
          agency: agenciesPreloadedState({
            fetchAgency: fetchAgencyInitialState,
          }),
        }));
        const userToRemove = fakeAgencyUsers[user2.id];

        expectFetchAgencyStateToMatch(fetchAgencyInitialState);

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

        expectFetchAgencyStateToMatch(fetchAgencyInitialState);
      });
    });

    describe("updateUser", () => {
      it("should update user successfully", () => {
        ({ store, dependencies } = createTestStore({
          agency: agenciesPreloadedState({
            fetchAgency: {
              ...fetchAgencyInitialState,
              agencyUsers: fakeAgencyUsers,
            },
          }),
        }));

        const originalUser = fakeAgencyUsers[user1.id];

        const updatedUser: ConnectedUserWithNormalizedAgencyRights = {
          ...originalUser,
          email: "updated-email@email.fr",
          agencyRights: {
            ...originalUser.agencyRights,
            [agencyDto.id]: {
              ...originalUser.agencyRights[agencyDto.id],
              roles: ["agency-admin", "validator"],
              isNotifiedByEmail: false,
            },
          },
        };

        expectFetchAgencyStateToMatch({
          agencyUsers: fakeAgencyUsers,
          agency: null,
          isLoading: false,
        });

        store.dispatch(
          updateUserOnAgencySlice.actions.updateUserAgencyRightRequested({
            userId: originalUser.id,
            agencyId: agencyDto.id,
            roles: updatedUser.agencyRights[agencyDto.id].roles,
            feedbackTopic: "agency-user-for-dashboard",
            isNotifiedByEmail: false,
            email: updatedUser.email,
          }),
        );

        dependencies.agencyGateway.updateUserAgencyRightResponse$.next(
          undefined,
        );

        expectFetchAgencyStateToMatch({
          agencyUsers: { ...fakeAgencyUsers, [originalUser.id]: updatedUser },
          agency: null,
          isLoading: false,
        });
      });

      it("if it is not user in state, do nothing", () => {
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
    agencyUsers: ConnectedUsersWithNormalizedAgencyRightsById,
  ) => {
    dependencies.authGateway.getConnectedUsersResponse$.next(
      values(agencyUsers).map((agencyUser) => ({
        ...agencyUser,
        agencyRights: values(agencyUser.agencyRights),
      })),
    );
  };
});
