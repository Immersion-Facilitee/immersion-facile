import { filter, map, switchMap } from "rxjs";
import { getConnectedUserJwt } from "src/core-logic/domain/admin/admin.helpers";
import { usersToReviewSlice } from "src/core-logic/domain/agency-admin/usersToReview/usersToReview.slice";
import { catchEpicError } from "src/core-logic/storeConfig/catchEpicError";
import type {
  ActionOfSlice,
  AppEpic,
} from "src/core-logic/storeConfig/redux.helpers";

export type UsersInReviewAction = ActionOfSlice<typeof usersToReviewSlice>;
type UsersInReviewEpic = AppEpic<UsersInReviewAction>;

const getUsersInReviewEpic: UsersInReviewEpic = (
  action$,
  state$,
  dependencies,
) =>
  action$.pipe(
    filter(usersToReviewSlice.actions.fetchUsersToReviewRequested.match),
    switchMap((action) =>
      dependencies.authGateway
        .getConnectedUsers$(getConnectedUserJwt(state$.value), action.payload)
        .pipe(
          map((connectedUsers) => ({
            usersToReview: connectedUsers.flatMap((connectedUser) =>
              connectedUser.agencyRights
                .filter((agencyRight) =>
                  agencyRight.roles.includes("to-review"),
                )
                .map((agencyRight) => ({
                  id: connectedUser.id,
                  email: connectedUser.email,
                  firstName: connectedUser.firstName,
                  lastName: connectedUser.lastName,
                  agency: agencyRight.agency,
                })),
            ),
            feedbackTopic: action.payload.feedbackTopic,
          })),
          map(usersToReviewSlice.actions.fetchUsersToReviewSucceeded),
          catchEpicError((error) =>
            usersToReviewSlice.actions.fetchUsersToReviewFailed({
              errorMessage: error?.message,
              feedbackTopic: action.payload.feedbackTopic,
            }),
          ),
        ),
    ),
  );

export const usersInReviewEpics = [getUsersInReviewEpic];
