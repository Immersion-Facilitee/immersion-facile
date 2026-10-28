import type { PayloadAction } from "@reduxjs/toolkit";
import { EMPTY, filter, mergeMap } from "rxjs";
import { map, switchMap } from "rxjs/operators";
import type {
  AgencyUserForListing,
  AgencyUsersForListingById,
  RejectConnectedUserRoleForAgencyParams,
  UserParamsForAgency,
  WithUserFilters,
} from "shared";
import { getConnectedUserJwt } from "src/core-logic/domain/admin/admin.helpers";
import { removeUserFromAgencySlice } from "src/core-logic/domain/agencies/remove-user-from-agency/removeUserFromAgency.slice";
import type { PayloadActionWithFeedbackTopic } from "src/core-logic/domain/feedback/feedback.slice";
import { catchEpicError } from "src/core-logic/storeConfig/catchEpicError";
import type {
  ActionOfSlice,
  AppEpic,
} from "src/core-logic/storeConfig/redux.helpers";
import { connectedUsersAdminSlice } from "./connectedUsersAdmin.slice";

export type ConnectedUsersAdminAction = ActionOfSlice<
  typeof connectedUsersAdminSlice
>;
type RemoveUserFromAgencyAction = ActionOfSlice<
  typeof removeUserFromAgencySlice
>;
type ConnectedUsersAdminActionEpic = AppEpic<ConnectedUsersAdminAction>;

const fetchConnectedUsersWithAgencyNeedingReviewEpic: ConnectedUsersAdminActionEpic =
  (action$, state$, { adminGateway }) =>
    action$.pipe(
      filter(
        connectedUsersAdminSlice.actions.fetchConnectedUsersToReviewRequested
          .match,
      ),
      switchMap((action: PayloadAction<WithUserFilters>) =>
        adminGateway.getConnectedUsers$(
          getConnectedUserJwt(state$.value),
          action.payload,
        ),
      ),
      map(toAgencyUsersForListingById),
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
  { adminGateway },
) =>
  action$.pipe(
    filter(connectedUsersAdminSlice.actions.fetchAgencyUsersRequested.match),
    switchMap((action: PayloadAction<WithUserFilters>) =>
      adminGateway.getConnectedUsers$(
        getConnectedUserJwt(state$.value),
        action.payload,
      ),
    ),
    map(toAgencyUsersForListingById),
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
    switchMap((action: PayloadActionWithFeedbackTopic<UserParamsForAgency>) =>
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
          catchEpicError((error) =>
            connectedUsersAdminSlice.actions.registerAgencyWithRoleToUserFailed(
              {
                errorMessage: error.message,
                feedbackTopic: action.payload.feedbackTopic,
              },
            ),
          ),
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
    switchMap(
      (
        action: PayloadActionWithFeedbackTopic<RejectConnectedUserRoleForAgencyParams>,
      ) =>
        adminGateway
          .rejectUserForAgency$(
            action.payload,
            getConnectedUserJwt(state$.value),
          )
          .pipe(
            map(() =>
              connectedUsersAdminSlice.actions.rejectAgencyWithRoleToUserSucceeded(
                action.payload,
              ),
            ),
            catchEpicError((error) =>
              connectedUsersAdminSlice.actions.rejectAgencyWithRoleToUserFailed(
                {
                  errorMessage: error.message,
                  feedbackTopic: action.payload.feedbackTopic,
                },
              ),
            ),
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
          map(() =>
            connectedUsersAdminSlice.actions.createUserOnAgencySucceeded({
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

const refetchUsersToReviewOnRegistrationDecisionEpic: ConnectedUsersAdminActionEpic =
  (action$, state$) =>
    action$.pipe(
      filter(
        (action) =>
          connectedUsersAdminSlice.actions.registerAgencyWithRoleToUserSucceeded.match(
            action,
          ) ||
          connectedUsersAdminSlice.actions.rejectAgencyWithRoleToUserSucceeded.match(
            action,
          ),
      ),
      mergeMap(() => {
        const { usersToReviewFilters } = state$.value.admin.connectedUsersAdmin;
        if (!usersToReviewFilters) return EMPTY;
        return [
          connectedUsersAdminSlice.actions.fetchConnectedUsersToReviewRequested(
            usersToReviewFilters,
          ),
        ];
      }),
    );

const refetchAgencyUsersOnMutationEpic: AppEpic<
  ConnectedUsersAdminAction | RemoveUserFromAgencyAction
> = (action$, state$) =>
  action$.pipe(
    filter(
      (action) =>
        removeUserFromAgencySlice.actions.removeUserFromAgencySucceeded.match(
          action,
        ) ||
        connectedUsersAdminSlice.actions.createUserOnAgencySucceeded.match(
          action,
        ) ||
        connectedUsersAdminSlice.actions.updateUserOnAgencySucceeded.match(
          action,
        ),
    ),
    mergeMap((action) => {
      const { agencyUsersFilters } = state$.value.admin.connectedUsersAdmin;
      const filters: WithUserFilters = agencyUsersFilters ?? {
        agencyIds: [action.payload.agencyId],
      };

      if (
        removeUserFromAgencySlice.actions.removeUserFromAgencySucceeded.match(
          action,
        ) &&
        action.payload.feedbackTopic !== "agency-user"
      )
        return EMPTY;

      return [
        connectedUsersAdminSlice.actions.fetchAgencyUsersRequested(filters),
      ];
    }),
  );

const updateUserPreventToDeleteEpic: ConnectedUsersAdminActionEpic = (
  action$,
  state$,
  { adminGateway },
) =>
  action$.pipe(
    filter(
      connectedUsersAdminSlice.actions.updateUserPreventToDeleteRequested.match,
    ),
    switchMap((action) =>
      adminGateway
        .updateUserPreventToDelete$(
          {
            userId: action.payload.userId,
            preventToDelete: action.payload.preventToDelete,
          },
          getConnectedUserJwt(state$.value),
        )
        .pipe(
          map(() =>
            connectedUsersAdminSlice.actions.updateUserPreventToDeleteSucceeded(
              action.payload,
            ),
          ),
          catchEpicError((error) =>
            connectedUsersAdminSlice.actions.updateUserPreventToDeleteFailed({
              errorMessage: error.message,
              feedbackTopic: action.payload.feedbackTopic,
            }),
          ),
        ),
    ),
  );

const toAgencyUsersForListingById = (
  users: AgencyUserForListing[],
): AgencyUsersForListingById =>
  users.reduce(
    (acc, user) => ({
      ...acc,
      [user.id]: user,
    }),
    {},
  );

export const connectedUsersAdminEpics = [
  fetchConnectedUsersWithAgencyNeedingReviewEpic,
  registerAgencyToUserEpic,
  rejectAgencyToUserEpic,
  fetchConnectedUsersWithAgencyIdEpic,
  updateUserOnAgencyEpic,
  refetchUsersToReviewOnRegistrationDecisionEpic,
  refetchAgencyUsersOnMutationEpic,
  createUserOnAgencyEpic,
  updateUserPreventToDeleteEpic,
];
