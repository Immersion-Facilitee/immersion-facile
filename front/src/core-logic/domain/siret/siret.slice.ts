import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import {
  type GetSiretInfoError,
  getCountryCodeFromAddress,
  type SiretDto,
  type SiretEstablishmentDto,
  type SupportedCountryCode,
} from "shared";
import type { PayloadActionWithFeedbackTopic } from "src/core-logic/domain/feedback/feedback.slice";
import type { AddressAutocompleteLocator } from "src/core-logic/domain/geocoding/geocoding.slice";
import type { ActionOfSlice } from "src/core-logic/storeConfig/redux.helpers";

export type InvalidSiretError = "SIRET must be 14 digits";

export type SiretSliceError =
  | GetSiretInfoError
  | InvalidSiretError
  | string
  | "Already exists";

export interface SiretState {
  currentSiret: string;
  isSearching: boolean;
  shouldThrowErrorOnAlreadySaved: boolean;
  establishment: SiretEstablishmentDto | null;
  error: SiretSliceError | null;
  countryCode: SupportedCountryCode | null;
}

const initialState: SiretState = {
  currentSiret: "",
  isSearching: false,
  shouldThrowErrorOnAlreadySaved: false,
  establishment: null,
  error: null,
  countryCode: null,
};

export const siretSlice = createSlice({
  name: "siret",
  initialState,
  reducers: {
    setShouldThrowErrorOnAlreadySaved: (
      state,
      action: PayloadAction<{
        shouldThrowErrorOnAlreadySaved: boolean;
        addressAutocompleteLocator: AddressAutocompleteLocator | null;
      }>,
    ) => {
      state.shouldThrowErrorOnAlreadySaved =
        action.payload.shouldThrowErrorOnAlreadySaved;
    },
    siretModified: (
      state,
      action: PayloadActionWithFeedbackTopic<{
        siret: SiretDto;
        addressAutocompleteLocator: AddressAutocompleteLocator | null;
      }>,
    ) => {
      state.currentSiret = action.payload.siret;
      state.establishment = null;
      state.error = null;
    },
    siretWasNotValid: (state) => {
      state.error = "SIRET must be 14 digits";
    },
    siretInfoRequested: (
      state,
      _action: PayloadActionWithFeedbackTopic<{
        siret: SiretDto;
        addressAutocompleteLocator: AddressAutocompleteLocator | null;
      }>,
    ) => {
      state.isSearching = true;
    },
    siretInfoSucceeded: (
      state,
      action: PayloadActionWithFeedbackTopic<{
        siretEstablishment: SiretEstablishmentDto;
        addressAutocompleteLocator: AddressAutocompleteLocator | null;
        countryCode: SupportedCountryCode;
      }>,
    ) => {
      state.isSearching = false;
      state.establishment = action.payload.siretEstablishment;
      state.countryCode = getCountryCodeFromAddress(
        action.payload.siretEstablishment.businessAddress,
      );
    },
    siretInfoDisabledAndNoMatchInDbFound: (
      state,
      _action: PayloadAction<{
        siret: SiretDto;
      }>,
    ) => {
      state.isSearching = false;
      state.establishment = null;
    },
    siretInfoFailed: (state, action: PayloadAction<SiretSliceError>) => {
      state.isSearching = false;
      state.error = action.payload;
    },
    siretInfoClearRequested: () => initialState,
    siretToEstablishmentRedirectionRequested: (state) => state,
  },
});

export type SiretAction = ActionOfSlice<typeof siretSlice>;
