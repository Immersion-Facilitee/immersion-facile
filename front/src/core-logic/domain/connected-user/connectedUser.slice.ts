import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { AgencyDto, ConnectedUser, WithAgencyIds } from "shared";
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
  },
});
