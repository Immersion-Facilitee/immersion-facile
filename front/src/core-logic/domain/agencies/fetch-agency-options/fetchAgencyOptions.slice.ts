import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { AgencyOption } from "shared";

export interface AgencyAdminState {
  agencyOptions: AgencyOption[];
  isLoading: boolean;
}

export const agencyAdminInitialState: AgencyAdminState = {
  agencyOptions: [],
  isLoading: false,
};

export const agencyAdminSlice = createSlice({
  name: "agencyAdmin",
  initialState: agencyAdminInitialState,
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
