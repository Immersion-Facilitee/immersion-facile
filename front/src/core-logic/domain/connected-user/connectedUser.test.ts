import {
  type AgencyDto,
  AgencyDtoBuilder,
  type AgencyRight,
  authExpiredMessage,
  type ConnectedUser,
  ConnectedUserBuilder,
  ConventionDtoBuilder,
  type ConventionReadDto,
  type EstablishmentAdminPrivateData,
  expectArraysToEqualIgnoringOrder,
  expectToEqual,
  type FederatedIdentity,
  FormEstablishmentDtoBuilder,
  type FormEstablishmentUserRight,
  makeEmptyLastReminders,
  noAgencyDashboards,
  noEstablishmentDashboard,
  toAgencyDtoForAgencyUsersAndAdmins,
  type UserEstablishmentRightDetails,
  type WithAgencyIds,
} from "shared";
import { removeUserFromAgencySelectors } from "src/core-logic/domain/agencies/remove-user-from-agency/removeUserFromAgency.selectors";
import { removeUserFromAgencySlice } from "src/core-logic/domain/agencies/remove-user-from-agency/removeUserFromAgency.slice";
import { updateUserOnAgencySelectors } from "src/core-logic/domain/agencies/update-user-on-agency/updateUserOnAgency.selectors";
import { updateUserOnAgencySlice } from "src/core-logic/domain/agencies/update-user-on-agency/updateUserOnAgency.slice";
import { connectedUserSelectors } from "src/core-logic/domain/connected-user/connectedUser.selectors";
import { connectedUserSlice } from "src/core-logic/domain/connected-user/connectedUser.slice";
import { conventionSlice } from "src/core-logic/domain/convention/convention.slice";
import {
  type EstablishmentUpdatePayload,
  establishmentSlice,
} from "src/core-logic/domain/establishment/establishment.slice";
import { feedbacksSelectors } from "src/core-logic/domain/feedback/feedback.selectors";
import {
  createTestStore,
  type TestDependencies,
} from "src/core-logic/storeConfig/createTestStore";
import type { ReduxStore } from "src/core-logic/storeConfig/store";
import { authSelectors } from "../auth/auth.selectors";
import { authSlice } from "../auth/auth.slice";

const agency1 = new AgencyDtoBuilder().withId("agency-1").build();

