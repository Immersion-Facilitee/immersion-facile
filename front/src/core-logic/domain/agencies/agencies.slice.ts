import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type {
  AgencyId,
  AgencyOption,
  AgencyPublicDisplayDto,
  CreateAgencyDto,
  ListAgencyOptionsRequestDto,
} from "shared";
import type { SubmitFeedBack } from "../SubmitFeedback";

export type AgenciesFeedbackKind =
  | "agencyAdded"
  | "agencyOfTypeOtherAdded"
  | "agencyInfoFetched"
  | "agencyOptionsFetched";

export type AgenciesSubmitFeedback = SubmitFeedBack<AgenciesFeedbackKind>;

export type AgenciesState = {
  details: AgencyPublicDisplayDto | null;
  options: AgencyOption[];
  isLoading: boolean;
  feedback: AgenciesSubmitFeedback;
};

const initialState: AgenciesState = {
  details: null,
  options: [],
  isLoading: false,
  feedback: { kind: "idle" },
};

export const agenciesSlice = createSlice({
  name: "agencies",
  initialState,
  reducers: {
    fetchAgencyInfoRequested: (state, _action: PayloadAction<AgencyId>) => {
      state.isLoading = true;
      state.details = null;
    },
    fetchAgencyInfoSucceeded: (
      state,
      action: PayloadAction<AgencyPublicDisplayDto>,
    ) => {
      state.details = action.payload;
      state.isLoading = false;
      state.feedback = { kind: "agencyInfoFetched" };
    },
    fetchAgencyInfoFailed: (state, action: PayloadAction<string>) => {
      state.feedback = { kind: "errored", errorMessage: action.payload };
      state.isLoading = false;
    },
    fetchAgencyOptionsRequested: (
      state,
      _action: PayloadAction<ListAgencyOptionsRequestDto>,
    ) => {
      state.isLoading = true;
    },
    fetchAgencyOptionsSucceeded: (
      state,
      action: PayloadAction<AgencyOption[]>,
    ) => {
      state.options = action.payload;
      state.feedback = { kind: "agencyOptionsFetched" };
      state.isLoading = false;
    },
    fetchAgencyOptionsFailed: (state, action: PayloadAction<string>) => {
      state.feedback = { kind: "errored", errorMessage: action.payload };
      state.isLoading = false;
      state.options = [];
    },
    addAgencyRequested: (state, _action: PayloadAction<CreateAgencyDto>) => {
      state.isLoading = true;
    },
    addAgencySucceeded: (state, action: PayloadAction<CreateAgencyDto>) => {
      state.feedback = {
        kind:
          action.payload.kind !== "autre" || action.payload.refersToAgencyId
            ? "agencyAdded"
            : "agencyOfTypeOtherAdded",
      };
      state.isLoading = false;
    },
    addAgencyFailed: (state, action: PayloadAction<string>) => {
      state.feedback = { kind: "errored", errorMessage: action.payload };
      state.isLoading = false;
    },
    addAgencyClearRequested: (state, _action: PayloadAction<void>) => {
      state.feedback = { kind: "idle" };
      state.isLoading = false;
    },
    clearFeedback: (state, _action: PayloadAction<void>) => {
      state.feedback = { kind: "idle" };
    },
  },
});
