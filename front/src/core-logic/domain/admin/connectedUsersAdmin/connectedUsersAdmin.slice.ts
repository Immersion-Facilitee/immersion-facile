import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type {
  AgencyUserForListing,
  AgencyUsersForListingById,
  RejectConnectedUserRoleForAgencyParams,
  UserParamsForAgency,
  WithAgencyId,
  WithPreventToDelete,
  WithUserFilters,
  WithUserId,
} from "shared";
import type { SubmitFeedBack } from "src/core-logic/domain/SubmitFeedback";
import type { PayloadActionWithFeedbackTopic } from "../../feedback/feedback.slice";

type ConnectedUsersAdminFeedbackKind =
  | "usersToReviewFetchSuccess"
  | "agencyRegisterToUserSuccess"
  | "agencyRejectionForUserSuccess"
  | "agencyUsersFetchSuccess";

export type ConnectedUsersAdminFeedback =
  SubmitFeedBack<ConnectedUsersAdminFeedbackKind>;

export type ConnectedUsersAdminState = {
  connectedUsersNeedingReview: AgencyUsersForListingById;
  agencyUsers: AgencyUsersForListingById;
  selectedUser: AgencyUserForListing | null;
  isUpdatingConnectedUserAgency: boolean;
  isFetchingAgenciesNeedingReviewForIcUser: boolean;
  isFetchingAgencyUsers: boolean;
  isUpdatingUserPreventToDelete: boolean;
  feedback: ConnectedUsersAdminFeedback;
  usersToReviewFilters: WithUserFilters | null;
  agencyUsersFilters: WithUserFilters | null;
};

export const connectedUsersAdminInitialState: ConnectedUsersAdminState = {
  connectedUsersNeedingReview: {},
  agencyUsers: {},
  selectedUser: null,
  isUpdatingConnectedUserAgency: false,
  isFetchingAgenciesNeedingReviewForIcUser: false,
  isFetchingAgencyUsers: false,
  isUpdatingUserPreventToDelete: false,
  feedback: { kind: "idle" },
  usersToReviewFilters: null,
  agencyUsersFilters: null,
};