describe("InclusionConnected", () => {
  let store: ReduxStore;
  let dependencies: TestDependencies;

  const connectedUser: ConnectedUser = {
    email: "fake-user@mail.fr",
    firstName: "Fake",
    lastName: "User",
    id: "fake-user-id",
    dashboards: {
      agencies: {
        ...noAgencyDashboards,
        agencyDashboardUrl: "https://placeholder.com/",
      },
      establishments: noEstablishmentDashboard,
    },
    agencyRights: [
      {
        roles: ["agency-admin"],
        agency: toAgencyDtoForAgencyUsersAndAdmins(
          new AgencyDtoBuilder().build(),
          [],
        ),
        isNotifiedByEmail: true,
      },
    ],
    proConnect: {
      externalId: "fake-user-external-id",
      siret: "12312312301234",
    },
    createdAt: new Date().toISOString(),
    preventToDelete: false,
  };

  const inclusionConnectedFederatedIdentity: FederatedIdentity = {
    provider: "proConnect",
    token: "fake-token",
  };

  beforeEach(() => {
    ({ store, dependencies } = createTestStore());
  });

  describe("authSlice.actions.federatedIdentityFoundInDevice", () => {
    it("fetches the current IC user when inclusion connect federated identity is found in device", () => {
      expectConnectedUserSelectorIsLoadingToBe(false);
      expectCurrentUserToBe(null);
      store.dispatch(
        authSlice.actions.federatedIdentityFoundInDevice({
          federatedIdentity: inclusionConnectedFederatedIdentity,
          feedbackTopic: "auth-global",
        }),
      );

      expectConnectedUserSelectorIsLoadingToBe(true);

      dependencies.authGateway.getConnectedUserResponse$.next(connectedUser);

      expectConnectedUserSelectorIsLoadingToBe(false);
      expectCurrentUserToBe(connectedUser);
    });
  });

  describe("authSlice.actions.federatedIdentityFromStoreToDeviceStorageSucceeded", () => {
    it("fetches the current IC user when inclusion connect federated identity is successfully stored in device", () => {
      expectConnectedUserSelectorIsLoadingToBe(false);
      expectCurrentUserToBe(null);

      store.dispatch(
        authSlice.actions.federatedIdentityFromStoreToDeviceStorageSucceeded({
          federatedIdentity: inclusionConnectedFederatedIdentity,
          feedbackTopic: "auth-global",
        }),
      );

      expectConnectedUserSelectorIsLoadingToBe(true);

      dependencies.authGateway.getConnectedUserResponse$.next(connectedUser);

      expectConnectedUserSelectorIsLoadingToBe(false);
      expectCurrentUserToBe(connectedUser);
    });
  });

  describe("inclusionConnectedSlice.actions.currentUserFetchRequested", () => {
    it("fetches the current IC user", () => {
      expectConnectedUserSelectorIsLoadingToBe(false);
      expectCurrentUserToBe(null);

      store.dispatch(
        connectedUserSlice.actions.currentUserFetchRequested({
          feedbackTopic: "dashboard-agency-register-user",
        }),
      );

      expectConnectedUserSelectorIsLoadingToBe(true);

      dependencies.authGateway.getConnectedUserResponse$.next(connectedUser);

      expectConnectedUserSelectorIsLoadingToBe(false);
      expectCurrentUserToBe(connectedUser);
    });

    it("disconnects the connected user and auth slice federatedIdentity if the response includes : 'jwt expired'", () => {
      ({ store, dependencies } = createTestStore({
        auth: {
          isRequestingLoginByEmail: false,
          federatedIdentity: {
            token: "some-existing-token",
            provider: "proConnect",
          },
          isLoading: true,
          isRequestingRenewExpiredJwt: false,
          afterLoginRedirectionUrl: null,
          requestedEmail: null,
        },
      }));
      store.dispatch(
        connectedUserSlice.actions.currentUserFetchRequested({
          feedbackTopic: "auth-global",
        }),
      );
      expectConnectedUserSelectorIsLoadingToBe(true);

      const errorMessage = `Something went wrong : ${authExpiredMessage()} blah blah`;
      dependencies.authGateway.getConnectedUserResponse$.error(
        new Error(errorMessage),
      );
      expectCurrentUserToBe(null);
      expectToEqual(authSelectors.federatedIdentity(store.getState()), null);
    });

    it("stores error on failure when trying to fetch current IC user", () => {
      expectConnectedUserSelectorIsLoadingToBe(false);
      expectCurrentUserToBe(null);
      store.dispatch(
        connectedUserSlice.actions.currentUserFetchRequested({
          feedbackTopic: "dashboard-agency-register-user",
        }),
      );
      expectConnectedUserSelectorIsLoadingToBe(true);

      const errorMessage = "Something went wrong";
      dependencies.authGateway.getConnectedUserResponse$.error(
        new Error(errorMessage),
      );
      expectConnectedUserSelectorIsLoadingToBe(false);
      expectCurrentUserToBe(null);
      expectToEqual(feedbacksSelectors.feedbacks(store.getState()), {
        "dashboard-agency-register-user": {
          on: "fetch",
          level: "error",
          title: "Erreur",
          message: errorMessage,
        },
      });
    });
  });

  describe("inclusionConnectedSlice.actions.registerAgenciesRequested", () => {
    it("request agencies registration on the current user", () => {
      const agency1 = new AgencyDtoBuilder().withId("agency-1").build();
      const payload: WithAgencyIds = {
        agencies: [agency1.id],
      };

      store.dispatch(
        connectedUserSlice.actions.registerAgenciesRequested({
          ...payload,
          feedbackTopic: "dashboard-agency-register-user",
        }),
      );
      expectConnectedUserSelectorIsLoadingToBe(true);
      dependencies.agencyGateway.registerAgenciesToCurrentUserResponse$.next(
        undefined,
      );
      expectConnectedUserSelectorIsLoadingToBe(false);
      expectToEqual(feedbacksSelectors.feedbacks(store.getState()), {
        "dashboard-agency-register-user": {
          on: "create",
          level: "success",
          title: "Votre demande de rattachement a bien été prise en compte",
          message:
            "Elle sera étudiée prochainement par un administrateur et vous serez informé de sa décision.",
        },
      });
    });

    it("fetches the current IC user when registration succeed", () => {
      expectConnectedUserSelectorIsLoadingToBe(false);
      expectCurrentUserToBe(null);

      store.dispatch(
        connectedUserSlice.actions.registerAgenciesSucceeded({
          agencies: [agency1.id],
          feedbackTopic: "dashboard-agency-register-user",
        }),
      );

      dependencies.authGateway.getConnectedUserResponse$.next(connectedUser);

      expectConnectedUserSelectorIsLoadingToBe(false);
      expectCurrentUserToBe(connectedUser);
    });

    it("request agencies registration on the current user to throw on error", () => {
      const payload: WithAgencyIds = {
        agencies: [agency1.id],
      };
      const errorMessage = "Error registering user to agencies to review";
      store.dispatch(
        connectedUserSlice.actions.registerAgenciesRequested({
          ...payload,
          feedbackTopic: "dashboard-agency-register-user",
        }),
      );
      expectConnectedUserSelectorIsLoadingToBe(true);
      dependencies.agencyGateway.registerAgenciesToCurrentUserResponse$.error(
        new Error(errorMessage),
      );
      expectToEqual(feedbacksSelectors.feedbacks(store.getState()), {
        "dashboard-agency-register-user": {
          on: "create",
          level: "error",
          title: "Erreur lors de la demande de rattachement à une agence",
          message: errorMessage,
        },
      });
      expectConnectedUserSelectorIsLoadingToBe(false);
    });
  });

  describe("when a convention is in store", () => {
    const convention: ConventionReadDto = {
      ...new ConventionDtoBuilder().build(),
      agencyName: "Agence de test",
      agencyDepartment: "75",
      agencyContactEmail: "contact@mail.com",
      agencyKind: "mission-locale",
      agencySiret: "11112222000033",
      agencyValidationSteps: "validator-only",
      assessment: null,
      lastReminders: makeEmptyLastReminders(),
      isEstablishmentBanned: false,
    };

    const adminUser: ConnectedUser = {
      ...connectedUser,
      agencyRights: [
        {
          roles: ["agency-admin", "validator"],
          agency: toAgencyDtoForAgencyUsersAndAdmins(
            new AgencyDtoBuilder().build(),
            [],
          ),
          isNotifiedByEmail: true,
        },
      ],
      isBackofficeAdmin: true,
    };

    beforeEach(() => {
      store.dispatch(
        conventionSlice.actions.fetchConventionSucceeded({
          convention,
          feedbackTopic: "convention-form",
        }),
      );
      store.dispatch(
        connectedUserSlice.actions.currentUserFetchSucceeded(adminUser),
      );
    });

    it("user can have multiple roles", () => {
      expectArraysToEqualIgnoringOrder(
        connectedUserSelectors.userRolesForFetchedConvention(store.getState()),
        ["back-office", "agency-admin", "validator"],
      );
    });
  });

  describe("when current user has successfully requested an update of another user", () => {
    it("if it is himself, update the user rights successfully", () => {
      const agency = new AgencyDtoBuilder().build();
      const agencyRight: AgencyRight = {
        agency: toAgencyDtoForAgencyUsersAndAdmins(
          new AgencyDtoBuilder().build(),
          [],
        ),
        roles: ["validator"],
        isNotifiedByEmail: false,
      };
      const user: ConnectedUser = new ConnectedUserBuilder()
        .withId("user-id")
        .withIsAdmin(false)
        .withAgencyRights([agencyRight])
        .build();

      ({ store, dependencies } = createTestStore({
        connectedUser: {
          currentUser: user,
          agenciesToReview: [],
          isLoading: false,
        },
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
      expectToEqual(connectedUserSelectors.currentUser(store.getState()), {
        ...user,
        agencyRights: [
          {
            ...agencyRight,
            roles: [...agencyRight.roles, "counsellor"],
          },
        ],
      });
    });

    it("if it is not himself, do nothing", () => {
      const agency = new AgencyDtoBuilder().build();
      const agencyRight: AgencyRight = {
        agency: toAgencyDtoForAgencyUsersAndAdmins(
          new AgencyDtoBuilder().build(),
          [],
        ),
        roles: ["validator"],
        isNotifiedByEmail: false,
      };
      const user: ConnectedUser = new ConnectedUserBuilder()
        .withId("user-id")
        .withIsAdmin(false)
        .withAgencyRights([agencyRight])
        .build();

      ({ store, dependencies } = createTestStore({
        connectedUser: {
          currentUser: user,
          agenciesToReview: [],
          isLoading: false,
        },
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
      expectToEqual(connectedUserSelectors.currentUser(store.getState()), user);
    });
  });

  describe("when current user has successfully requested removal from agency of another user", () => {
    let user: ConnectedUser;
    let agency: AgencyDto;

    beforeEach(() => {
      agency = new AgencyDtoBuilder().build();
      const agencyRight: AgencyRight = {
        agency: toAgencyDtoForAgencyUsersAndAdmins(
          new AgencyDtoBuilder().build(),
          [],
        ),
        roles: ["to-review"],
        isNotifiedByEmail: false,
      };
      user = new ConnectedUserBuilder()
        .withId("user-id")
        .withIsAdmin(false)
        .withAgencyRights([agencyRight])
        .build();

      ({ store, dependencies } = createTestStore({
        connectedUser: {
          currentUser: user,
          agenciesToReview: [],
          isLoading: false,
        },
      }));
    });

    it("if it is himself, remove the user rights successfully", () => {
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
      expectToEqual(connectedUserSelectors.currentUser(store.getState()), {
        ...user,
        agencyRights: [],
      });
    });

    it("if it is not himself, do nothing", () => {
      // const agency = new AgencyDtoBuilder().build();
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
      expectToEqual(connectedUserSelectors.currentUser(store.getState()), user);
    });
  });

  describe("when establishment is updated", () => {
    describe("when current user is an admin of the establishment", () => {
      it("does nothing if current user rights are not updated", () => {
        const currentUserAdminData: EstablishmentAdminPrivateData = {
          email: "user@email.com",
          firstName: "My current user first name",
          lastName: "My current user last name",
        };
        const otherUserAdminData: EstablishmentAdminPrivateData = {
          email: "other-user@email.com",
          firstName: "Other first name",
          lastName: "Other last name",
        };
        const user = new ConnectedUserBuilder()
          .withEmail(currentUserAdminData.email)
          .withFirstName(currentUserAdminData.firstName)
          .withLastName(currentUserAdminData.lastName)
          .withId("my-fake-user-id")
          .withEstablishments([
            {
              admins: [currentUserAdminData, otherUserAdminData],
              businessName: "Ma super entreprise",
              role: "establishment-admin",
              siret: "01234567890123",
              status: "ACCEPTED",
              shouldReceiveDiscussionNotifications: true,
              isEstablishmentBanned: false,
            },
            {
              admins: [otherUserAdminData],
              businessName: "Ma super entreprise 2",
              role: "establishment-admin",
              siret: "01234567890124",
              status: "ACCEPTED",
              shouldReceiveDiscussionNotifications: false,
              isEstablishmentBanned: false,
            },
          ])
          .build();

        ({ store, dependencies } = createTestStore({
          connectedUser: {
            currentUser: user,
            agenciesToReview: [],
            isLoading: false,
          },
        }));

        const establishment = FormEstablishmentDtoBuilder.valid()
          .withUserRights([
            {
              email: currentUserAdminData.email,
              role: "establishment-admin",
              status: "ACCEPTED",
              job: "fake job",
              phone: "+33600000000",
              shouldReceiveDiscussionNotifications: true,
              isMainContactByPhone: false,
            },
            {
              email: otherUserAdminData.email,
              role: "establishment-admin",
              status: "ACCEPTED",
              job: "fake job",
              phone: "+33600000000",
              shouldReceiveDiscussionNotifications: true,
              isMainContactByPhone: false,
            },
          ])
          .build();
        const establishmentUpdate: EstablishmentUpdatePayload = {
          formEstablishment: establishment,
          jwt: "my-fake-jwt",
        };

        store.dispatch(
          establishmentSlice.actions.updateEstablishmentSucceeded({
            establishmentUpdate,
            feedbackTopic: "unused",
          }),
        );

        expectArraysToEqualIgnoringOrder(
          connectedUserSelectors.currentUser(store.getState())
            ?.establishments ?? [],
          user.establishments ?? [],
        );
      });

      it("removes current user admin rights if removed from establishment", () => {
        const currentUserAdminData: EstablishmentAdminPrivateData = {
          email: "user@email.com",
          firstName: "My current user first name",
          lastName: "My current user last name",
        };
        const otherUserAdminData: EstablishmentAdminPrivateData = {
          email: "other-user@email.com",
          firstName: "Other first name",
          lastName: "Other last name",
        };
        const otherEstablishmentToKeepUserRight: FormEstablishmentUserRight = {
          email: otherUserAdminData.email,
          role: "establishment-contact",
          status: "ACCEPTED",
          job: "fake job",
          phone: "+33600000000",
          shouldReceiveDiscussionNotifications: true,
          isMainContactByPhone: false,
        };
        const otherEstablishmentToKeepData: UserEstablishmentRightDetails = {
          admins: [otherUserAdminData],
          businessName: "Ma super entreprise 2",
          role: otherEstablishmentToKeepUserRight.role,
          siret: "01234567890124",
          status: "ACCEPTED",
          shouldReceiveDiscussionNotifications: true,
          isEstablishmentBanned: false,
        };
        const user = new ConnectedUserBuilder()
          .withEmail(currentUserAdminData.email)
          .withFirstName(currentUserAdminData.firstName)
          .withLastName(currentUserAdminData.lastName)
          .withId("my-fake-user-id")
          .withIsAdmin(false)
          .withEstablishments([
            {
              admins: [currentUserAdminData],
              businessName: "Ma super entreprise",
              role: "establishment-admin",
              siret: "01234567890123",
              status: "ACCEPTED",
              shouldReceiveDiscussionNotifications: true,
              isEstablishmentBanned: false,
            },
            otherEstablishmentToKeepData,
          ])
          .build();

        ({ store, dependencies } = createTestStore({
          connectedUser: {
            currentUser: user,
            agenciesToReview: [],
            isLoading: false,
          },
        }));

        const updatedFormEstablishment = FormEstablishmentDtoBuilder.valid()
          .withUserRights([otherEstablishmentToKeepUserRight])
          .build();
        const establishmentUpdate: EstablishmentUpdatePayload = {
          formEstablishment: updatedFormEstablishment,
          jwt: "my-fake-jwt",
        };

        expectToEqual(connectedUserSelectors.currentUser(store.getState()), {
          ...user,
          establishments: [
            {
              admins: [currentUserAdminData],
              businessName: updatedFormEstablishment.businessName,
              siret: updatedFormEstablishment.siret,
              role: "establishment-admin",
              status: "ACCEPTED",
              shouldReceiveDiscussionNotifications: true,
              isEstablishmentBanned: false,
            },
            otherEstablishmentToKeepData,
          ],
        });

        store.dispatch(
          establishmentSlice.actions.updateEstablishmentSucceeded({
            establishmentUpdate,
            feedbackTopic: "unused",
          }),
        );

        dependencies.authGateway.getConnectedUserResponse$.next({
          ...user,
          establishments: [otherEstablishmentToKeepData],
        });

        expectToEqual(
          connectedUserSelectors.currentUser(store.getState())
            ?.establishments ?? [],
          [otherEstablishmentToKeepData],
        );
      });
      it("switch current user admin rights to establishment-contact if updated in establishment", () => {
        const currentUserAdminData: EstablishmentAdminPrivateData = {
          email: "user@email.com",
          firstName: "My current user first name",
          lastName: "My current user last name",
        };
        const otherUserAdminData: EstablishmentAdminPrivateData = {
          email: "other-user@email.com",
          firstName: "Other first name",
          lastName: "Other last name",
        };
        const otherEstablishmentUserRight: FormEstablishmentUserRight = {
          email: otherUserAdminData.email,
          role: "establishment-contact",
          status: "ACCEPTED",
          job: "fake job",
          phone: "+33600000000",
          shouldReceiveDiscussionNotifications: true,
          isMainContactByPhone: false,
        };
        const otherEstablishmentData: UserEstablishmentRightDetails = {
          admins: [otherUserAdminData],
          businessName: "Ma super entreprise 2",
          role: otherEstablishmentUserRight.role,
          siret: "01234567890124",
          status: "ACCEPTED",
          shouldReceiveDiscussionNotifications: true,
          isEstablishmentBanned: false,
        };
        const user = new ConnectedUserBuilder()
          .withEmail(currentUserAdminData.email)
          .withFirstName(currentUserAdminData.firstName)
          .withLastName(currentUserAdminData.lastName)
          .withId("my-fake-user-id")
          .withIsAdmin(false)
          .withEstablishments([
            {
              admins: [currentUserAdminData],
              businessName: "Ma super entreprise",
              role: "establishment-admin",
              siret: "01234567890123",
              status: "ACCEPTED",
              shouldReceiveDiscussionNotifications: true,
              isEstablishmentBanned: false,
            },
            otherEstablishmentData,
          ])
          .build();

        ({ store, dependencies } = createTestStore({
          connectedUser: {
            currentUser: user,
            agenciesToReview: [],
            isLoading: false,
          },
        }));

        const updatedEstablishmentUserRight: FormEstablishmentUserRight = {
          email: currentUserAdminData.email,
          role: "establishment-contact",
          status: "ACCEPTED",
          job: "fake job",
          phone: "+33600000000",
          shouldReceiveDiscussionNotifications: true,
          isMainContactByPhone: false,
        };

        const establishment = FormEstablishmentDtoBuilder.valid()
          .withUserRights([
            updatedEstablishmentUserRight,
            otherEstablishmentUserRight,
          ])
          .build();
        const establishmentUpdate: EstablishmentUpdatePayload = {
          formEstablishment: establishment,
          jwt: "my-fake-jwt",
        };

        store.dispatch(
          establishmentSlice.actions.updateEstablishmentSucceeded({
            establishmentUpdate,
            feedbackTopic: "unused",
          }),
        );

        dependencies.authGateway.getConnectedUserResponse$.next({
          ...user,
          establishments: [
            {
              admins: [currentUserAdminData],
              businessName: establishment.businessName,
              siret: establishment.siret,
              role: "establishment-contact",
              status: "ACCEPTED",
              shouldReceiveDiscussionNotifications: false,
              isEstablishmentBanned: false,
            },
            otherEstablishmentData,
          ],
        });

        expectArraysToEqualIgnoringOrder(
          connectedUserSelectors.currentUser(store.getState())
            ?.establishments ?? [],
          [
            {
              admins: [currentUserAdminData],
              businessName: establishment.businessName,
              siret: establishment.siret,
              role: "establishment-contact",
              status: "ACCEPTED",
              shouldReceiveDiscussionNotifications: false,
              isEstablishmentBanned: false,
            },
            otherEstablishmentData,
          ],
        );
      });
    });
  });
  const expectConnectedUserSelectorIsLoadingToBe = (expected: boolean) => {
    expect(connectedUserSelectors.isLoading(store.getState())).toBe(expected);
  };

  const expectCurrentUserToBe = (expected: ConnectedUser | null) => {
    expect(connectedUserSelectors.currentUser(store.getState())).toBe(expected);
  };
});
