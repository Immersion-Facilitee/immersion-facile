import { createSlice } from "@reduxjs/toolkit";
import type { AgencyId, UserId, WithUserFilters } from "shared";
import type { PayloadActionWithFeedbackTopic } from "src/core-logic/domain/feedback/feedback.slice";

export type UserToReview = {
  id: UserId;
  email: string;
  firstName: string;
  lastName: string;
  agencyId: AgencyId;
  agencyName: string;
};

export type AdminAgencyState = {
  isLoading: boolean;
  usersToReview: UserToReview[];
};

export const usersToReviewState: AdminAgencyState = {
  usersToReview: [],
  isLoading: false,
};

export const usersToReviewSlice = createSlice({
  name: "usersToReview",
  initialState: usersToReviewState,
  reducers: {
    fetchUsersToReviewRequested: (
      state,
      _action: PayloadActionWithFeedbackTopic<WithUserFilters>,
    ) => {
      state.isLoading = true;
    },
    fetchUsersToReviewSucceeded: (
      state,
      action: PayloadActionWithFeedbackTopic<{
        usersToReview: UserToReview[];
      }>,
    ) => {
      state.usersToReview = action.payload.usersToReview;
      state.isLoading = false;
    },
    fetchUsersToReviewFailed: (
      state,
      _action: PayloadActionWithFeedbackTopic<{ errorMessage: string }>,
    ) => {
      state.isLoading = false;
    },
  },
});
