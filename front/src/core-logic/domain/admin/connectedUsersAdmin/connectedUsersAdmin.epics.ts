import type { PayloadAction } from "@reduxjs/toolkit";
import { filter } from "rxjs";
import { map, switchMap } from "rxjs/operators";
import type {
  AgencyId,
  AgencyRight,
  ConnectedUser,
  RejectConnectedUserRoleForAgencyParams,
  UserParamsForAgency,
  WithUserFilters,
} from "shared";
import { getConnectedUserJwt } from "src/core-logic/domain/admin/admin.helpers";
import { removeUserFromAgencySlice } from "src/core-logic/domain/agencies/remove-user-from-agency/removeUserFromAgency.slice";
import { catchEpicError } from "src/core-logic/storeConfig/catchEpicError";
import type {
  ActionOfSlice,
  AppEpic,
} from "src/core-logic/storeConfig/redux.helpers";
import {
  type ConnectedUsersWithNormalizedAgencyRightsById,
  connectedUsersAdminSlice,
} from "./connectedUsersAdmin.slice";

export type ConnectedUsersAdminAction = ActionOfSlice<
  typeof connectedUsersAdminSlice
>;
type RemoveUserFromAgencyAction = ActionOfSlice<
  typeof removeUserFromAgencySlice
>;
type ConnectedUsersAdminActionEpic = AppEpic<ConnectedUsersAdminAction>;

const fetchConnectedUsersWithAgencyNeedingReviewEpic: ConnectedUsersAdminActionEpic =
  (action$, state$, { authGateway }) =>
    action$.pipe(
      filter(
        connectedUsersAdminSlice.actions.fetchConnectedUsersToReviewRequested
          .match,
      ),
      switchMap((action: PayloadAction<WithUserFilters>) =>
        authGateway.getConnectedUsers$(
          getConnectedUserJwt(state$.value),
          action.payload,
        ),
      ),
      map(normalizeUsers),
      map(
        connectedUsersAdminSlice.actions.fetchConnectedUsersToReviewSucceeded,
      ),
      catchEpicError((error) =>
        connectedUsersAdminSlice.actions.fetchConnectedUsersToReviewFailed(
          error?.message,
        ),
      ),
    );

const fetchConnectedUsersWithAgencyIdEpic: ConnectedUsersAdminActionEpic = (
  action$,
  state$,
  { authGateway },
) =>
  action$.pipe(
    filter(connectedUsersAdminSlice.actions.fetchAgencyUsersRequested.match),
    switchMap((action: PayloadAction<WithUserFilters>) =>
      authGateway.getConnectedUsers$(
        getConnectedUserJwt(state$.value),
        action.payload,
      ),
    ),
    map(normalizeUsers),
    map(connectedUsersAdminSlice.actions.fetchAgencyUsersSucceeded),
    catchEpicError((error) =>
      connectedUsersAdminSlice.actions.fetchAgencyUsersFailed(error?.message),
    ),
  );

const registerAgencyToUserEpic: ConnectedUsersAdminActionEpic = (
  action$,
  state$,
  { adminGateway },
) =>
  action$.pipe(
    filter(
      connectedUsersAdminSlice.actions.registerAgencyWithRoleToUserRequested
        .match,
    ),
    switchMap((action: PayloadAction<UserParamsForAgency>) =>
      adminGateway
        .updateUserRoleForAgency$(
          action.payload,
          getConnectedUserJwt(state$.value),
        )
        .pipe(
          map(() =>
            connectedUsersAdminSlice.actions.registerAgencyWithRoleToUserSucceeded(
              action.payload,
            ),
          ),
        ),
    ),
    catchEpicError((error) =>
      connectedUsersAdminSlice.actions.registerAgencyWithRoleToUserFailed(
        error?.message,
      ),
    ),
  );

