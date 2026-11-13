import { createSlice } from "@reduxjs/toolkit";
import type {
  ActiveVisitorSession,
  MaskedOtpRecipients,
  RequestOtpChallengeDto,
  VerifyOtpChallengeDto,
  VisitorOtpJwt,
} from "shared";
import type {
  PayloadActionWithFeedbackTopic,
  PayloadActionWithFeedbackTopicError,
} from "src/core-logic/domain/feedback/feedback.slice";

export type OtpChallengeState = {
  maskedRecipients: MaskedOtpRecipients | null;
  isCodeSent: boolean;
  isLoading: boolean;
};

export const otpChallengeInitialState: OtpChallengeState = {
  maskedRecipients: null,
  isCodeSent: false,
  isLoading: false,
};

export const otpChallengeSlice = createSlice({
  name: "otpChallenge",
  initialState: otpChallengeInitialState,
  reducers: {
    maskedOtpRecipientsRequested: (
      state,
      _action: PayloadActionWithFeedbackTopic<{ jwt: VisitorOtpJwt }>,
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
      _action: PayloadActionWithFeedbackTopic<
        RequestOtpChallengeDto & { jwt: VisitorOtpJwt }
      >,
    ) => {
      state.isLoading = true;
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
        VerifyOtpChallengeDto & { jwt: VisitorOtpJwt }
      >,
    ) => {
      state.isLoading = true;
    },
    otpChallengeVerificationSucceeded: (
      state,
      _action: PayloadActionWithFeedbackTopic<{
        activeVisitorSession: ActiveVisitorSession;
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
