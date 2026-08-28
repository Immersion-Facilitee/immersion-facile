import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type {
  AgencyDto,
  AgencyRight,
  ConnectedUser,
  WithAgencyIds,
} from "shared";
import { updateUserAgencyRights } from "src/core-logic/domain/agencies/agencies.helpers";
import { removeUserFromAgencySlice } from "src/core-logic/domain/agencies/remove-user-from-agency/removeUserFromAgency.slice";
import { updateUserOnAgencySlice } from "src/core-logic/domain/agencies/update-user-on-agency/updateUserOnAgency.slice";
import type {
  PayloadActionWithFeedbackTopic,
  PayloadActionWithFeedbackTopicError,
} from "src/core-logic/domain/feedback/feedback.slice";
import { authSlice } from "../auth/auth.slice";

type ConnectedUserState = {
  currentUser: ConnectedUser | null;
  isLoading: boolean;
  agenciesToReview: AgencyDto[];
};

const initialState: ConnectedUserState = {
  currentUser: null,
  isLoading: false,
  agenciesToReview: [],
};

export const connectedUserSlice = createSlice({
  name: "connectedUser",
  initialState,
  reducers: {
    currentUserFetchRequested: (
      state,
      _action: PayloadActionWithFeedbackTopic,
    ) => {
      state.isLoading = true;
    },
    currentUserFetchSucceeded: (
      state,
      action: PayloadAction<ConnectedUser>,
    ) => {
      state.isLoading = false;
      state.currentUser = action.payload;
    },
    currentUserFetchFailed: (
      state,
      _action: PayloadActionWithFeedbackTopicError,
    ) => {
      state.isLoading = false;
    },
    registerAgenciesRequested: (
      state,
      _payload: PayloadActionWithFeedbackTopic<WithAgencyIds>,
    ) => {
      state.isLoading = true;
    },
    registerAgenciesSucceeded: (
      state,
      _action: PayloadActionWithFeedbackTopic<WithAgencyIds>,
    ) => {
      state.isLoading = false;
      //state.feedback = { kind: "agencyRegistrationSuccess" };
    },
    registerAgenciesFailed: (
      state,
      _action: PayloadActionWithFeedbackTopicError,
    ) => {
      state.isLoading = false;
    },
  },
  extraReducers: (builder) => {
    builder.addCase(authSlice.actions.fetchLogoutUrlSucceeded, (state) => {
      state.currentUser = null;
    });

    builder.addCase(
      updateUserOnAgencySlice.actions.updateUserAgencyRightSucceeded,
      (state, action) => {
        if (
          !state.currentUser ||
          state.currentUser.id !== action.payload.userId
        )
          return;
        state.currentUser = updateUserAgencyRights(
          state.currentUser,
          action.payload,
        );
      },
    );
    builder.addCase(
      removeUserFromAgencySlice.actions.removeUserFromAgencySucceeded,
      (state, action) => {
        if (
          !state.currentUser ||
          state.currentUser.id !== action.payload.userId
        )
          return;

        state.currentUser.agencyRights = state.currentUser.agencyRights.filter(
          (right: AgencyRight) => right.agency.id !== action.payload.agencyId,
        );
      },
    );
  },
});
