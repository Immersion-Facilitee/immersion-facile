import { filter, map, switchMap } from "rxjs";
import type { ConnectedUsersAdminAction } from "src/core-logic/domain/admin/connectedUsersAdmin/connectedUsersAdmin.epics";
import { connectedUsersAdminSlice } from "src/core-logic/domain/admin/connectedUsersAdmin/connectedUsersAdmin.slice";
import { fetchUserSlice } from "src/core-logic/domain/admin/fetchUser/fetchUser.slice";
import { removeUserFromAgencySlice } from "src/core-logic/domain/agencies/remove-user-from-agency/removeUserFromAgency.slice";
import { updateUserOnAgencySlice } from "src/core-logic/domain/agencies/update-user-on-agency/updateUserOnAgency.slice";
import type {
  ActionOfSlice,
  AppEpic,
} from "src/core-logic/storeConfig/redux.helpers";
import { getConnectedUserJwt } from "../admin.helpers";

type FetchUserAction = ActionOfSlice<typeof fetchUserSlice>;
type FetchUserEpic = AppEpic<FetchUserAction>;
type UpdateUserOnAgencyAction = ActionOfSlice<typeof updateUserOnAgencySlice>;
type RemoveUserFromAgencyAction = ActionOfSlice<
  typeof removeUserFromAgencySlice
>;

const fetchUserEpic: FetchUserEpic = (action$, state$, { authGateway }) =>
  action$.pipe(
    filter(fetchUserSlice.actions.fetchUserRequested.match),
    switchMap((action) =>
      authGateway.getConnectedUser$({
        jwt: getConnectedUserJwt(state$.value),
        userId: action.payload.userId,
      }),
    ),
    map(fetchUserSlice.actions.fetchUserSucceeded),
  );

const fetchUserOnPreventToDeleteUpdatedEpic: AppEpic<
  FetchUserAction | ConnectedUsersAdminAction
> = (action$, state$) =>
  action$.pipe(
    filter(
      connectedUsersAdminSlice.actions.updateUserPreventToDeleteSucceeded.match,
    ),
    filter(
      (action) =>
        state$.value.admin.fetchUser.user?.id === action.payload.userId,
    ),
    map((action) =>
      fetchUserSlice.actions.fetchUserRequested({
        userId: action.payload.userId,
      }),
    ),
  );

const fetchUserOnUpdateEpic: AppEpic<
  FetchUserAction | UpdateUserOnAgencyAction | RemoveUserFromAgencyAction
> = (action$, state$) =>
  action$.pipe(
    filter(
      (action) =>
        updateUserOnAgencySlice.actions.updateUserAgencyRightSucceeded.match(
          action,
        ) ||
        removeUserFromAgencySlice.actions.removeUserFromAgencySucceeded.match(
          action,
        ),
    ),
    filter(
      (action) =>
        state$.value.admin.fetchUser.user?.id === action.payload.userId,
    ),
    map((action) =>
      fetchUserSlice.actions.fetchUserRequested({
        userId: action.payload.userId,
      }),
    ),
  );

export const fetchUserEpics = [
  fetchUserEpic,
  fetchUserOnPreventToDeleteUpdatedEpic,
  fetchUserOnUpdateEpic,
];
