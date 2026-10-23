import { filter, map, switchMap } from "rxjs";
import { authExpiredBaseMessage } from "shared";
import { removeUserFromAgencySlice } from "src/core-logic/domain/agencies/remove-user-from-agency/removeUserFromAgency.slice";
import { updateUserOnAgencySlice } from "src/core-logic/domain/agencies/update-user-on-agency/updateUserOnAgency.slice";
import type { AuthAction } from "src/core-logic/domain/auth/auth.epics";
import { authSlice } from "src/core-logic/domain/auth/auth.slice";
import { connectedUserSlice } from "src/core-logic/domain/connected-user/connectedUser.slice";
import { establishmentSlice } from "src/core-logic/domain/establishment/establishment.slice";
import { catchEpicError } from "src/core-logic/storeConfig/catchEpicError";
import type {
  ActionOfSlice,
  AppEpic,
} from "src/core-logic/storeConfig/redux.helpers";
import { getConnectedUserJwt } from "../admin/admin.helpers";

type ConnectedUserAction = ActionOfSlice<typeof connectedUserSlice>;
type ConnectedUserEpic = AppEpic<ConnectedUserAction | AuthAction>;

const federatedIdentityFoundInDeviceEpic: ConnectedUserEpic = (action$) =>
  action$.pipe(
    filter(authSlice.actions.federatedIdentityFoundInDevice.match),
    filter(
      (action) =>
        action.payload?.federatedIdentity?.provider === "proConnect" ||
        action.payload?.federatedIdentity?.provider === "email",
    ),
    map((action) =>
      connectedUserSlice.actions.currentUserFetchRequested({
        feedbackTopic: action.payload?.feedbackTopic,
      }),
    ),
  );

const federatedIdentityFromStoreToDeviceStorageSucceededEpic: ConnectedUserEpic =
  (action$) =>
    action$.pipe(
      filter(
        authSlice.actions.federatedIdentityFromStoreToDeviceStorageSucceeded
          .match,
      ),
      filter(
        (action) =>
          action.payload?.federatedIdentity.provider === "proConnect" ||
          action.payload?.federatedIdentity.provider === "email",
      ),
      map((action) =>
        connectedUserSlice.actions.currentUserFetchRequested({
          feedbackTopic: action.payload?.feedbackTopic,
        }),
      ),
    );

const getCurrentUserEpic: ConnectedUserEpic = (
  action$,
  state$,
  { authGateway },
) =>
  action$.pipe(
    filter(
      (action) =>
        connectedUserSlice.actions.currentUserFetchRequested.match(action) ||
        connectedUserSlice.actions.registerAgenciesSucceeded.match(action) ||
        establishmentSlice.actions.updateEstablishmentSucceeded.match(action),
    ),
    switchMap(({ payload }) =>
      authGateway
        .getConnectedUser$({
          jwt: getConnectedUserJwt(state$.value),
        })
        .pipe(
          map(connectedUserSlice.actions.currentUserFetchSucceeded),
          catchEpicError((error) =>
            error?.message.includes(authExpiredBaseMessage)
              ? authSlice.actions.fetchLogoutUrlRequested({
                  mode: "device-only",
                  feedbackTopic: payload.feedbackTopic,
                })
              : connectedUserSlice.actions.currentUserFetchFailed({
                  errorMessage: error?.message,
                  feedbackTopic: payload.feedbackTopic,
                }),
          ),
        ),
    ),
  );

const registerAgenciesEpic: ConnectedUserEpic = (
  action$,
  state$,
  { agencyGateway },
) =>
  action$.pipe(
    filter(connectedUserSlice.actions.registerAgenciesRequested.match),
    switchMap((action) =>
      agencyGateway
        .registerAgenciesToCurrentUser$(
          action.payload.agencies,
          state$.value.auth.federatedIdentity?.token ?? "",
        )
        .pipe(
          map(() =>
            connectedUserSlice.actions.registerAgenciesSucceeded({
              feedbackTopic: action.payload.feedbackTopic,
              agencies: action.payload.agencies,
            }),
          ),
          catchEpicError((error) =>
            connectedUserSlice.actions.registerAgenciesFailed({
              feedbackTopic: action.payload.feedbackTopic,
              errorMessage: error?.message,
            }),
          ),
        ),
    ),
  );

const fetchCurrentUserOnAgencyRightUpdatedEpic: ConnectedUserEpic = (
  action$,
  state$,
) =>
  action$.pipe(
    filter(
      updateUserOnAgencySlice.actions.updateUserAgencyRightSucceeded.match,
    ),
    filter(
      (action) =>
        state$.value.connectedUser.currentUser?.id === action.payload.userId,
    ),
    map((action) =>
      connectedUserSlice.actions.currentUserFetchRequested({
        feedbackTopic: action.payload.feedbackTopic,
      }),
    ),
  );

const fetchCurrentUserOnRemovedFromAgencyEpic: ConnectedUserEpic = (
  action$,
  state$,
) =>
  action$.pipe(
    filter(
      removeUserFromAgencySlice.actions.removeUserFromAgencySucceeded.match,
    ),
    filter(
      (action) =>
        state$.value.connectedUser.currentUser?.id === action.payload.userId,
    ),
    map((action) =>
      connectedUserSlice.actions.currentUserFetchRequested({
        feedbackTopic: action.payload.feedbackTopic,
      }),
    ),
  );

export const connectedUserEpics = [
  getCurrentUserEpic,
  registerAgenciesEpic,
  federatedIdentityFoundInDeviceEpic,
  federatedIdentityFromStoreToDeviceStorageSucceededEpic,
  fetchCurrentUserOnAgencyRightUpdatedEpic,
  fetchCurrentUserOnRemovedFromAgencyEpic,
];
