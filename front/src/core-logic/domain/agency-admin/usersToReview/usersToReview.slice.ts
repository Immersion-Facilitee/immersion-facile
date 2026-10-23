import { createSlice } from "@reduxjs/toolkit";
import type {
  AgencyDtoForAgencyUsersAndAdmins,
  UserId,
} from "shared";
import type { PayloadActionWithFeedbackTopic } from "src/core-logic/domain/feedback/feedback.slice";

export type UserToReview = {
  id: UserId;
  email: string;
  firstName: string;
  lastName: string;
  agency: AgencyDtoForAgencyUsersAndAdmins;
};

type FetchUsersToReviewPayload = {
  agencies: AgencyDtoForAgencyUsersAndAdmins[];
};

type UsersToReviewState = {
  isLoading: boolean;
  usersToReview: UserToReview[];
  filters: FetchUsersToReviewPayload | null;
};

export const usersToReviewState: UsersToReviewState = {
  usersToReview: [],
  isLoading: false,
  filters: null,
};

export const usersToReviewSlice = createSlice({
  name: "usersToReview",
  initialState: usersToReviewState,
  reducers: {
    fetchUsersToReviewRequested: (
      state,
      action: PayloadActionWithFeedbackTopic<FetchUsersToReviewPayload>,
    ) => {
      state.isLoading = true;
      const { feedbackTopic: _, ...filters } = action.payload;
      state.filters = filters;
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
