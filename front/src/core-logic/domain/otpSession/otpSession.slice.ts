import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { ActiveOtpSession, GetOtpSessionQueryParams } from "shared";
import type {
  PayloadActionWithFeedbackTopic,
  PayloadActionWithFeedbackTopicError,
} from "src/core-logic/domain/feedback/feedback.slice";
import { otpChallengeSlice } from "src/core-logic/domain/otpChallenge/otpChallenge.slice";

export type OtpSessionState = {
  isLoading: boolean;
  hasCheckedSession: boolean;
  activeSession: ActiveOtpSession | null;
};

export const otpSessionInitialState: OtpSessionState = {
  isLoading: false,
  hasCheckedSession: false,
  activeSession: null,
};

export const otpSessionSlice = createSlice({
  name: "otpSession",
  initialState: otpSessionInitialState,
  reducers: {
    otpSessionRequested: (
      state,
      _action: PayloadActionWithFeedbackTopic<GetOtpSessionQueryParams>,
    ) => {
      state.isLoading = true;
      state.hasCheckedSession = false;
      state.activeSession = null;
    },
    otpSessionSucceeded: (
      state,
      action: PayloadAction<ActiveOtpSession | null>,
    ) => {
      state.isLoading = false;
      state.hasCheckedSession = true;
      state.activeSession = action.payload;
    },
    otpSessionFailed: (_state, _action: PayloadActionWithFeedbackTopicError) =>
      otpSessionInitialState,
    resetOtpSessionRequested: () => otpSessionInitialState,
  },
  extraReducers: (builder) => {
    builder.addCase(
      otpChallengeSlice.actions.otpChallengeVerificationSucceeded,
      (state, action) => {
        state.isLoading = false;
        state.hasCheckedSession = true;
        state.activeSession = action.payload.activeOtpSession;
      },
    );
  },
});
