import {
  type ConnectedUser,
  ConnectedUserBuilder,
  currentJwtVersions,
  type Email,
  type EmailAuthCodeJwtPayload,
  errors,
  expectToEqual,
  type FederatedIdentity,
  noAgencyDashboards,
  noEstablishmentDashboard,
} from "shared";
import { authSelectors } from "src/core-logic/domain/auth/auth.selectors";
import {
  type AuthState,
  authSlice,
  initialAuthState,
  type RenewJwtPayload,
} from "src/core-logic/domain/auth/auth.slice";
import { connectedUserSelectors } from "src/core-logic/domain/connected-user/connectedUser.selectors";
import { rootAppSlice } from "src/core-logic/domain/rootApp/rootApp.slice";
import {
  createTestStore,
  type TestDependencies,
} from "src/core-logic/storeConfig/createTestStore";
import type { ReduxStore } from "src/core-logic/storeConfig/store";
import { type FeedbackTopic, feedbacks } from "../feedback/feedback.content";
import { feedbacksSelectors } from "../feedback/feedback.selectors";
import type { PayloadWithFeedbackTopic } from "../feedback/feedback.slice";

describe("Auth slice", () => {
  const proConnectFederatedIdentity: FederatedIdentity = {
    provider: "proConnect",
    token: "123",
  };

  let store: ReduxStore;
  let dependencies: TestDependencies;

  beforeEach(() => {
    ({ store, dependencies } = createTestStore());
  });

  it("stores the federated identity when someones connects (in store and in device)", () => {
    expectAuthStateToBe({
      afterLoginRedirectionUrl: null,
      federatedIdentity: null,
      isLoading: true,
      isRequestingLoginByEmail: false,
      isRequestingRenewExpiredJwt: false,
      requestedEmail: null,
    });

    store.dispatch(
      authSlice.actions.federatedIdentityProvided({
        federatedIdentity: proConnectFederatedIdentity,
        feedbackTopic: "auth-global",
      }),
    );

    expectAuthStateToBe({
      afterLoginRedirectionUrl: null,
      federatedIdentity: proConnectFederatedIdentity,
      isLoading: false,
      isRequestingLoginByEmail: false,
      isRequestingRenewExpiredJwt: false,
      requestedEmail: null,
    });

    expectFederatedIdentityInDevice(proConnectFederatedIdentity);

    expectAuthStateToBe({
      afterLoginRedirectionUrl: null,
      federatedIdentity: proConnectFederatedIdentity,
      isLoading: false,
      isRequestingLoginByEmail: false,
      isRequestingRenewExpiredJwt: false,
      requestedEmail: null,
    });
  });

  describe("fetchLogoutUrlRequested", () => {
    it.each([
      {
        provider: "proConnect",
        federatedIdentity: proConnectFederatedIdentity,
      },
    ])("when provider = '$provider', deletes federatedIdentity & partialConventionInUrl stored in device and in store, then redirects to provider logout page", ({
      federatedIdentity,
    }) => {
      ({ store, dependencies } = createTestStore({
        auth: {
          isRequestingLoginByEmail: false,
          isRequestingRenewExpiredJwt: false,
          federatedIdentity: federatedIdentity,
          afterLoginRedirectionUrl: null,
          isLoading: true,
          requestedEmail: null,
        },
        connectedUser: {
          currentUser: new ConnectedUserBuilder().build(),
          isLoading: false,
          agenciesToReview: [],
        },
      }));
      dependencies.localDeviceRepository.set(
        "federatedIdentity",
        federatedIdentity,
      );

      store.dispatch(
        authSlice.actions.fetchLogoutUrlRequested({
          mode: "device-and-oauth",
          feedbackTopic: "auth-global",
        }),
      );

      dependencies.authGateway.getLogoutUrlResponse$.next(
        "http://yolo-logout.com",
      );

      expectAuthStateToBe({
        afterLoginRedirectionUrl: null,
        federatedIdentity: null,
        isLoading: true,
        isRequestingLoginByEmail: false,
        isRequestingRenewExpiredJwt: false,
        requestedEmail: null,
      });

      expectFederatedIdentityInDevice(undefined);
      expect(connectedUserSelectors.currentUser(store.getState())).toBe(null);

      expectToEqual(dependencies.navigationGateway.wentToUrls, [
        "http://yolo-logout.com",
      ]);
    });

    it("with provider proConnect - deletes federatedIdentity & partialConventionInUrl stored in device and in store when asked for without redirects to provider logout page", () => {
      ({ store, dependencies } = createTestStore({
        auth: {
          isRequestingLoginByEmail: false,
          federatedIdentity: proConnectFederatedIdentity,
          afterLoginRedirectionUrl: null,
          isLoading: true,
          isRequestingRenewExpiredJwt: false,
          requestedEmail: null,
        },
        connectedUser: {
          currentUser: new ConnectedUserBuilder().build(),
          isLoading: false,
          agenciesToReview: [],
        },
      }));
      dependencies.localDeviceRepository.set(
        "federatedIdentity",
        proConnectFederatedIdentity,
      );
      store.dispatch(
        authSlice.actions.fetchLogoutUrlRequested({
          mode: "device-only",
          feedbackTopic: "auth-global",
        }),
      );

      expectAuthStateToBe({
        afterLoginRedirectionUrl: null,
        federatedIdentity: null,
        isLoading: true,
        isRequestingLoginByEmail: false,
        isRequestingRenewExpiredJwt: false,
        requestedEmail: null,
      });

      expectFederatedIdentityInDevice(undefined);
      expectToEqual(dependencies.navigationGateway.wentToUrls, []);

      expectAuthStateToBe({
        afterLoginRedirectionUrl: null,
        federatedIdentity: null,
        isLoading: true,
        isRequestingLoginByEmail: false,
        isRequestingRenewExpiredJwt: false,
        requestedEmail: null,
      });
      expect(connectedUserSelectors.currentUser(store.getState())).toBe(null);
    });

    it("with provider email and mode device-and-oauth - deletes federatedIdentity & partialConventionInUrl stored in device and in store when asked for and provides error feedback ", () => {
      const emailFederatedIdentity: FederatedIdentity = {
        provider: "email",
        token: "token",
      };

      ({ store, dependencies } = createTestStore({
        auth: {
          isRequestingLoginByEmail: false,
          federatedIdentity: emailFederatedIdentity,
          afterLoginRedirectionUrl: null,
          isLoading: true,
          isRequestingRenewExpiredJwt: false,
          requestedEmail: null,
        },
        connectedUser: {
          currentUser: null,
          isLoading: false,
          agenciesToReview: [],
        },
      }));
      dependencies.localDeviceRepository.set(
        "federatedIdentity",
        emailFederatedIdentity,
      );

      store.dispatch(
        authSlice.actions.fetchLogoutUrlRequested({
          mode: "device-and-oauth",
          feedbackTopic: "auth-global",
        }),
      );

      expectAuthStateToBe({
        afterLoginRedirectionUrl: null,
        federatedIdentity: null,
        isLoading: true,
        isRequestingLoginByEmail: false,
        isRequestingRenewExpiredJwt: false,
        requestedEmail: null,
      });

      expectFederatedIdentityInDevice(undefined);
      expectToEqual(dependencies.navigationGateway.wentToUrls, []);

      expect(connectedUserSelectors.currentUser(store.getState())).toBe(null);
      expectToEqual(
        feedbacksSelectors.feedbacks(store.getState())["auth-global"],
        {
          on: "delete",
          level: "error",
          title: "Une erreur est survenue lors de la déconnexion",
          message: "Vous n'avez pas pu vous déconnecter.",
        },
      );
    });

    it("on getLogoutUrlResponse error - deletes federatedIdentity & partialConventionInUrl stored in device and in store when asked for without redirects to provider logout page", () => {
      ({ store, dependencies } = createTestStore({
        auth: {
          isRequestingLoginByEmail: false,
          federatedIdentity: proConnectFederatedIdentity,
          afterLoginRedirectionUrl: null,
          isLoading: true,
          isRequestingRenewExpiredJwt: false,
          requestedEmail: null,
        },
        connectedUser: {
          currentUser: new ConnectedUserBuilder().build(),
          isLoading: false,
          agenciesToReview: [],
        },
      }));
      dependencies.localDeviceRepository.set(
        "federatedIdentity",
        proConnectFederatedIdentity,
      );

      store.dispatch(
        authSlice.actions.fetchLogoutUrlRequested({
          mode: "device-and-oauth",
          feedbackTopic: "auth-global",
        }),
      );

      dependencies.authGateway.getLogoutUrlResponse$.error(new Error("Error"));

      expectAuthStateToBe({
        afterLoginRedirectionUrl: null,
        federatedIdentity: null,
        isLoading: true,
        isRequestingLoginByEmail: false,
        isRequestingRenewExpiredJwt: false,
        requestedEmail: null,
      });

      expectFederatedIdentityInDevice(undefined);
      expectToEqual(dependencies.navigationGateway.wentToUrls, []);
      expectToEqual(
        feedbacksSelectors.feedbacks(store.getState())["auth-global"],
        {
          on: "delete",
          level: "error",
          title: "Une erreur est survenue lors de la déconnexion",
          message: "Vous n'avez pas pu vous déconnecter.",
        },
      );
    });
  });

  it("retrieves federatedIdentity if stored in device", () => {
    expectAuthStateToBe({
      afterLoginRedirectionUrl: null,
      federatedIdentity: null,
      isLoading: true,
      isRequestingLoginByEmail: false,
      isRequestingRenewExpiredJwt: false,
      requestedEmail: null,
    });

    dependencies.localDeviceRepository.set(
      "federatedIdentity",
      proConnectFederatedIdentity,
    );
    store.dispatch(rootAppSlice.actions.appIsReady());

    expectAuthStateToBe({
      afterLoginRedirectionUrl: null,
      federatedIdentity: proConnectFederatedIdentity,
      isLoading: false,
      isRequestingLoginByEmail: false,
      isRequestingRenewExpiredJwt: false,
      requestedEmail: null,
    });

    expectFederatedIdentityInDevice(proConnectFederatedIdentity);
    const user: ConnectedUser = {
      id: "123",
      email: "mail@mail.com",
      firstName: "billy",
      lastName: "idol",
      agencyRights: [],
      dashboards: {
        agencies: noAgencyDashboards,
        establishments: noEstablishmentDashboard,
      },
      proConnect: {
        externalId: "fake-user-external-id",
        siret: "12345678901234",
      },
      createdAt: new Date().toISOString(),
      preventToDelete: false,
    };
    dependencies.authGateway.getConnectedUserResponse$.next(user);
    expectToEqual(connectedUserSelectors.currentUser(store.getState()), user);

    expectAuthStateToBe({
      afterLoginRedirectionUrl: null,
      federatedIdentity: proConnectFederatedIdentity,
      isLoading: false,
      isRequestingLoginByEmail: false,
      isRequestingRenewExpiredJwt: false,
      requestedEmail: null,
    });
  });

  it("shouldn't be logged in if no federatedIdentity stored in device", () => {
    dependencies.localDeviceRepository.delete("federatedIdentity");
    expectAuthStateToBe({
      afterLoginRedirectionUrl: null,
      federatedIdentity: null,
      isLoading: true,
      isRequestingLoginByEmail: false,
      isRequestingRenewExpiredJwt: false,
      requestedEmail: null,
    });

    store.dispatch(rootAppSlice.actions.appIsReady());

    expectAuthStateToBe({
      afterLoginRedirectionUrl: null,
      federatedIdentity: null,
      isLoading: false,
      isRequestingLoginByEmail: false,
      isRequestingRenewExpiredJwt: false,
      requestedEmail: null,
    });

    expectFederatedIdentityInDevice(undefined);

    expectAuthStateToBe({
      afterLoginRedirectionUrl: null,
      federatedIdentity: null,
      isLoading: false,
      isRequestingLoginByEmail: false,
      isRequestingRenewExpiredJwt: false,
      requestedEmail: null,
    });
  });

  it("should store redirection url in device storage", () => {
    const urlToRedirectAfterLogin =
      "https://fake-url.com/after-login-redirection";
    store.dispatch(
      authSlice.actions.saveRedirectionAfterLoginRequested({
        url: urlToRedirectAfterLogin,
      }),
    );
    expect(
      dependencies.sessionDeviceRepository.get("afterLoginRedirectionUrl"),
    ).toEqual(urlToRedirectAfterLogin);
    expect(authSelectors.afterLoginRedirectionUrl(store.getState())).toEqual(
      urlToRedirectAfterLogin,
    );
  });

  it("should clear redirection url from device after login and redirection complete", () => {
    const urlToRedirectAfterLogin =
      "https://fake-url.com/after-login-redirection";
    store.dispatch(
      authSlice.actions.saveRedirectionAfterLoginRequested({
        url: urlToRedirectAfterLogin,
      }),
    );
    expect(authSelectors.afterLoginRedirectionUrl(store.getState())).toEqual(
      urlToRedirectAfterLogin,
    );
    store.dispatch(authSlice.actions.redirectAndClearUrlAfterLoginRequested());
    expect(authSelectors.afterLoginRedirectionUrl(store.getState())).toEqual(
      null,
    );
    expectToEqual(dependencies.navigationGateway.wentToUrls, [
      urlToRedirectAfterLogin,
    ]);
  });

  describe("login by email", () => {
    const email: Email = "email@mail.com";

    it("should handle login by email successfully", () => {
      expectAuthStateToBe({
        afterLoginRedirectionUrl: null,
        federatedIdentity: null,
        isLoading: true,
        isRequestingLoginByEmail: false,
        isRequestingRenewExpiredJwt: false,
        requestedEmail: null,
      });

      store.dispatch(
        authSlice.actions.loginByEmailRequested({
          redirectUri: "/if/establishment",
          email,
          feedbackTopic: "login-by-email",
        }),
      );

      expectAuthStateToBe({
        afterLoginRedirectionUrl: null,
        federatedIdentity: null,
        isLoading: true,
        isRequestingLoginByEmail: true,
        isRequestingRenewExpiredJwt: false,
        requestedEmail: email,
      });

      dependencies.authGateway.loginByEmailResponse$.next();

      expectAuthStateToBe({
        afterLoginRedirectionUrl: null,
        federatedIdentity: null,
        isLoading: true,
        isRequestingLoginByEmail: false,
        isRequestingRenewExpiredJwt: false,
        requestedEmail: email,
      });

      expectToEqual(
        feedbacksSelectors.feedbacks(store.getState())["login-by-email"],
        {
          on: "create",
          level: "success",
          // biome-ignore lint/style/noNonNullAssertion: Should crash if not present
          title: feedbacks["login-by-email"]["create.success"]!.title,
          // biome-ignore lint/style/noNonNullAssertion: Should crash if not present
          message: feedbacks["login-by-email"]["create.success"]!.message,
        },
      );
    });

    it("should handle login by email failed", () => {
      expectAuthStateToBe({
        afterLoginRedirectionUrl: null,
        federatedIdentity: null,
        isLoading: true,
        isRequestingLoginByEmail: false,
        isRequestingRenewExpiredJwt: false,
        requestedEmail: null,
      });

      store.dispatch(
        authSlice.actions.loginByEmailRequested({
          redirectUri: "/if/establishmentDashboard?discussionId=discussion0",
          email,
          feedbackTopic: "login-by-email",
        }),
      );

      expectAuthStateToBe({
        afterLoginRedirectionUrl: null,
        federatedIdentity: null,
        isLoading: true,
        isRequestingLoginByEmail: true,
        isRequestingRenewExpiredJwt: false,
        requestedEmail: email,
      });

      const errorMessage = "Error message";
      dependencies.authGateway.loginByEmailResponse$.error(
        new Error(errorMessage),
      );

      expectAuthStateToBe({
        afterLoginRedirectionUrl: null,
        federatedIdentity: null,
        isLoading: true,
        isRequestingLoginByEmail: false,
        isRequestingRenewExpiredJwt: false,
        requestedEmail: email,
      });
      expectToEqual(
        feedbacksSelectors.feedbacks(store.getState())["login-by-email"],
        {
          on: "create",
          level: "error",
          // biome-ignore lint/style/noNonNullAssertion: Should crash if not present
          title: feedbacks["login-by-email"]["create.error"]!.title,
          message: errorMessage,
        },
      );
    });
  });
  describe("login by magic link", () => {
    it("should handle login by magic link confirmation successfully and redirect to the given redirectUri", () => {
      expectAuthStateToBe(initialAuthState);
      const redirectUri = "http://fake-url.com/if/establishment";
      store.dispatch(
        authSlice.actions.confirmLoginByMagicLinkRequested({
          code: "fake-code",
          state: "fake-state",
          email: "email@mail.com",
          feedbackTopic: "magic-link-interstitial",
        }),
      );
      expectAuthStateToBe({
        ...initialAuthState,
        isLoading: true,
      });
      dependencies.authGateway.confirmLoginByMagicLinkResponse$.next({
        ...proConnectFederatedIdentity,
        redirectUri,
      });
      expectAuthStateToBe({
        ...initialAuthState,
        isLoading: false,
      });
      expectToEqual(dependencies.navigationGateway.wentToUrls, [redirectUri]);
    });

    it("should handle login by magic link confirmation failed", () => {
      expectAuthStateToBe(initialAuthState);
      store.dispatch(
        authSlice.actions.confirmLoginByMagicLinkRequested({
          code: "fake-code",
          state: "fake-state",
          email: "email@mail.com",
          feedbackTopic: "magic-link-interstitial",
        }),
      );
      expectAuthStateToBe({
        ...initialAuthState,
        isLoading: true,
      });
      const errorMessage = "Error message from gateway";
      dependencies.authGateway.confirmLoginByMagicLinkResponse$.error(
        new Error(errorMessage),
      );
      expectAuthStateToBe({
        ...initialAuthState,
        isLoading: false,
      });
      expectToEqual(dependencies.navigationGateway.wentToUrls, []);
      expectToEqual(feedbacksSelectors.feedbacks(store.getState()), {
        "magic-link-interstitial": {
          on: "fetch",
          level: "error",
          title: "Erreur de connexion",
          message: errorMessage,
        },
      });
    });
  });

  describe("renew expired jwt", () => {
    const feedbackTopic: FeedbackTopic = "renew-expired-jwt";
    const payload: RenewJwtPayload & PayloadWithFeedbackTopic = {
      expiredJwt: "jwt",
      feedbackTopic,
    };

    it("should renew expired jwt successfully", () => {
      expectAuthStateToBe(initialAuthState);

      dependencies.jwtValidator.nextDecodeJwtResult = {
        userId: "",
        version: currentJwtVersions.connectedUser,
      };

      store.dispatch(authSlice.actions.renewExpiredJwtRequested(payload));

      expectAuthStateToBe({
        ...initialAuthState,
        isRequestingRenewExpiredJwt: true,
      });

      dependencies.authGateway.renewExpiredJwtResponse$.next();

      expectAuthStateToBe(initialAuthState);

      expectToEqual(
        feedbacksSelectors.feedbacks(store.getState())[feedbackTopic],
        {
          on: "create",
          level: "success",
          // biome-ignore lint/style/noNonNullAssertion: Should crash if not present
          title: feedbacks[feedbackTopic]["create.success"]!.title,
          // biome-ignore lint/style/noNonNullAssertion: Should crash if not present
          message: feedbacks[feedbackTopic]["create.success"]!.message,
        },
      );
    });

    it("should renew expired jwt failed on error response", () => {
      expectAuthStateToBe(initialAuthState);

      dependencies.jwtValidator.nextDecodeJwtResult = {
        userId: "",
        version: currentJwtVersions.connectedUser,
      };

      store.dispatch(authSlice.actions.renewExpiredJwtRequested(payload));

      expectAuthStateToBe({
        ...initialAuthState,
        isRequestingRenewExpiredJwt: true,
      });

      const errorMessage = "Error message";

      dependencies.authGateway.renewExpiredJwtResponse$.error(
        new Error(errorMessage),
      );

      expectAuthStateToBe(initialAuthState);

      expectToEqual(
        feedbacksSelectors.feedbacks(store.getState())[feedbackTopic],
        {
          on: "create",
          level: "error",
          // biome-ignore lint/style/noNonNullAssertion: Should crash if not present
          title: feedbacks[feedbackTopic]["create.error"]!.title,
          message: errorMessage,
        },
      );
    });

    it("should renew expired jwt failed on jwtDecoder Error", () => {
      expectAuthStateToBe(initialAuthState);

      const errorMessage = "Bad JWT";
      dependencies.jwtValidator.nextDecodeJwtResult = new Error(errorMessage);

      store.dispatch(authSlice.actions.renewExpiredJwtRequested(payload));

      expectAuthStateToBe({
        ...initialAuthState,
        isRequestingRenewExpiredJwt: false,
      });

      expectAuthStateToBe(initialAuthState);

      expectToEqual(
        feedbacksSelectors.feedbacks(store.getState())[feedbackTopic],
        {
          on: "create",
          level: "error",
          // biome-ignore lint/style/noNonNullAssertion: Should crash if not present
          title: feedbacks[feedbackTopic]["create.error"]!.title,
          message: errorMessage,
        },
      );
    });

    it("should renew expired jwt failed on unsupported JWT payload", () => {
      expectAuthStateToBe(initialAuthState);

      const unsupportedJwtPayload = {
        version: currentJwtVersions.emailAuthCode,
      } as unknown as EmailAuthCodeJwtPayload;

      dependencies.jwtValidator.nextDecodeJwtResult = unsupportedJwtPayload;

      store.dispatch(authSlice.actions.renewExpiredJwtRequested(payload));

      expectAuthStateToBe({
        ...initialAuthState,
        isRequestingRenewExpiredJwt: false,
      });

      expectAuthStateToBe(initialAuthState);

      expectToEqual(
        feedbacksSelectors.feedbacks(store.getState())[feedbackTopic],
        {
          on: "create",
          level: "error",
          // biome-ignore lint/style/noNonNullAssertion: Should crash if not present
          title: feedbacks[feedbackTopic]["create.error"]!.title,
          message: errors.user.unsupportedJwtPayload().message,
        },
      );
    });
  });

  const expectAuthStateToBe = (authState: AuthState) => {
    expectToEqual(store.getState().auth, authState);
  };

  const expectFederatedIdentityInDevice = (
    federatedIdentity: FederatedIdentity | undefined,
  ) => {
    expect(dependencies.localDeviceRepository.get("federatedIdentity")).toEqual(
      federatedIdentity,
    );
  };
});
