import { filter, map, switchMap } from "rxjs";
import { getConnectedUserJwt } from "src/core-logic/domain/admin/admin.helpers";
import { catchEpicError } from "src/core-logic/storeConfig/catchEpicError";
import type {
  ActionOfSlice,
  AppEpic,
} from "src/core-logic/storeConfig/redux.helpers";
import { archivedConventionRequestSlice } from "./archivedConventionRequest.slice";

type ArchivedConventionRequestAction = ActionOfSlice<
  typeof archivedConventionRequestSlice
>;
type ArchivedConventionRequestEpic = AppEpic<ArchivedConventionRequestAction>;

const saveArchivedConventionRequestEpic: ArchivedConventionRequestEpic = (
  action$,
  _state$,
  { conventionGateway },
) =>
  action$.pipe(
    filter(
      archivedConventionRequestSlice.actions
        .saveArchivedConventionRequestRequested.match,
    ),
    switchMap((action) =>
      conventionGateway
        .saveArchivedConventionRequest$(
          action.payload.archivedConventionRequest,
          action.payload.jwt,
        )
        .pipe(
          map(() =>
            archivedConventionRequestSlice.actions.saveArchivedConventionRequestSucceeded(
              {
                feedbackTopic: action.payload.feedbackTopic,
              },
            ),
          ),
          catchEpicError((error: Error) =>
            archivedConventionRequestSlice.actions.saveArchivedConventionRequestFailed(
              {
                errorMessage: error.message,
                feedbackTopic: action.payload.feedbackTopic,
              },
            ),
          ),
        ),
    ),
  );

const fetchArchivedConventionRequestToReviewListEpic: ArchivedConventionRequestEpic =
  (action$, state$, { conventionGateway }) =>
    action$.pipe(
      filter(
        (action) =>
          archivedConventionRequestSlice.actions.fetchArchivedConventionRequestToReviewListRequested.match(
            action,
          ) ||
          archivedConventionRequestSlice.actions.handleArchivedConventionRequestTreatedSucceeded.match(
            action,
          ) ||
          archivedConventionRequestSlice.actions.handleArchivedConventionRequestRefusedSucceeded.match(
            action,
          ),
      ),
      switchMap((action) => {
        const isFetchRequested =
          archivedConventionRequestSlice.actions.fetchArchivedConventionRequestToReviewListRequested.match(
            action,
          );
        const jwt = isFetchRequested
          ? action.payload.jwt
          : getConnectedUserJwt(state$.value);
        const feedbackTopic = isFetchRequested
          ? action.payload.feedbackTopic
          : "archived-convention-request-list";

        return conventionGateway
          .fetchArchivedConventionRequestToReviewList$(jwt)
          .pipe(
            map((archivedConventionListToReview) =>
              archivedConventionRequestSlice.actions.fetchArchivedConventionRequestToReviewListSuccedeed(
                {
                  archivedConventionListToReview,
                  feedbackTopic,
                },
              ),
            ),
            catchEpicError((error: Error) =>
              archivedConventionRequestSlice.actions.fetchArchivedConventionRequestToReviewListFailed(
                {
                  errorMessage: error.message,
                  feedbackTopic,
                },
              ),
            ),
          );
      }),
    );

const handleArchivedConventionRequestEpic: ArchivedConventionRequestEpic = (
  action$,
  _state$,
  { conventionGateway },
) =>
  action$.pipe(
    filter(
      archivedConventionRequestSlice.actions
        .handleArchivedConventionRequestRequested.match,
    ),
    switchMap((action) =>
      conventionGateway
        .handleArchivedConventionRequest$(
          {
            archivedConventionRequestId:
              action.payload.archivedConventionRequestId,
            status: action.payload.status,
          },
          action.payload.jwt,
        )
        .pipe(
          map(() =>
            action.payload.status === "TREATED"
              ? archivedConventionRequestSlice.actions.handleArchivedConventionRequestTreatedSucceeded(
                  {
                    feedbackTopic: action.payload.feedbackTopic,
                  },
                )
              : archivedConventionRequestSlice.actions.handleArchivedConventionRequestRefusedSucceeded(
                  {
                    feedbackTopic: action.payload.feedbackTopic,
                  },
                ),
          ),
          catchEpicError((error: Error) =>
            archivedConventionRequestSlice.actions.handleArchivedConventionRequestFailed(
              {
                errorMessage: error.message,
                feedbackTopic: action.payload.feedbackTopic,
              },
            ),
          ),
        ),
    ),
  );

export const archivedConventionRequestEpics = [
  saveArchivedConventionRequestEpic,
  fetchArchivedConventionRequestToReviewListEpic,
  handleArchivedConventionRequestEpic,
];