export const connectedUsersAdminSlice = createSlice({
  name: "connectedUsersAdmin",
  initialState: connectedUsersAdminInitialState,
  reducers: {
    connectedUserSelected: (
      state,
      action: PayloadAction<AgencyUserForListing | null>,
    ) => {
      state.selectedUser = action.payload;
      if (state.feedback.kind === "errored")
        state.feedback = { kind: "usersToReviewFetchSuccess" };
    },
    fetchConnectedUsersToReviewRequested: (
      state,
      action: PayloadAction<WithUserFilters>,
    ) => {
      state.isFetchingAgenciesNeedingReviewForIcUser = true;
      state.usersToReviewFilters = action.payload;
    },
    fetchConnectedUsersToReviewFailed: (
      state,
      action: PayloadAction<string>,
    ) => {
      state.isFetchingAgenciesNeedingReviewForIcUser = false;
      state.feedback = { kind: "errored", errorMessage: action.payload };
    },
    fetchConnectedUsersToReviewSucceeded: (
      state,
      action: PayloadAction<AgencyUsersForListingById>,
    ) => {
      state.isFetchingAgenciesNeedingReviewForIcUser = false;
      state.connectedUsersNeedingReview = action.payload;
      if (
        state.feedback.kind !== "agencyRegisterToUserSuccess" &&
        state.feedback.kind !== "agencyRejectionForUserSuccess"
      )
        state.feedback.kind = "usersToReviewFetchSuccess";
    },
    fetchAgencyUsersRequested: (
      state,
      action: PayloadAction<WithUserFilters>,
    ) => {
      state.agencyUsers = connectedUsersAdminInitialState.agencyUsers;
      state.isFetchingAgencyUsers = true;
      state.agencyUsersFilters = action.payload;
    },
    fetchAgencyUsersFailed: (state, action: PayloadAction<string>) => {
      state.isFetchingAgencyUsers = false;
      state.feedback = { kind: "errored", errorMessage: action.payload };
    },
    fetchAgencyUsersSucceeded: (
      state,
      action: PayloadAction<AgencyUsersForListingById>,
    ) => {
      state.isFetchingAgencyUsers = false;
      state.agencyUsers = action.payload;
      state.feedback.kind = "agencyUsersFetchSuccess";
    },
    registerAgencyWithRoleToUserRequested: (
      state,
      _action: PayloadActionWithFeedbackTopic<UserParamsForAgency>,
    ) => {
      state.isUpdatingConnectedUserAgency = true;
    },
    registerAgencyWithRoleToUserSucceeded: (
      state,
      _action: PayloadActionWithFeedbackTopic<UserParamsForAgency>,
    ) => {
      state.isUpdatingConnectedUserAgency = false;
      state.feedback.kind = "agencyRegisterToUserSuccess";
    },
    registerAgencyWithRoleToUserFailed: (
      state,
      action: PayloadActionWithFeedbackTopic<{ errorMessage: string }>,
    ) => {
      state.isUpdatingConnectedUserAgency = false;
      state.feedback = {
        kind: "errored",
        errorMessage: action.payload.errorMessage,
      };
    },
    rejectAgencyWithRoleToUserRequested: (
      state,
      _action: PayloadActionWithFeedbackTopic<RejectConnectedUserRoleForAgencyParams>,
    ) => {
      state.isUpdatingConnectedUserAgency = true;
    },

    rejectAgencyWithRoleToUserSucceeded: (
      state,
      _action: PayloadActionWithFeedbackTopic<RejectConnectedUserRoleForAgencyParams>,
    ) => {
      state.isUpdatingConnectedUserAgency = false;
      state.feedback.kind = "agencyRejectionForUserSuccess";
    },

    rejectAgencyWithRoleToUserFailed: (
      state,
      action: PayloadActionWithFeedbackTopic<{
        errorMessage: string;
      }>,
    ) => {
      state.isUpdatingConnectedUserAgency = false;
      state.feedback = {
        kind: "errored",
        errorMessage: action.payload.errorMessage,
      };
    },

    createUserOnAgencyRequested: (
      state,
      _action: PayloadActionWithFeedbackTopic<UserParamsForAgency>,
    ) => {
      state.isUpdatingConnectedUserAgency = true;
    },

    createUserOnAgencySucceeded: (
      state,
      _action: PayloadActionWithFeedbackTopic<WithAgencyId>,
    ) => {
      state.isUpdatingConnectedUserAgency = false;
    },

    createUserOnAgencyFailed: (
      state,
      _action: PayloadActionWithFeedbackTopic<{ errorMessage: string }>,
    ) => {
      state.isUpdatingConnectedUserAgency = false;
    },

    updateUserOnAgencyRequested: (
      state,
      _action: PayloadActionWithFeedbackTopic<UserParamsForAgency>,
    ) => {
      state.isUpdatingConnectedUserAgency = true;
    },

    updateUserOnAgencySucceeded: (
      state,
      _action: PayloadActionWithFeedbackTopic<UserParamsForAgency>,
    ) => {
      state.isUpdatingConnectedUserAgency = false;
    },

    updateUserOnAgencyFailed: (
      state,
      _action: PayloadActionWithFeedbackTopic<{ errorMessage: string }>,
    ) => {
      state.isUpdatingConnectedUserAgency = false;
    },

    updateUserPreventToDeleteRequested: (
      state,
      _action: PayloadActionWithFeedbackTopic<WithUserId & WithPreventToDelete>,
    ) => {
      state.isUpdatingUserPreventToDelete = true;
    },
    updateUserPreventToDeleteSucceeded: (
      state,
      _action: PayloadActionWithFeedbackTopic<WithUserId & WithPreventToDelete>,
    ) => {
      state.isUpdatingUserPreventToDelete = false;
    },
    updateUserPreventToDeleteFailed: (
      state,
      _action: PayloadActionWithFeedbackTopic<{ errorMessage: string }>,
    ) => {
      state.isUpdatingUserPreventToDelete = false;
    },

    feedbackClearRequested: (state) => {
      state.feedback = { kind: "idle" };
    },
  },
});
