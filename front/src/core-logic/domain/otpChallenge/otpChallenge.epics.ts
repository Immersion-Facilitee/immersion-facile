import { filter, map, switchMap } from "rxjs";
import { otpChallengeSlice } from "src/core-logic/domain/otpChallenge/otpChallenge.slice";
import { catchEpicError } from "src/core-logic/storeConfig/catchEpicError";
import type {
  ActionOfSlice,
  AppEpic,
} from "src/core-logic/storeConfig/redux.helpers";

export type OtpChallengeAction = ActionOfSlice<typeof otpChallengeSlice>;

type OtpChallengeEpic = AppEpic<OtpChallengeAction>;

const getMaskedOtpRecipientsEpic: OtpChallengeEpic = (
  action$,
  _,
  { otpChallengeGateway },
) =>
  action$.pipe(
    filter(otpChallengeSlice.actions.maskedOtpRecipientsRequested.match),
    switchMap((action) =>
      otpChallengeGateway.getMaskedOtpRecipient$(action.payload.jwt).pipe(
        map((maskedRecipients) =>
          otpChallengeSlice.actions.maskedOtpRecipientsSucceeded({
            maskedRecipients,
            feedbackTopic: action.payload.feedbackTopic,
          }),
        ),
        catchEpicError((error) =>
          otpChallengeSlice.actions.maskedOtpRecipientsFailed({
            errorMessage: error.message,
            feedbackTopic: action.payload.feedbackTopic,
          }),
        ),
      ),
    ),
  );

const requestOtpChallengeEpic: OtpChallengeEpic = (
  action$,
  _,
  { otpChallengeGateway },
) =>
  action$.pipe(
    filter(otpChallengeSlice.actions.otpChallengeRequested.match),
    switchMap((action) =>
      otpChallengeGateway
        .requestOtpChallenge$(
          { channel: action.payload.channel },
          action.payload.jwt,
        )
        .pipe(
          map(() =>
            otpChallengeSlice.actions.otpChallengeSucceeded({
              feedbackTopic: action.payload.feedbackTopic,
            }),
          ),
          catchEpicError((error) =>
            otpChallengeSlice.actions.otpChallengeFailed({
              errorMessage: error.message,
              feedbackTopic: action.payload.feedbackTopic,
            }),
          ),
        ),
    ),
  );

const verifyOtpChallengeEpic: OtpChallengeEpic = (
  action$,
  _,
  { otpChallengeGateway },
) =>
  action$.pipe(
    filter(otpChallengeSlice.actions.otpChallengeVerificationRequested.match),
    switchMap((action) =>
      otpChallengeGateway
        .verifyOtpChallenge$(
          { otpCode: action.payload.otpCode },
          action.payload.jwt,
        )
        .pipe(
          map(() =>
            otpChallengeSlice.actions.otpChallengeVerificationSucceeded({
              feedbackTopic: action.payload.feedbackTopic,
            }),
          ),
          catchEpicError((error) =>
            otpChallengeSlice.actions.otpChallengeVerificationFailed({
              errorMessage: error.message,
              feedbackTopic: action.payload.feedbackTopic,
            }),
          ),
        ),
    ),
  );

export const otpChallengeEpics = [
  getMaskedOtpRecipientsEpic,
  requestOtpChallengeEpic,
  verifyOtpChallengeEpic,
];
