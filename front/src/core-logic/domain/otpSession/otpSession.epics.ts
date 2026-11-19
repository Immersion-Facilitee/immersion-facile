import { filter, map, switchMap } from "rxjs";
import { otpSessionSlice } from "src/core-logic/domain/otpSession/otpSession.slice";
import { catchEpicError } from "src/core-logic/storeConfig/catchEpicError";
import type {
  ActionOfSlice,
  AppEpic,
} from "src/core-logic/storeConfig/redux.helpers";

export type OtpSessionAction = ActionOfSlice<typeof otpSessionSlice>;

type OtpSessionEpic = AppEpic<OtpSessionAction>;

const getOtpSessionEpic: OtpSessionEpic = (
  action$,
  _,
  { otpChallengeGateway },
) =>
  action$.pipe(
    filter(otpSessionSlice.actions.otpSessionRequested.match),
    switchMap((action) =>
      otpChallengeGateway.getOtpSession$(action.payload).pipe(
        map((activeSession) =>
          otpSessionSlice.actions.otpSessionSucceeded(activeSession),
        ),
        catchEpicError((error) =>
          otpSessionSlice.actions.otpSessionFailed({
            errorMessage: error.message,
            feedbackTopic: action.payload.feedbackTopic,
          }),
        ),
      ),
    ),
  );

export const otpSessionEpics = [getOtpSessionEpic];
