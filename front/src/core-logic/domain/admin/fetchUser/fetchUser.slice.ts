import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { ConnectedUser, UserId } from "shared";

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
});