const rejectAgencyToUserEpic: ConnectedUsersAdminActionEpic = (
  action$,
  state$,
  { adminGateway },
) =>
  action$.pipe(
    filter(
      connectedUsersAdminSlice.actions.rejectAgencyWithRoleToUserRequested
        .match,
    ),
    switchMap((action: PayloadAction<RejectConnectedUserRoleForAgencyParams>) =>
      adminGateway
        .rejectUserForAgency$(action.payload, getConnectedUserJwt(state$.value))
        .pipe(
          map(() =>
            connectedUsersAdminSlice.actions.rejectAgencyWithRoleToUserSucceeded(
              action.payload,
            ),
          ),
        ),
    ),
    catchEpicError((error) =>
      connectedUsersAdminSlice.actions.rejectAgencyWithRoleToUserFailed(
        error?.message,
      ),
    ),
  );

const createUserOnAgencyEpic: ConnectedUsersAdminActionEpic = (
  action$,
  state$,
  { adminGateway },
) =>
  action$.pipe(
    filter(connectedUsersAdminSlice.actions.createUserOnAgencyRequested.match),
    switchMap((action) =>
      adminGateway
        .createUserForAgency$(action.payload, getConnectedUserJwt(state$.value))
        .pipe(
          map((user) =>
            connectedUsersAdminSlice.actions.createUserOnAgencySucceeded({
              icUser: {
                ...user,
                agencyRights: user.agencyRights.reduce(
                  (agenciesAcc, agencyRight) => ({
                    ...agenciesAcc,
                    [agencyRight.agency.id]: agencyRight,
                  }),
                  {} as Record<AgencyId, AgencyRight>,
                ),
              },
              agencyId: action.payload.agencyId,
              feedbackTopic: action.payload.feedbackTopic,
            }),
          ),
          catchEpicError((error) =>
            connectedUsersAdminSlice.actions.createUserOnAgencyFailed({
              errorMessage: error.message,
              feedbackTopic: action.payload.feedbackTopic,
            }),
          ),
        ),
    ),
  );

const updateUserOnAgencyEpic: ConnectedUsersAdminActionEpic = (
  action$,
  state$,
  { adminGateway },
) =>
  action$.pipe(
    filter(connectedUsersAdminSlice.actions.updateUserOnAgencyRequested.match),
    switchMap((action) =>
      adminGateway
        .updateUserRoleForAgency$(
          action.payload,
          getConnectedUserJwt(state$.value),
        )
        .pipe(
          map(() =>
            connectedUsersAdminSlice.actions.updateUserOnAgencySucceeded(
              action.payload,
            ),
          ),
          catchEpicError((error) =>
            connectedUsersAdminSlice.actions.updateUserOnAgencyFailed({
              errorMessage: error.message,
              feedbackTopic: action.payload.feedbackTopic,
            }),
          ),
        ),
    ),
  );

const fetchAgencyUsersOnUserRemovedEpic: AppEpic<
  ConnectedUsersAdminAction | RemoveUserFromAgencyAction
> = (action$) =>
  action$.pipe(
    filter(
      removeUserFromAgencySlice.actions.removeUserFromAgencySucceeded.match,
    ),
    filter((action) => action.payload.feedbackTopic === "agency-user"),
    map((action) =>
      connectedUsersAdminSlice.actions.fetchAgencyUsersRequested({
        agencyId: action.payload.agencyId,
      }),
    ),
  );

export const normalizeUsers = (
  users: ConnectedUser[],
): ConnectedUsersWithNormalizedAgencyRightsById =>
  users.reduce(
    (acc, user) => ({
      ...acc,
      [user.id]: {
        ...user,
        agencyRights: user.agencyRights.reduce(
          (agenciesAcc, agencyRight) => ({
            ...agenciesAcc,
            [agencyRight.agency.id]: agencyRight,
          }),
          {} as Record<AgencyId, AgencyRight>,
        ),
      },
    }),
    {} as ConnectedUsersWithNormalizedAgencyRightsById,
  );

export const connectedUsersAdminEpics = [
  fetchConnectedUsersWithAgencyNeedingReviewEpic,
  registerAgencyToUserEpic,
  rejectAgencyToUserEpic,
  fetchConnectedUsersWithAgencyIdEpic,
  updateUserOnAgencyEpic,
  fetchAgencyUsersOnUserRemovedEpic,
  createUserOnAgencyEpic,
];
