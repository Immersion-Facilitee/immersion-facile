import { values } from "ramda";
import {
  type AgencyDto,
  AgencyDtoBuilder,
  type AgencyId,
  type AgencyRight,
  type ConnectedUser,
  errors,
  expectToEqual,
  noAgencyDashboards,
  noEstablishmentDashboard,
  type RejectConnectedUserRoleForAgencyParams,
  toAgencyDtoForAgencyUsersAndAdmins,
  type UserParamsForAgency,
} from "shared";
import { adminPreloadedState } from "src/core-logic/domain/admin/adminPreloadedState";
import { connectedUsersAdminSelectors } from "src/core-logic/domain/admin/connectedUsersAdmin/connectedUsersAdmin.selectors";
import { agenciesPreloadedState } from "src/core-logic/domain/agencies/agenciesPreloadedState";
import { fetchAgencySelectors } from "src/core-logic/domain/agencies/fetch-agency/fetchAgency.selectors";
import { fetchAgencyInitialState } from "src/core-logic/domain/agencies/fetch-agency/fetchAgency.slice";
import { removeUserFromAgencySlice } from "src/core-logic/domain/agencies/remove-user-from-agency/removeUserFromAgency.slice";
import {
  createTestStore,
  type TestDependencies,
} from "src/core-logic/storeConfig/createTestStore";
import type { ReduxStore } from "src/core-logic/storeConfig/store";
import { fetchAgencyOptionsInitialState } from "../../agencies/fetch-agency-options/fetchAgencyOptions.slice";
import { feedbacksSelectors } from "../../feedback/feedback.selectors";
import {
  type ConnectedUsersAdminFeedback,
  type ConnectedUsersAdminState,
  type ConnectedUsersWithNormalizedAgencyRightsById,
  type ConnectedUserWithNormalizedAgencyRights,
  connectedUsersAdminInitialState,
  connectedUsersAdminSlice,
} from "./connectedUsersAdmin.slice";

const agency1 = new AgencyDtoBuilder().withId("agency-1").build();
const agency2 = new AgencyDtoBuilder().withId("agency-2").build();
const agency3 = new AgencyDtoBuilder().withId("agency-3").build();
const agency4 = new AgencyDtoBuilder().withId("agency-4").build();

const agency1Right: AgencyRight = {
  agency: toAgencyDtoForAgencyUsersAndAdmins(agency1, []),
  roles: ["to-review"],
  isNotifiedByEmail: true,
};
const agency2Right: AgencyRight = {
  agency: toAgencyDtoForAgencyUsersAndAdmins(agency2, []),
  roles: ["validator"],
  isNotifiedByEmail: true,
};
const user1AgencyRights: Record<AgencyId, AgencyRight> = {
  [agency1.id]: agency1Right,
  [agency2.id]: agency2Right,
};

const agency3Right: AgencyRight = {
  agency: toAgencyDtoForAgencyUsersAndAdmins(agency3, []),
  roles: ["to-review"],
  isNotifiedByEmail: true,
};
const agency4Right: AgencyRight = {
  agency: toAgencyDtoForAgencyUsersAndAdmins(agency4, []),
  roles: ["to-review"],
  isNotifiedByEmail: true,
};
const user2AgencyRights: Record<AgencyId, AgencyRight> = {
  [agency3.id]: agency3Right,
  [agency4.id]: agency4Right,
};

const authUser1: ConnectedUserWithNormalizedAgencyRights = {
  id: "user-id-1",
  email: "user-email",
  firstName: "user-first-name",
  lastName: "user-last-name",
  createdAt: new Date().toISOString(),
  preventToDelete: false,
  agencyRights: user1AgencyRights,
  dashboards: {
    agencies: noAgencyDashboards,
    establishments: noEstablishmentDashboard,
  },
  proConnect: {
    externalId: "fake-user-external-id-1",
    siret: "00000111112222",
  },
};

const authUser2: ConnectedUserWithNormalizedAgencyRights = {
  id: "user-id-2",
  email: "user-email-2",
  firstName: "user-first-name-2",
  lastName: "user-last-name-2",
  createdAt: new Date().toISOString(),
  preventToDelete: false,
  agencyRights: user2AgencyRights,
  dashboards: {
    agencies: noAgencyDashboards,
    establishments: noEstablishmentDashboard,
  },
  proConnect: {
    externalId: "fake-user-external-id-2",
    siret: "00000000001234",
  },
};

