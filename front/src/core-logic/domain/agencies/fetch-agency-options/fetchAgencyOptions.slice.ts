import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { AgencyOption } from "shared";

export interface FetchAgencyOptionsState {
  agencyOptions: AgencyOption[];
  isLoading: boolean;
}

export const fetchAgencyOptionsInitialState: FetchAgencyOptionsState = {
  agencyOptions: [],
  isLoading: false,
};

export const fetchAgencyOptionsSlice = createSlice({
  name: "fetchAgencyOptions",
  initialState: fetchAgencyOptionsInitialState,
  reducers: {
    fetchAgencyOptionsRequested: (state, _action: PayloadAction<string>) => {
      state.isLoading = true;
    },
    setAgencyOptions: (state, action: PayloadAction<AgencyOption[]>) => {
      state.agencyOptions = action.payload;
      state.isLoading = false;
    },
  },
});
