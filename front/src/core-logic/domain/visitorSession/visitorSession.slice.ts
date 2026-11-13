import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type {
  ActiveVisitorSession,
  GetVisitorSessionQueryParams,
} from "shared";
import type {
  PayloadActionWithFeedbackTopic,
  PayloadActionWithFeedbackTopicError,
} from "src/core-logic/domain/feedback/feedback.slice";
import { otpChallengeSlice } from "src/core-logic/domain/otpChallenge/otpChallenge.slice";

export type VisitorSessionState =
  | { status: "idle" | "loading" | "otpRequired" }
  | { status: "active"; activeSession: ActiveVisitorSession };

export const visitorSessionInitialState: VisitorSessionState = {
  status: "idle",
};

const getVisitorSessionInitialState = (): VisitorSessionState =>
  visitorSessionInitialState;

export const visitorSessionSlice = createSlice({
  name: "visitorSession",
  initialState: getVisitorSessionInitialState,
  reducers: {
    visitorSessionRequested: (
      _state,
      _action: PayloadActionWithFeedbackTopic<GetVisitorSessionQueryParams>,
    ): VisitorSessionState => ({ status: "loading" }),
    visitorSessionSucceeded: (
      _state,
      action: PayloadAction<ActiveVisitorSession | null>,
    ): VisitorSessionState =>
      action.payload
        ? { status: "active", activeSession: action.payload }
        : { status: "otpRequired" },
    visitorSessionFailed: (
      _state,
      _action: PayloadActionWithFeedbackTopicError,
    ): VisitorSessionState => visitorSessionInitialState,
    resetVisitorSessionRequested: (): VisitorSessionState =>
      visitorSessionInitialState,
  },
  extraReducers: (builder) => {
    builder.addCase(
      otpChallengeSlice.actions.otpChallengeVerificationSucceeded,
      (_state, action): VisitorSessionState => ({
        status: "active",
        activeSession: action.payload.activeVisitorSession,
      }),
    );
  },
});
