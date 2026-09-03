import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type {
  BroadcastFeedback,
  ConventionId,
  ConventionSupportedJwt,
  MarkPartnersErroredConventionAsHandledRequest,
} from "shared";
import type { PayloadActionWithFeedbackTopic } from "../feedback/feedback.slice";

export interface PartnersErroredConventionState {
  isLoading: boolean;
  lastBroadcastFeedback: BroadcastFeedback | null;
}

export const initialPartnersErroredConventionState: PartnersErroredConventionState =
  {
    isLoading: false,
    lastBroadcastFeedback: null,
  };

type MarkPartnersErroredConventionAsHandledRequestPayload = {
  jwt: ConventionSupportedJwt;
  markAsHandledParams: MarkPartnersErroredConventionAsHandledRequest;
};

type FetchConventionLastBroadcastFeedbackRequestPayload = {
  conventionId: ConventionId;
  jwt: ConventionSupportedJwt;
};

export const partnersErroredConventionSlice = createSlice({
  name: "partnersErroredConvention",
  initialState: initialPartnersErroredConventionState,
  reducers: {
    markAsHandledRequested: (
      state,
      _action: PayloadActionWithFeedbackTopic<MarkPartnersErroredConventionAsHandledRequestPayload>,
    ) => {
      state.isLoading = true;
    },
    markAsHandledSucceeded: (
      state,
      _action: PayloadActionWithFeedbackTopic,
    ) => {
      state.isLoading = false;
    },
    markAsHandledFailed: (
      state: PartnersErroredConventionState,
      _action: PayloadActionWithFeedbackTopic<{ errorMessage: string }>,
    ) => {
      state.isLoading = false;
    },
    clearConventionLastBroadcastFeedback: (state) => {
      state.lastBroadcastFeedback =
        initialPartnersErroredConventionState.lastBroadcastFeedback;
    },
    fetchConventionLastBroadcastFeedbackRequested: (
      state,
      _action: PayloadAction<FetchConventionLastBroadcastFeedbackRequestPayload>,
    ) => {
      state.isLoading = true;
    },
    fetchConventionLastBroadcastFeedbackSucceeded: (
      state,
      action: PayloadAction<{
        lastBroadcastFeedback: BroadcastFeedback | null;
      }>,
    ) => {
      state.isLoading = false;
      state.lastBroadcastFeedback = action.payload.lastBroadcastFeedback;
    },
    fetchConventionLastBroadcastFeedbackFailed: (
      state: PartnersErroredConventionState,
      _action: PayloadAction<{ errorMessage: string }>,
    ) => {
      state.isLoading = false;
    },
  },
});