const testUserSet: ConnectedUsersWithNormalizedAgencyRightsById = {
  [authUser1.id]: authUser1,
  [authUser2.id]: authUser2,
};

describe("Agency registration for authenticated users", () => {
  let store: ReduxStore;
  let dependencies: TestDependencies;

  beforeEach(() => {
    ({ store, dependencies } = createTestStore());
  });

  describe("user selection", () => {
    it("selects the user to review", () => {
      ({ store, dependencies } = createTestStore({
        admin: adminPreloadedState({
          connectedUsersAdmin: {
            ...connectedUsersAdminInitialState,
            connectedUsersNeedingReview: testUserSet,
            selectedUser: null,
            feedback: { kind: "usersToReviewFetchSuccess" },
          },
        }),
      }));

      store.dispatch(
        connectedUsersAdminSlice.actions.connectedUserSelected(authUser2),
      );

      expectAgencyAdminStateToMatch({
        connectedUsersNeedingReview: testUserSet,
        selectedUser: authUser2,
        feedback: { kind: "usersToReviewFetchSuccess" },
      });
    });

    it("drops the error state when selecting", () => {
      ({ store, dependencies } = createTestStore({
        admin: adminPreloadedState({
          connectedUsersAdmin: {
            ...connectedUsersAdminInitialState,
            connectedUsersNeedingReview: testUserSet,
            selectedUser: null,
            feedback: { kind: "errored", errorMessage: "Opps" },
          },
        }),
      }));

      store.dispatch(
        connectedUsersAdminSlice.actions.connectedUserSelected(authUser2),
      );

      expectAgencyAdminStateToMatch({
        connectedUsersNeedingReview: testUserSet,
        selectedUser: authUser2,
        feedback: { kind: "usersToReviewFetchSuccess" },
      });
    });
  });

  describe("fetches inclusion connected users that have agencies to review", () => {
    it("gets the users by agencyId successfully", () => {
      expectToEqual(
        connectedUsersAdminSelectors.connectedUsersNeedingReview(
          store.getState(),
        ),
        [],
      );
      store.dispatch(
        connectedUsersAdminSlice.actions.fetchConnectedUsersToReviewRequested({
          agencyIds: [agency2.id],
        }),
      );
      expectIsFetchingIcUsersNeedingReviewToBe(true);

      dependencies.authGateway.getConnectedUsersResponse$.next([
        {
          ...authUser1,
          agencyRights: [agency1Right, agency2Right],
        },
      ]);
      expectIsFetchingIcUsersNeedingReviewToBe(false);
      expectToEqual(
        connectedUsersAdminSelectors.connectedUsersNeedingReview(
          store.getState(),
        ),
        [
          {
            firstName: authUser1.firstName,
            lastName: authUser1.lastName,
            email: authUser1.email,
            proConnect: authUser1.proConnect,
            id: authUser1.id,
            createdAt: authUser1.createdAt,
            preventToDelete: false,
          },
        ],
      );
      expectFeedbackToEqual({ kind: "usersToReviewFetchSuccess" });
    });

    it("gets the users by agencyRole successfully", () => {
      expectToEqual(
        connectedUsersAdminSelectors.connectedUsersNeedingReview(
          store.getState(),
        ),
        [],
      );
      store.dispatch(
        connectedUsersAdminSlice.actions.fetchConnectedUsersToReviewRequested({
          agencyRole: "to-review",
        }),
      );
      expectIsFetchingIcUsersNeedingReviewToBe(true);

      dependencies.authGateway.getConnectedUsersResponse$.next([
        {
          ...authUser1,
          agencyRights: [agency1Right, agency2Right],
        },
        {
          ...authUser2,
          agencyRights: [agency3Right, agency4Right],
        },
      ]);
      expectIsFetchingIcUsersNeedingReviewToBe(false);
      expectToEqual(
        connectedUsersAdminSelectors.connectedUsersNeedingReview(
          store.getState(),
        ),
        [
          {
            firstName: authUser1.firstName,
            lastName: authUser1.lastName,
            email: authUser1.email,
            proConnect: authUser1.proConnect,
            id: authUser1.id,
            createdAt: authUser1.createdAt,
            preventToDelete: false,
          },
          {
            firstName: authUser2.firstName,
            lastName: authUser2.lastName,
            email: authUser2.email,
            proConnect: authUser2.proConnect,
            id: authUser2.id,
            createdAt: authUser2.createdAt,
            preventToDelete: false,
          },
        ],
      );
      expectFeedbackToEqual({ kind: "usersToReviewFetchSuccess" });
    });

    it("stores error message when something goes wrong in fetching", () => {
      store.dispatch(
        connectedUsersAdminSlice.actions.fetchConnectedUsersToReviewRequested({
          agencyRole: "to-review",
        }),
      );
      const errorMessage = "Error fetching users to review";
      expectIsFetchingIcUsersNeedingReviewToBe(true);
      dependencies.authGateway.getConnectedUsersResponse$.error(
        new Error(errorMessage),
      );
      expectIsFetchingIcUsersNeedingReviewToBe(false);
      expectFeedbackToEqual({ kind: "errored", errorMessage });
    });
  });

  describe("fetches agency users", () => {
    it("gets the users by agencyId successfully", () => {
      const agencyUser: ConnectedUsersWithNormalizedAgencyRightsById[keyof ConnectedUsersWithNormalizedAgencyRightsById] =
        {
          ...authUser1,
          agencyRights: {
            [agency1Right.agency.id]: agency1Right,
            [agency2Right.agency.id]: agency2Right,
          },
        };
      store.dispatch(
        connectedUsersAdminSlice.actions.fetchAgencyUsersRequested({
          agencyIds: [agency2.id],
        }),
      );
      expectIsFetchingAgencyUsersToBe(true);

      dependencies.authGateway.getConnectedUsersResponse$.next([
        {
          ...authUser1,
          agencyRights: [agency1Right, agency2Right],
        },
      ]);
      expectIsFetchingAgencyUsersToBe(false);
      expectToEqual(
        connectedUsersAdminSelectors.agencyUsers(store.getState()),
        {
          [agencyUser.id]: agencyUser,
        },
      );
      expectFeedbackToEqual({ kind: "agencyUsersFetchSuccess" });
    });

    it("stores error message when something goes wrong in fetching", () => {
      store.dispatch(
        connectedUsersAdminSlice.actions.fetchAgencyUsersRequested({
          agencyIds: ["any-id"],
        }),
      );
      const errorMessage = "Error fetching users";
      expectIsFetchingAgencyUsersToBe(true);
      dependencies.authGateway.getConnectedUsersResponse$.error(
        new Error(errorMessage),
      );
      expectIsFetchingAgencyUsersToBe(false);
      expectFeedbackToEqual({ kind: "errored", errorMessage });
    });
  });

  describe("sets a role to a user for a given agency", () => {
    it("sets successfully the given role the agency for a given user", () => {
      ({ store, dependencies } = createTestStore({
        admin: adminPreloadedState({
          connectedUsersAdmin: {
            ...connectedUsersAdminInitialState,
            connectedUsersNeedingReview: testUserSet,
            selectedUser: authUser2,
          },
        }),
      }));

      const payload: UserParamsForAgency = {
        agencyId: "agency-3",
        userId: authUser2.id,
        roles: ["validator"],
        isNotifiedByEmail: false,
        email: "email@email.fr",
      };

      expectToEqual(
        connectedUsersAdminSelectors.agenciesNeedingReviewForSelectedUser(
          store.getState(),
        ),
        values(user2AgencyRights),
      );
      store.dispatch(
        connectedUsersAdminSlice.actions.registerAgencyWithRoleToUserRequested({
          ...payload,
          feedbackTopic: "agency-users-to-review",
        }),
      );
      expectIsUpdatingUserAgencyToBe(true);
      dependencies.adminGateway.updateAgencyRoleForUserResponse$.next(
        undefined,
      );
      expectIsUpdatingUserAgencyToBe(false);

      expectToEqual(
        connectedUsersAdminSelectors.agenciesNeedingReviewForSelectedUser(
          store.getState(),
        ),
        [agency4Right],
      );
      expectFeedbackToEqual({ kind: "agencyRegisterToUserSuccess" });
    });

    it("stores error message when something goes wrong in the update", () => {
      const payload: UserParamsForAgency = {
        agencyId: "agency-3",
        userId: "user-id",
        roles: ["validator"],
        isNotifiedByEmail: false,
        email: "email@email.fr",
      };
      const errorMessage = `Error registering user ${payload.userId} to agency ${payload.agencyId} with roles ${payload.roles}`;

      store.dispatch(
        connectedUsersAdminSlice.actions.registerAgencyWithRoleToUserRequested({
          ...payload,
          feedbackTopic: "agency-users-to-review",
        }),
      );
      expectIsUpdatingUserAgencyToBe(true);
      dependencies.adminGateway.updateAgencyRoleForUserResponse$.error(
        new Error(errorMessage),
      );
      expectIsUpdatingUserAgencyToBe(false);
      expectFeedbackToEqual({ kind: "errored", errorMessage });
    });
  });

  describe("Reject user registration for agency", () => {
    it("rejects successfully the user for agency", () => {
      ({ store, dependencies } = createTestStore({
        admin: adminPreloadedState({
          connectedUsersAdmin: {
            ...connectedUsersAdminInitialState,
            connectedUsersNeedingReview: testUserSet,
          },
        }),
      }));
      const payload: RejectConnectedUserRoleForAgencyParams = {
        agencyId: agency3.id,
        justification: "osef",
        userId: authUser2.id,
      };

      store.dispatch(
        connectedUsersAdminSlice.actions.rejectAgencyWithRoleToUserRequested({
          ...payload,
          feedbackTopic: "agency-users-to-review",
        }),
      );

      expectIsUpdatingUserAgencyToBe(true);

      dependencies.adminGateway.rejectUserToAgencyResponse$.next();

      expectIsUpdatingUserAgencyToBe(false);
      expectFeedbackToEqual({ kind: "agencyRejectionForUserSuccess" });
    });

    it("rejects successfully even if user is not in connectedUsersNeedingReview", () => {
      store.dispatch(
        connectedUsersAdminSlice.actions.rejectAgencyWithRoleToUserRequested({
          agencyId: "agency-id",
          justification: "osef",
          userId: "user-to-reject-id",
          feedbackTopic: "agency-users-to-review",
        }),
      );

      expectIsUpdatingUserAgencyToBe(true);

      dependencies.adminGateway.rejectUserToAgencyResponse$.next();

      expectIsUpdatingUserAgencyToBe(false);
      expectFeedbackToEqual({ kind: "agencyRejectionForUserSuccess" });
      expectToEqual(
        store.getState().admin.connectedUsersAdmin.connectedUsersNeedingReview,
        {},
      );
    });

    it("Fail to rejects the user for agency", () => {
      const errorMessage = "reject user for agency failed";
      expectToEqual(
        store.getState().admin.connectedUsersAdmin,
        connectedUsersAdminInitialState,
      );
      store.dispatch(
        connectedUsersAdminSlice.actions.rejectAgencyWithRoleToUserRequested({
          agencyId: "rejected-user-for-this-agency",
          justification: "osef",
          userId: "user-to-reject-id",
          feedbackTopic: "agency-users-to-review",
        }),
      );

      expectIsUpdatingUserAgencyToBe(true);

      dependencies.adminGateway.rejectUserToAgencyResponse$.error(
        new Error(errorMessage),
      );

      expectIsUpdatingUserAgencyToBe(false);
      expectFeedbackToEqual({ kind: "errored", errorMessage });
    });
  });

  describe("Update users on agency", () => {
    it("should update user successfully", () => {
      const prefilledAdminState = adminPreloadedState({
        connectedUsersAdmin: {
          ...connectedUsersAdminInitialState,
          agencyUsers: testUserSet,
        },
      });
      ({ store, dependencies } = createTestStore({
        admin: prefilledAdminState,
      }));
      const originalUser = testUserSet[authUser1.id];
      const updatedUser: ConnectedUserWithNormalizedAgencyRights = {
        ...originalUser,
        email: "updated-email@email.fr",
        agencyRights: {
          ...originalUser.agencyRights,
          [agency2.id]: {
            ...originalUser.agencyRights[agency2.id],
            roles: ["agency-admin", "validator"],
            isNotifiedByEmail: false,
          },
        },
      };

      expectToEqual(
        store.getState().admin.connectedUsersAdmin,
        prefilledAdminState.connectedUsersAdmin,
      );

      store.dispatch(
        connectedUsersAdminSlice.actions.updateUserOnAgencyRequested({
          userId: originalUser.id,
          agencyId: agency2.id,
          roles: updatedUser.agencyRights[agency2.id].roles,
          feedbackTopic: "agency-user",
          isNotifiedByEmail: false,
          email: "updated-email@email.fr",
        }),
      );

      expectIsUpdatingUserAgencyToBe(true);
      dependencies.adminGateway.updateAgencyRoleForUserResponse$.next(
        undefined,
      );
      const expected: ConnectedUsersWithNormalizedAgencyRightsById = {
        ...connectedUsersAdminSelectors.agencyUsers(store.getState()),
        [originalUser.id]: updatedUser,
      };
      expectIsUpdatingUserAgencyToBe(false);

      expectToEqual(
        connectedUsersAdminSelectors.agencyUsers(store.getState()),
        expected,
      );
      expectToEqual(
        feedbacksSelectors.feedbacks(store.getState())["agency-user"],
        {
          level: "success",
          message: "Les données de l'utilisateur (rôles) ont été mises à jour.",
          on: "update",
          title: "L'utilisateur a été mis à jour",
        },
      );
    });
    it("should return an error if update went wrong", () => {
      const prefilledAdminState = adminPreloadedState({
        connectedUsersAdmin: {
          ...connectedUsersAdminInitialState,
          agencyUsers: testUserSet,
        },
      });
      ({ store, dependencies } = createTestStore({
        admin: prefilledAdminState,
      }));
      const originalUser = testUserSet[authUser1.id];
      const errorMessage =
        "Une erreur est survenue lors de la mise à jour de l'utilisateur";

      expectToEqual(
        store.getState().admin.connectedUsersAdmin,
        prefilledAdminState.connectedUsersAdmin,
      );

      store.dispatch(
        connectedUsersAdminSlice.actions.updateUserOnAgencyRequested({
          userId: originalUser.id,
          agencyId: agency2.id,
          roles: originalUser.agencyRights[agency2.id].roles,
          feedbackTopic: "agency-user",
          isNotifiedByEmail: false,
          email: "email@email.fr",
        }),
      );

      expectIsUpdatingUserAgencyToBe(true);
      dependencies.adminGateway.updateAgencyRoleForUserResponse$.error(
        new Error(errorMessage),
      );
      expectIsUpdatingUserAgencyToBe(false);

      expectToEqual(
        feedbacksSelectors.feedbacks(store.getState())["agency-user"],
        {
          level: "error",
          message:
            "Une erreur est survenue lors de la mise à jour de l'utilisateur",
          on: "update",
          title: "Problème lors de la mise à jour de l'utilisateur",
        },
      );
    });
    it("should refetch agency after user updates", () => {
      const agency = new AgencyDtoBuilder().withId("1").build();

      ({ store, dependencies } = createTestStore({
        admin: adminPreloadedState({
          fetchAgencyOptions: { ...fetchAgencyOptionsInitialState },
          connectedUsersAdmin: {
            ...connectedUsersAdminInitialState,
            agencyUsers: testUserSet,
          },
        }),
        agency: {
          ...agenciesPreloadedState({
            fetchAgency: {
              ...fetchAgencyInitialState,
              agency,
            },
          }),
        },
      }));

      store.dispatch(
        connectedUsersAdminSlice.actions.updateUserOnAgencyRequested({
          userId: authUser2.id,
          agencyId: agency3.id,
          roles: ["validator"],
          feedbackTopic: "agency-user",
          isNotifiedByEmail: false,
          email: "email@email.fr",
        }),
      );
      expectIsUpdatingUserAgencyToBe(true);
      dependencies.adminGateway.updateAgencyRoleForUserResponse$.next(
        undefined,
      );

      const expectedAgency: AgencyDto = {
        ...agency,
        validatorEmails: ["bob@mail.com", "validator@mail.com"],
        counsellorEmails: [],
      };
      dependencies.agencyGateway.fetchedAgency$.next(expectedAgency);
      expectToEqual(
        fetchAgencySelectors.agency(store.getState()),
        expectedAgency,
      );
    });
  });

  describe("Create users on agency", () => {
    it("should create user successfully", () => {
      expectToEqual(
        store.getState().admin.connectedUsersAdmin,
        connectedUsersAdminInitialState,
      );

      const userToCreate: ConnectedUserWithNormalizedAgencyRights = {
        id: "fake-id",
        email: "fake-email@mail.com",
        firstName: "fake-first-name",
        lastName: "fake-last-name",
        createdAt: new Date().toISOString(),
        preventToDelete: false,
        proConnect: null,
        agencyRights: {},
        dashboards: {
          agencies: noAgencyDashboards,
          establishments: noEstablishmentDashboard,
        },
      };

      store.dispatch(
        connectedUsersAdminSlice.actions.createUserOnAgencyRequested({
          userId: userToCreate.id,
          agencyId: agency2.id,
          roles: ["validator"],
          isNotifiedByEmail: false,
          email: userToCreate.email,
          feedbackTopic: "agency-user",
        }),
      );

      expectIsUpdatingUserAgencyToBe(true);

      const user: ConnectedUser = {
        ...userToCreate,
        agencyRights: [
          {
            agency: toAgencyDtoForAgencyUsersAndAdmins(agency2, []),
            roles: ["validator"],
            isNotifiedByEmail: false,
          },
        ],
      };
      dependencies.adminGateway.createUserForAgencyResponse$.next(user);

      expectIsUpdatingUserAgencyToBe(false);

      expectToEqual(
        connectedUsersAdminSelectors.agencyUsers(store.getState()),
        {
          [userToCreate.id]: {
            ...user,
            agencyRights: {
              [agency2.id]: {
                agency: toAgencyDtoForAgencyUsersAndAdmins(agency2, []),
                roles: ["validator"],
                isNotifiedByEmail: false,
              },
            },
          },
        },
      );
      expectToEqual(
        feedbacksSelectors.feedbacks(store.getState())["agency-user"],
        {
          level: "success",
          message: "L'utilisateur a été créé et associé à cette agence.",
          on: "create",
          title: "L'utilisateur a été créé",
        },
      );
    });

    it("return an error if creation went wrong", () => {
      expectToEqual(
        store.getState().admin.connectedUsersAdmin,
        connectedUsersAdminInitialState,
      );

      const userToCreate: ConnectedUserWithNormalizedAgencyRights = {
        id: "fake-id",
        email: "fake-email@mail.com",
        firstName: "fake-first-name",
        lastName: "fake-last-name",
        proConnect: null,
        createdAt: new Date().toISOString(),
        preventToDelete: false,
        agencyRights: {},
        dashboards: {
          agencies: noAgencyDashboards,
          establishments: noEstablishmentDashboard,
        },
      };

      store.dispatch(
        connectedUsersAdminSlice.actions.createUserOnAgencyRequested({
          userId: userToCreate.id,
          agencyId: agency2.id,
          roles: ["validator"],
          isNotifiedByEmail: false,
          email: userToCreate.email,
          feedbackTopic: "agency-user",
        }),
      );

      expectIsUpdatingUserAgencyToBe(true);

      dependencies.adminGateway.createUserForAgencyResponse$.error(
        errors.agency.notFound({ agencyId: agency2.id }),
      );

      expectIsUpdatingUserAgencyToBe(false);

      expectToEqual(
        connectedUsersAdminSelectors.agencyUsers(store.getState()),
        connectedUsersAdminInitialState.agencyUsers,
      );
      expectToEqual(
        feedbacksSelectors.feedbacks(store.getState())["agency-user"],
        {
          level: "error",
          message: errors.agency.notFound({ agencyId: agency2.id }).message,
          on: "create",
          title: "Problème lors de la création de l'utilisateur",
        },
      );
    });
  });

  describe("Remove users from agency", () => {
    it("should refetch agency users listing after user is removed", () => {
      const prefilledAdminState = adminPreloadedState({
        connectedUsersAdmin: {
          ...connectedUsersAdminInitialState,
          agencyUsers: testUserSet,
        },
      });
      ({ store, dependencies } = createTestStore({
        admin: prefilledAdminState,
      }));

      expectToEqual(
        connectedUsersAdminSelectors.agencyUsers(store.getState()),
        testUserSet,
      );

      store.dispatch(
        removeUserFromAgencySlice.actions.removeUserFromAgencyRequested({
          userId: authUser2.id,
          agencyId: agency3.id,
          feedbackTopic: "agency-user",
        }),
      );

      dependencies.agencyGateway.removeUserFromAgencyResponse$.next(undefined);

      expectToEqual(
        connectedUsersAdminSelectors.agencyUsers(store.getState()),
        connectedUsersAdminInitialState.agencyUsers,
      );
      expectIsFetchingAgencyUsersToBe(true);
      expectToEqual(
        feedbacksSelectors.feedbacks(store.getState())["agency-user"],
        {
          level: "success",
          message: "Les données de l'utilisateur (rôles) ont été mises à jour.",
          on: "delete",
          title: "L'utilisateur n'est plus rattaché à cette agence",
        },
      );

      dependencies.authGateway.getConnectedUsersResponse$.next([
        {
          ...authUser1,
          agencyRights: values(authUser1.agencyRights),
        },
      ]);

      expectIsFetchingAgencyUsersToBe(false);
      expectToEqual(
        connectedUsersAdminSelectors.agencyUsers(store.getState()),
        { [authUser1.id]: authUser1 },
      );
    });
  });

  describe("Update user preventToDelete", () => {
    const errorMessage =
      "Une erreur est survenue lors de la mise à jour de l'utilisateur.";

    it("updates preventToDelete successfully and stores the feedback", () => {
      store.dispatch(
        connectedUsersAdminSlice.actions.updateUserPreventToDeleteRequested({
          userId: authUser1.id,
          preventToDelete: true,
          feedbackTopic: "user-prevent-to-delete",
        }),
      );

      expectIsUpdatingUserPreventToDeleteToBe(true);

      dependencies.adminGateway.updateUserPreventToDeleteResponse$.next(
        undefined,
      );

      expectIsUpdatingUserPreventToDeleteToBe(false);
      expectToEqual(
        feedbacksSelectors.feedbacks(store.getState())[
          "user-prevent-to-delete"
        ],
        {
          level: "success",
          title: "L'utilisateur a été mis à jour",
          message: "La modification a bien été prise en compte.",
          on: "update",
        },
      );
    });

    it("does not update preventToDelete if error, and stores the feedback", () => {
      store.dispatch(
        connectedUsersAdminSlice.actions.updateUserPreventToDeleteRequested({
          userId: authUser1.id,
          preventToDelete: true,
          feedbackTopic: "user-prevent-to-delete",
        }),
      );

      expectIsUpdatingUserPreventToDeleteToBe(true);

      dependencies.adminGateway.updateUserPreventToDeleteResponse$.error(
        new Error(errorMessage),
      );

      expectIsUpdatingUserPreventToDeleteToBe(false);
      expectToEqual(
        feedbacksSelectors.feedbacks(store.getState())[
          "user-prevent-to-delete"
        ],
        {
          level: "error",
          message: errorMessage,
          on: "update",
          title: "Problème lors de la mise à jour de l'utilisateur",
        },
      );
    });
  });

  const expectIsUpdatingUserAgencyToBe = (expected: boolean) => {
    expect(
      connectedUsersAdminSelectors.isUpdatingConnectedUserAgency(
        store.getState(),
      ),
    ).toBe(expected);
  };

  const expectIsUpdatingUserPreventToDeleteToBe = (expected: boolean) => {
    expect(
      connectedUsersAdminSelectors.isUpdatingUserPreventToDelete(
        store.getState(),
      ),
    ).toBe(expected);
  };

  const expectIsFetchingIcUsersNeedingReviewToBe = (expected: boolean) => {
    expect(
      store.getState().admin.connectedUsersAdmin
        .isFetchingAgenciesNeedingReviewForIcUser,
    ).toBe(expected);
  };

  const expectIsFetchingAgencyUsersToBe = (expected: boolean) => {
    expect(
      store.getState().admin.connectedUsersAdmin.isFetchingAgencyUsers,
    ).toBe(expected);
  };

  const expectFeedbackToEqual = (expected: ConnectedUsersAdminFeedback) => {
    expectToEqual(
      connectedUsersAdminSelectors.feedback(store.getState()),
      expected,
    );
  };

  const expectAgencyAdminStateToMatch = (
    params: Partial<ConnectedUsersAdminState>,
  ) => {
    expectToEqual(store.getState().admin.connectedUsersAdmin, {
      ...connectedUsersAdminInitialState,
      ...params,
    });
  };
});
