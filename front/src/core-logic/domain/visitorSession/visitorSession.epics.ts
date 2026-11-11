import { filter, map, switchMap } from "rxjs";
import { visitorSessionSlice } from "src/core-logic/domain/visitorSession/visitorSession.slice";
import { catchEpicError } from "src/core-logic/storeConfig/catchEpicError";
import type {
  ActionOfSlice,
  AppEpic,
} from "src/core-logic/storeConfig/redux.helpers";

export type VisitorSessionAction = ActionOfSlice<typeof visitorSessionSlice>;

const getVisitorSessionEpic: AppEpic<VisitorSessionAction> = (
  action$,
  _,
  { otpChallengeGateway },
) =>
  action$.pipe(
    filter(visitorSessionSlice.actions.visitorSessionRequested.match),
    switchMap((action) =>
      otpChallengeGateway.getVisitorSession$(action.payload).pipe(
        map((result) =>
          visitorSessionSlice.actions.visitorSessionSucceeded(result),
        ),
        catchEpicError((error) =>
          visitorSessionSlice.actions.visitorSessionFailed({
            errorMessage: error.message,
            feedbackTopic: action.payload.feedbackTopic,
          }),
        ),
      ),
    ),
  );

export const visitorSessionEpics = [getVisitorSessionEpic];
