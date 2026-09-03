import { filter, map, switchMap } from "rxjs";
import { catchEpicError } from "src/core-logic/storeConfig/catchEpicError";
import type {
  ActionOfSlice,
  AppEpic,
} from "src/core-logic/storeConfig/redux.helpers";
import { partnersErroredConventionSlice } from "./partnersErroredConvention.slice";

type PartnersErroredConvention = ActionOfSlice<
  typeof partnersErroredConventionSlice
>;

type PartnersErroredConventionEpic = AppEpic<PartnersErroredConvention>;

const markPartnersErroredConventionAsHandledEpic: PartnersErroredConventionEpic =
  (action$, _, { conventionGateway }) =>
    action$.pipe(
      filter(
        partnersErroredConventionSlice.actions.markAsHandledRequested.match,
      ),
      switchMap(({ payload }) =>
        conventionGateway
          .markPartnersErroredConventionAsHandled$(
            payload.markAsHandledParams,
            payload.jwt,
          )
          .pipe(
            map(() =>
              partnersErroredConventionSlice.actions.markAsHandledSucceeded({
                feedbackTopic: "partner-conventions",
              }),
            ),
          ),
      ),
      catchEpicError((error: Error) =>
        partnersErroredConventionSlice.actions.markAsHandledFailed({
          feedbackTopic: "partner-conventions",
          errorMessage: error.message,
        }),
      ),
    );

const fetchConventionLastBroadcastFeedbackEpic: PartnersErroredConventionEpic =
  (action$, _, { conventionGateway }) =>
    action$.pipe(
      filter(
        partnersErroredConventionSlice.actions
          .fetchConventionLastBroadcastFeedbackRequested.match,
      ),
      switchMap(({ payload }) =>
        conventionGateway
          .getConventionLastBroadcastFeedback$(
            payload.conventionId,
            payload.jwt,
          )
          .pipe(
            map(({ lastBroadcastFeedback }) =>
              partnersErroredConventionSlice.actions.fetchConventionLastBroadcastFeedbackSucceeded(
                {
                  lastBroadcastFeedback,
                },
              ),
            ),
            catchEpicError((error: Error) =>
              partnersErroredConventionSlice.actions.fetchConventionLastBroadcastFeedbackFailed(
                {
                  errorMessage: error.message,
                },
              ),
            ),
          ),
      ),
    );

export const partnersErroredConventionEpics = [
  markPartnersErroredConventionAsHandledEpic,
  fetchConventionLastBroadcastFeedbackEpic,
];
