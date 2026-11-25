import { createSlice } from "@reduxjs/toolkit";
import type {
  ActiveOtpSession,
  MaskedOtpRecipients,
  NotificationKind,
  OtpJwt,
  RequestOtpChallengeDto,
  VerifyOtpChallengeDto,
} from "shared";
import type {
  PayloadActionWithFeedbackTopic,
  PayloadActionWithFeedbackTopicError,
} from "src/core-logic/domain/feedback/feedback.slice";

export type OtpChallengeState = {
  maskedRecipients: MaskedOtpRecipients | null;
  channel: NotificationKind;
  isCodeSent: boolean;
  isLoading: boolean;
};

export const otpChallengeInitialState: OtpChallengeState = {
  maskedRecipients: null,
  channel: "email",
  isCodeSent: false,
  isLoading: false,
};

export const otpChallengeSlice = createSlice({
  name: "otpChallenge",
  initialState: otpChallengeInitialState,
  reducers: {
    maskedOtpRecipientsRequested: (
      state,
      _action: PayloadActionWithFeedbackTopic<{ jwt: OtpJwt }>,
    ) => {
      state.isLoading = true;
    },
    maskedOtpRecipientsSucceeded: (
      state,
      action: PayloadActionWithFeedbackTopic<{
        maskedRecipients: MaskedOtpRecipients;
      }>,
    ) => {
      state.isLoading = false;
      state.maskedRecipients = action.payload.maskedRecipients;
    },
    maskedOtpRecipientsFailed: (
      state,
      _action: PayloadActionWithFeedbackTopicError,
    ) => {
      state.isLoading = false;
    },

    otpChallengeRequested: (
      state,
      action: PayloadActionWithFeedbackTopic<
        RequestOtpChallengeDto & { jwt: OtpJwt }
      >,
    ) => {
      state.isLoading = true;
      state.channel = action.payload.channel;
    },
    otpChallengeSucceeded: (state, _action: PayloadActionWithFeedbackTopic) => {
      state.isLoading = false;
      state.isCodeSent = true;
    },
    otpChallengeFailed: (
      state,
      _action: PayloadActionWithFeedbackTopicError,
    ) => {
      state.isLoading = false;
    },

    otpChallengeVerificationRequested: (
      state,
      _action: PayloadActionWithFeedbackTopic<
        VerifyOtpChallengeDto & { jwt: OtpJwt }
      >,
    ) => {
      state.isLoading = true;
    },
    otpChallengeVerificationSucceeded: (
      state,
      _action: PayloadActionWithFeedbackTopic<{
        activeOtpSession: ActiveOtpSession;
      }>,
    ) => {
      state.isLoading = false;
    },
    otpChallengeVerificationFailed: (
      state,
      _action: PayloadActionWithFeedbackTopicError,
    ) => {
      state.isLoading = false;
    },

    otpChannelChangeRequested: (state) => {
      state.isCodeSent = false;
    },

    resetOtpChallengeRequested: () => otpChallengeInitialState,
  },
});
