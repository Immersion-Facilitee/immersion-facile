import type { PayloadAction } from "@reduxjs/toolkit";
import { defer, filter, map, type Observable, of, tap, throwError } from "rxjs";
import { switchMap } from "rxjs/operators";
import {
  type AbsoluteUrl,
  type ConnectedUserJwt,
  type ConventionJwt,
  type EmailAuthCodeJwt,
  errors,
  type RenewExpiredJwtRequestDto,
} from "shared";
import { rootAppSlice } from "src/core-logic/domain/rootApp/rootApp.slice";
import type { AuthGateway } from "src/core-logic/ports/AuthGateway";
import type {
  DeviceRepository,
  LocalStoragePair,
} from "src/core-logic/ports/DeviceRepository";
import type { JwtValidator } from "src/core-logic/ports/JwtDecoder";
import { catchEpicError } from "src/core-logic/storeConfig/catchEpicError";
import type {
  ActionOfSlice,
  AppEpic,
} from "src/core-logic/storeConfig/redux.helpers";
import { type AuthState, authSlice, type RenewJwtPayload } from "./auth.slice";

export type AuthAction = ActionOfSlice<typeof authSlice>;
type AuthEpic = AppEpic<AuthAction>;

const storeRedirectionUrlAfterLoginInDevice: AuthEpic = (
  action$,
  _,
  { sessionDeviceRepository },
) =>
  action$.pipe(
    filter(authSlice.actions.saveRedirectionAfterLoginRequested.match),
    map(({ payload }) => {
      sessionDeviceRepository.set("afterLoginRedirectionUrl", payload.url);
      return authSlice.actions.saveRedirectAfterLoginSucceeded({
        url: payload.url,
      });
    }),
  );

const clearAndRedirectAfterLoginFromDevice: AuthEpic = (
  action$,
  state$,
  { sessionDeviceRepository, navigationGateway },
) =>
  action$.pipe(
    filter(authSlice.actions.redirectAndClearUrlAfterLoginRequested.match),
    tap(() => {
      sessionDeviceRepository.delete("afterLoginRedirectionUrl");
    }),
    map(() => authSlice.actions.redirectAndClearUrlAfterLoginSucceeded()),
    tap(() => {
      if (state$.value.auth.afterLoginRedirectionUrl)
        navigationGateway.goToUrl(state$.value.auth.afterLoginRedirectionUrl);
    }),
  );

const storeFederatedIdentityInDevice: AuthEpic = (
  action$,
  state$,
  { localDeviceRepository },
) =>
  action$.pipe(
    filter(authSlice.actions.federatedIdentityProvided.match),
    tap(() => {
      if (state$.value.auth.federatedIdentity)
        localDeviceRepository.set(
          "federatedIdentity",
          state$.value.auth.federatedIdentity,
        );
      return state$.value.auth.federatedIdentity;
    }),
    map(({ payload }) => {
      if (!payload.federatedIdentity)
        return authSlice.actions.federatedIdentityNotFoundInDevice();
      return authSlice.actions.federatedIdentityFromStoreToDeviceStorageSucceeded(
        {
          federatedIdentity: payload.federatedIdentity,
          feedbackTopic: "auth-global",
        },
      );
    }),
  );

const redirectToProviderLogoutPage: AuthEpic = (
  action$,
  _,
  { navigationGateway },
) =>
  action$.pipe(
    filter(authSlice.actions.federatedIdentityInDeviceDeletionSucceeded.match),
    tap((action) => {
      if (action.payload) {
        navigationGateway.goToUrl(action.payload);
      }
    }),
    map(() => authSlice.actions.redirectAfterLogoutSucceeded()),
  );

const removeFederatedIdentityFromDevice = ({
  localDeviceRepository,
}: {
  localDeviceRepository: DeviceRepository<LocalStoragePair>;
}) => {
  localDeviceRepository.delete("federatedIdentity");
  localDeviceRepository.delete("conventionDraftId");
};

const deleteFederatedIdentityFromDevice: AuthEpic = (
  action$,
  _,
  { localDeviceRepository },
) =>
  action$.pipe(
    filter(authSlice.actions.fetchLogoutUrlSucceeded.match),
    tap(() => removeFederatedIdentityFromDevice({ localDeviceRepository })),
    map((action) =>
      authSlice.actions.federatedIdentityInDeviceDeletionSucceeded(
        action.payload.url,
      ),
    ),
  );

const getLogoutUrl$ = (
  action: PayloadAction<{
    mode: "device-only" | "device-and-oauth";
  }>,
  authState: AuthState,
  authGateway: AuthGateway,
): Observable<AbsoluteUrl | undefined> => {
  const { federatedIdentity } = authState;
  if (!federatedIdentity) return throwError(() => errors.auth.missingOAuth({}));
  if (federatedIdentity.provider !== "proConnect")
    return throwError(() =>
      errors.auth.unsupportedProvider({ actual: federatedIdentity.provider }),
    );
  return action.payload.mode === "device-and-oauth"
    ? authGateway.getLogoutUrl$({
        jwt: federatedIdentity.token,
      })
    : of(undefined);
};

const logoutEpic: AuthEpic = (
  action$,
  state$,
  { authGateway, localDeviceRepository },
) =>
  action$.pipe(
    filter(authSlice.actions.fetchLogoutUrlRequested.match),
    switchMap((action) =>
      getLogoutUrl$(action, state$.value.auth, authGateway).pipe(
        map((logoutUrl) => {
          return authSlice.actions.fetchLogoutUrlSucceeded({
            url: logoutUrl,
            feedbackTopic: action.payload.feedbackTopic,
          });
        }),
        catchEpicError((_error) => {
          removeFederatedIdentityFromDevice({ localDeviceRepository });
          return authSlice.actions.fetchLogoutUrlFailed({
            feedbackTopic: action.payload.feedbackTopic,
          });
        }),
      ),
    ),
  );

