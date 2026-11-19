import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { ActiveOtpSession, GetOtpSessionQueryParams } from "shared";
import type {
  PayloadActionWithFeedbackTopic,
  PayloadActionWithFeedbackTopicError,
} from "src/core-logic/domain/feedback/feedback.slice";
import { otpChallengeSlice } from "src/core-logic/domain/otpChallenge/otpChallenge.slice";

export type OtpSessionState =
  | { status: "idle" | "loading" | "otpRequired" }
  | { status: "active"; activeSession: ActiveOtpSession };

export const otpSessionInitialState: OtpSessionState = {
  status: "idle",
};

const getOtpSessionInitialState = (): OtpSessionState => otpSessionInitialState;

export const otpSessionSlice = createSlice({
  name: "otpSession",
  initialState: getOtpSessionInitialState,
  reducers: {
    otpSessionRequested: (
      _state,
      _action: PayloadActionWithFeedbackTopic<GetOtpSessionQueryParams>,
    ): OtpSessionState => ({ status: "loading" }),
    otpSessionSucceeded: (
      _state,
      action: PayloadAction<ActiveOtpSession | null>,
    ): OtpSessionState =>
      action.payload
        ? { status: "active", activeSession: action.payload }
        : { status: "otpRequired" },
    otpSessionFailed: (
      _state,
      _action: PayloadActionWithFeedbackTopicError,
    ): OtpSessionState => otpSessionInitialState,
    resetOtpSessionRequested: (): OtpSessionState => otpSessionInitialState,
  },
  extraReducers: (builder) => {
    builder.addCase(
      otpChallengeSlice.actions.otpChallengeVerificationSucceeded,
      (_state, action): OtpSessionState => ({
        status: "active",
        activeSession: action.payload.activeOtpSession,
      }),
    );
  },
});
