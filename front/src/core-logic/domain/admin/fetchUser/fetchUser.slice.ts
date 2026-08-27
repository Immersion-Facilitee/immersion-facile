import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { ConnectedUser, UserId } from "shared";
import { connectedUsersAdminSlice } from "src/core-logic/domain/admin/connectedUsersAdmin/connectedUsersAdmin.slice";
import { updateUserAgencyRights } from "src/core-logic/domain/agencies/agencies.helpers";
import { removeUserFromAgencySlice } from "src/core-logic/domain/agencies/remove-user-from-agency/removeUserFromAgency.slice";
import { updateUserOnAgencySlice } from "src/core-logic/domain/agencies/update-user-on-agency/updateUserOnAgency.slice";

export type FetchUserState = {
  user: ConnectedUser | null;
  isFetching: boolean;
};

export const fetchUserInitialState: FetchUserState = {
  user: null,
  isFetching: false,
};

export const fetchUserSlice = createSlice({
  name: "fetchUser",
  initialState: fetchUserInitialState,
  reducers: {
    fetchUserRequested: (state, _action: PayloadAction<{ userId: UserId }>) => {
      state.isFetching = true;
    },
    fetchUserSucceeded: (state, action: PayloadAction<ConnectedUser>) => {
      state.user = action.payload;
      state.isFetching = false;
    },
  },
  extraReducers: (builder) => {
    builder.addCase(
      updateUserOnAgencySlice.actions.updateUserAgencyRightSucceeded,
      (state, action) => {
        if (!state.user || state.user.id !== action.payload.userId) return;
        state.user = updateUserAgencyRights(state.user, action.payload);
      },
    );
    builder.addCase(
      removeUserFromAgencySlice.actions.removeUserFromAgencySucceeded,
      (state, action) => {
        if (!state.user || state.user.id !== action.payload.userId) return;

        state.user.agencyRights = state.user.agencyRights.filter(
          (right) => right.agency.id !== action.payload.agencyId,
        );
      },
    );
    builder.addCase(
      connectedUsersAdminSlice.actions.updateUserPreventToDeleteSucceeded,
      (state, action) => {
        if (!state.user || state.user.id !== action.payload.userId) return;
        state.user.preventToDelete = action.payload.preventToDelete;
      },
    );
  },
});
