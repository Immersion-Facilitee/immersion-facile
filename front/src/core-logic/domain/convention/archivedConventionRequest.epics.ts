import { filter, map, switchMap } from "rxjs";
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
  (action$, _state$, { conventionGateway }) =>
    action$.pipe(
      filter(
        archivedConventionRequestSlice.actions
          .fetchArchivedConventionRequestToReviewListRequested.match,
      ),
      switchMap((action) =>
        conventionGateway
          .fetchArchivedConventionRequestToReviewList$(action.payload.jwt)
          .pipe(
            map((archivedConventionListToReview) =>
              archivedConventionRequestSlice.actions.fetchArchivedConventionRequestToReviewListSuccedeed(
                {
                  archivedConventionListToReview,
                  feedbackTopic: action.payload.feedbackTopic,
                },
              ),
            ),
            catchEpicError((error: Error) =>
              archivedConventionRequestSlice.actions.fetchArchivedConventionRequestToReviewListFailed(
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
];
