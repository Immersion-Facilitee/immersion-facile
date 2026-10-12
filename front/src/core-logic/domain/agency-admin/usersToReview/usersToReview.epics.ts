import { filter, map, switchMap } from "rxjs";
import { errors } from "shared";
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
      dependencies.agencyGateway
        .getAgencyUsers$(getConnectedUserJwt(state$.value), {
          agencyIds: action.payload.agencies.map(({ id }) => id),
          agencyRole: action.payload.agencyRole,
        })
        .pipe(
          map((agencyUsers) => ({
            usersToReview: agencyUsers.flatMap((agencyUser) =>
              agencyUser.agencyRights
                .filter((agencyRight) =>
                  agencyRight.roles.includes("to-review"),
                )
                .map((agencyRight) => {
                  const agency = action.payload.agencies.find(
                    ({ id }) => id === agencyRight.agencyId,
                  );
                  if (!agency)
                    throw errors.agency.notFound({
                      agencyId: agencyRight.agencyId,
                    });

                  return {
                    id: agencyUser.id,
                    email: agencyUser.email,
                    firstName: agencyUser.firstName,
                    lastName: agencyUser.lastName,
                    agency,
                  };
                }),
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
