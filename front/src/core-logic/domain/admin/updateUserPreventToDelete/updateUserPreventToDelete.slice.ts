import { createSlice } from "@reduxjs/toolkit";
import type { WithPreventToDelete, WithUserId } from "shared";
import type { PayloadActionWithFeedbackTopic } from "src/core-logic/domain/feedback/feedback.slice";

type UpdateUserPreventToDeleteState = {
  isLoading: boolean;
};

export const updateUserPreventToDeleteInitialState: UpdateUserPreventToDeleteState =
  {
    isLoading: false,
  };

export type UpdateUserPreventToDeletePayload = WithUserId & WithPreventToDelete;

export const updateUserPreventToDeleteSlice = createSlice({
  name: "updateUserPreventToDelete",
  initialState: updateUserPreventToDeleteInitialState,
  reducers: {
    updateUserPreventToDeleteRequested: (
      state,
      _action: PayloadActionWithFeedbackTopic<UpdateUserPreventToDeletePayload>,
    ) => {
      state.isLoading = true;
    },
    updateUserPreventToDeleteSucceeded: (
      state,
      _action: PayloadActionWithFeedbackTopic<UpdateUserPreventToDeletePayload>,
    ) => {
      state.isLoading = false;
    },
    updateUserPreventToDeleteFailed: (
      state,
      _action: PayloadActionWithFeedbackTopic<{ errorMessage: string }>,
    ) => {
      state.isLoading = false;
    },
  },
});
