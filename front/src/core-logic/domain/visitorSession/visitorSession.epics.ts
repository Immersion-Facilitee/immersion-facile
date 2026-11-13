import { filter, map, switchMap } from "rxjs";
import { visitorSessionSlice } from "src/core-logic/domain/visitorSession/visitorSession.slice";
import { catchEpicError } from "src/core-logic/storeConfig/catchEpicError";
import type {
  ActionOfSlice,
  AppEpic,
} from "src/core-logic/storeConfig/redux.helpers";

export type VisitorSessionAction = ActionOfSlice<typeof visitorSessionSlice>;

type VisitorSessionEpic = AppEpic<VisitorSessionAction>;

const getVisitorSessionEpic: VisitorSessionEpic = (
  action$,
  _,
  { otpChallengeGateway },
) =>
  action$.pipe(
    filter(visitorSessionSlice.actions.visitorSessionRequested.match),
    switchMap((action) =>
      otpChallengeGateway.getVisitorSession$(action.payload).pipe(
        map((activeSession) =>
          visitorSessionSlice.actions.visitorSessionSucceeded(activeSession),
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
