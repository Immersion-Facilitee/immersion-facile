import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type {
  ActiveVisitorSession,
  GetVisitorSessionQueryParams,
} from "shared";
import type {
  PayloadActionWithFeedbackTopic,
  PayloadActionWithFeedbackTopicError,
} from "src/core-logic/domain/feedback/feedback.slice";
import type { VisitorSessionResult } from "src/core-logic/ports/OtpChallengeGateway";

export type VisitorSessionState = {
  isLoading: boolean;
  activeSession: ActiveVisitorSession | null;
  needsOtp: boolean;
};

export const visitorSessionInitialState: VisitorSessionState = {
  isLoading: false,
  activeSession: null,
  needsOtp: false,
};

export const visitorSessionSlice = createSlice({
  name: "visitorSession",
  initialState: visitorSessionInitialState,
  reducers: {
    visitorSessionRequested: (
      _state,
      _action: PayloadActionWithFeedbackTopic<GetVisitorSessionQueryParams>,
    ) => ({
      ...visitorSessionInitialState,
      isLoading: true,
    }),
    visitorSessionSucceeded: (
      state,
      action: PayloadAction<VisitorSessionResult>,
    ) => {
      state.isLoading = false;
      state.activeSession = action.payload.activeSession;
      state.needsOtp = action.payload.needsOtp;
    },
    visitorSessionFailed: (
      state,
      _action: PayloadActionWithFeedbackTopicError,
    ) => {
      state.isLoading = false;
    },
  },
});