const checkConnectedWithFederatedIdentity: AuthEpic = (
  action$,
  _,
  { localDeviceRepository },
) =>
  action$.pipe(
    filter(rootAppSlice.actions.appIsReady.match),
    map(() => {
      const federatedIdentity = localDeviceRepository.get("federatedIdentity");
      return federatedIdentity
        ? authSlice.actions.federatedIdentityFoundInDevice({
            federatedIdentity: federatedIdentity,
            feedbackTopic: "auth-global",
          })
        : authSlice.actions.federatedIdentityNotFoundInDevice();
    }),
  );

const checkRedirectionAfterLogin: AuthEpic = (
  action$,
  _,
  { sessionDeviceRepository },
) =>
  action$.pipe(
    filter(rootAppSlice.actions.appIsReady.match),
    map(() => {
      const afterLoginRedirectionUrl = sessionDeviceRepository.get(
        "afterLoginRedirectionUrl",
      );
      return afterLoginRedirectionUrl
        ? authSlice.actions.redirectionAfterLoginFoundInDevice({
            url: afterLoginRedirectionUrl,
          })
        : authSlice.actions.redirectionAfterLoginNotFoundInDevice();
    }),
  );

const requestLoginByEmail: AuthEpic = (action$, _, { authGateway }) =>
  action$.pipe(
    filter(authSlice.actions.loginByEmailRequested.match),
    switchMap((action) =>
      authGateway
        .loginByEmail$({
          email: action.payload.email,
          redirectUri: action.payload.redirectUri,
        })
        .pipe(
          map(() =>
            authSlice.actions.loginByEmailSucceded({
              feedbackTopic: action.payload.feedbackTopic,
            }),
          ),
          catchEpicError((error) =>
            authSlice.actions.loginByEmailFailed({
              errorMessage: error.message,
              feedbackTopic: action.payload.feedbackTopic,
            }),
          ),
        ),
    ),
  );

const requestRenewExpiredJwt: AuthEpic = (
  action$,
  _,
  { authGateway, jwtValidator },
) =>
  action$.pipe(
    filter(authSlice.actions.renewExpiredJwtRequested.match),
    switchMap((action) =>
      defer(() =>
        authGateway.renewExpiredJwt$(
          makeExpiredJwtParams(jwtValidator, action.payload),
        ),
      ).pipe(
        map(() =>
          authSlice.actions.renewExpiredJwtSucceded({
            feedbackTopic: action.payload.feedbackTopic,
          }),
        ),
        catchEpicError((error) =>
          authSlice.actions.renewExpiredJwtFailed({
            errorMessage: error.message,
            feedbackTopic: action.payload.feedbackTopic,
          }),
        ),
      ),
    ),
  );

const confirmLoginByMagicLink: AuthEpic = (
  action$,
  _,
  { authGateway, navigationGateway },
) =>
  action$.pipe(
    filter(authSlice.actions.confirmLoginByMagicLinkRequested.match),
    switchMap((action) =>
      authGateway
        .confirmLoginByMagicLink$({
          code: action.payload.code,
          state: action.payload.state,
        })
        .pipe(
          map((response) => {
            const { redirectUri } = response;
            navigationGateway.goToUrl(redirectUri);
            return authSlice.actions.confirmLoginByMagicLinkSucceeded({
              ...response,
              feedbackTopic: action.payload.feedbackTopic,
            });
          }),
          catchEpicError((error) =>
            authSlice.actions.confirmLoginByMagicLinkFailed({
              errorMessage: error.message,
              feedbackTopic: action.payload.feedbackTopic,
            }),
          ),
        ),
    ),
  );

export const authEpics = [
  storeFederatedIdentityInDevice,
  checkConnectedWithFederatedIdentity,
  logoutEpic,
  deleteFederatedIdentityFromDevice,
  storeRedirectionUrlAfterLoginInDevice,
  clearAndRedirectAfterLoginFromDevice,
  checkRedirectionAfterLogin,
  requestLoginByEmail,
  requestRenewExpiredJwt,
  confirmLoginByMagicLink,
  redirectToProviderLogoutPage,
];

const makeExpiredJwtParams = (
  jwtValidator: JwtValidator,
  { expiredJwt, originalUrl, shortLinkId, state }: RenewJwtPayload,
): RenewExpiredJwtRequestDto => {
  if (shortLinkId)
    return {
      kind: "conventionFromShortLink",
      shortLinkId,
      expiredJwt: expiredJwt as ConventionJwt,
    };

  const jwtPayload = jwtValidator.decodeJwt(expiredJwt);
  if ("userId" in jwtPayload)
    return {
      kind: "connectedUser",
      expiredJwt: expiredJwt as ConnectedUserJwt,
    };

  if ("applicationId" in jwtPayload && originalUrl)
    return {
      kind: "convention",
      expiredJwt: expiredJwt as ConventionJwt,
      originalUrl: originalUrl,
    };

  if ("emailAuthCode" in jwtPayload && state)
    return {
      kind: "emailAuthCode",
      expiredJwt: expiredJwt as EmailAuthCodeJwt,
      state: state,
    };

  throw errors.user.unsupportedJwtPayload();
};
