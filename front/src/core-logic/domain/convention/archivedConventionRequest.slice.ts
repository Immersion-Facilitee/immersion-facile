import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type {
  ArchivedConventionRequestDto,
  ArchivedConventionRequestToReviewListDto,
  ConnectedUserJwt,
  HandleArchivedConventionRequestDto,
} from "shared";
import type {
  PayloadActionWithFeedbackTopic,
  PayloadActionWithFeedbackTopicError,
} from "../feedback/feedback.slice";

export interface ArchivedConventionRequestState {
  isLoading: boolean;
  archivedConventionListToReview: ArchivedConventionRequestToReviewListDto | null;
}

export const initialArchivedConventionRequestState: ArchivedConventionRequestState =
  {
    isLoading: false,
    archivedConventionListToReview: null,
  };

export const archivedConventionRequestSlice = createSlice({
  name: "archivedConventionRequest",
  initialState: initialArchivedConventionRequestState,
  reducers: {
    saveArchivedConventionRequestRequested: (
      state,
      _action: PayloadActionWithFeedbackTopic<{
        archivedConventionRequest: ArchivedConventionRequestDto;
        jwt: ConnectedUserJwt;
      }>,
    ) => {
      state.isLoading = true;
    },
    saveArchivedConventionRequestSucceeded: (
      state,
      _action: PayloadActionWithFeedbackTopic,
    ) => {
      state.isLoading = false;
    },
    saveArchivedConventionRequestFailed: (
      state,
      _action: PayloadActionWithFeedbackTopicError,
    ) => {
      state.isLoading = false;
    },
    fetchArchivedConventionRequestToReviewListRequested: (
      state,
      _action: PayloadActionWithFeedbackTopic<{ jwt: ConnectedUserJwt }>,
    ) => {
      state.isLoading = true;
    },
    fetchArchivedConventionRequestToReviewListSuccedeed: (
      state,
      action: PayloadActionWithFeedbackTopic<{
        archivedConventionListToReview: ArchivedConventionRequestToReviewListDto;
      }>,
    ) => {
      state.isLoading = false;
      state.archivedConventionListToReview =
        action.payload.archivedConventionListToReview;
    },
    fetchArchivedConventionRequestToReviewListFailed: (
      state,
      _action: PayloadActionWithFeedbackTopicError,
    ) => {
      state.isLoading = false;
      state.archivedConventionListToReview = [];
    },
    fetchArchivedConventionListToReviewCleared: (
      state,
      _action: PayloadAction,
    ) => {
      state.isLoading = false;
      state.archivedConventionListToReview = null;
    },
    handleArchivedConventionRequestRequested: (
      state,
      _action: PayloadActionWithFeedbackTopic<
        HandleArchivedConventionRequestDto & { jwt: ConnectedUserJwt }
      >,
    ) => {
      state.isLoading = true;
    },
    handleArchivedConventionRequestTreatedSucceeded: (
      state,
      _action: PayloadActionWithFeedbackTopic,
    ) => {
      state.isLoading = false;
    },
    handleArchivedConventionRequestRefusedSucceeded: (
      state,
      _action: PayloadActionWithFeedbackTopic,
    ) => {
      state.isLoading = false;
    },
    handleArchivedConventionRequestFailed: (
      state,
      _action: PayloadActionWithFeedbackTopicError,
    ) => {
      state.isLoading = false;
    },
  },
});
