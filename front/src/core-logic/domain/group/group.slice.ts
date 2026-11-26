import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { GroupInfo } from "shared";
import type {
  PayloadActionWithFeedbackTopic,
  PayloadActionWithFeedbackTopicError,
} from "src/core-logic/domain/feedback/feedback.slice";

type GroupState = {
  currentGroup: GroupInfo | null;
  isLoading: boolean;
};

export const initialState: GroupState = {
  currentGroup: null,
  isLoading: false,
};

export const groupSlice = createSlice({
  name: "group",
  initialState,
  reducers: {
    getGroupRequested: (
      state,
      action: PayloadActionWithFeedbackTopic<{ slug: string }>,
    ) => {
      state.isLoading = true;
      state.currentGroup = initialState.currentGroup;
    },
    getGroupSucceeded: (state, action: PayloadAction<GroupInfo>) => {
      state.isLoading = false;
      state.currentGroup = action.payload;
    },
    getGroupFailed: (state, action: PayloadActionWithFeedbackTopicError) => {
      state.isLoading = false;
      state.currentGroup = initialState.currentGroup;
    },
    clearGroupRequested: (state) => {
      state.currentGroup = initialState.currentGroup;
    },
  },
});
