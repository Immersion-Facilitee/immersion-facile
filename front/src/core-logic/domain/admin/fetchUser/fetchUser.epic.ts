import { filter, map, switchMap } from "rxjs";
import type { ConnectedUsersAdminAction } from "src/core-logic/domain/admin/connectedUsersAdmin/connectedUsersAdmin.epics";
import { connectedUsersAdminSlice } from "src/core-logic/domain/admin/connectedUsersAdmin/connectedUsersAdmin.slice";
import { fetchUserSlice } from "src/core-logic/domain/admin/fetchUser/fetchUser.slice";
import type {
  ActionOfSlice,
  AppEpic,
} from "src/core-logic/storeConfig/redux.helpers";
import { getConnectedUserJwt } from "../admin.helpers";

type FetchUserAction = ActionOfSlice<typeof fetchUserSlice>;
type FetchUserEpic = AppEpic<FetchUserAction>;

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

export const fetchUserEpics = [
  fetchUserEpic,
  fetchUserOnPreventToDeleteUpdatedEpic,
];
