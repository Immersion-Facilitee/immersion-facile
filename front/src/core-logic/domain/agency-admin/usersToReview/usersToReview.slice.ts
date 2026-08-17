import { createSlice } from "@reduxjs/toolkit";
import type {
  AgencyDtoForAgencyUsersAndAdmins,
  AgencyId,
  UserId,
  WithUserFilters,
} from "shared";
import { connectedUsersAdminSlice } from "src/core-logic/domain/admin/connectedUsersAdmin/connectedUsersAdmin.slice";
import type { PayloadActionWithFeedbackTopic } from "src/core-logic/domain/feedback/feedback.slice";

export type UserToReview = {
  id: UserId;
  email: string;
  firstName: string;
  lastName: string;
  agency: AgencyDtoForAgencyUsersAndAdmins;
};

type UsersToReviewState = {
  isLoading: boolean;
  usersToReview: UserToReview[];
};

export const usersToReviewState: UsersToReviewState = {
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
  extraReducers: (builder) => {
    const removeUserRegistration = (
      state: UsersToReviewState,
      action: { payload: { userId: UserId; agencyId: AgencyId } },
    ) => {
      state.usersToReview = state.usersToReview.filter(
        (user) =>
          !(
            user.id === action.payload.userId &&
            user.agency.id === action.payload.agencyId
          ),
      );
    };

    builder.addCase(
      connectedUsersAdminSlice.actions.rejectAgencyWithRoleToUserSucceeded,
      removeUserRegistration,
    );
    builder.addCase(
      connectedUsersAdminSlice.actions.registerAgencyWithRoleToUserSucceeded,
      removeUserRegistration,
    );
  },
});
