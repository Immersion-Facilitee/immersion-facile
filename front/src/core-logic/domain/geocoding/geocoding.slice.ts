import { createSlice } from "@reduxjs/toolkit";
import { keys } from "ramda";
import {
  type AddressAndPositionWithFormattedAddress,
  type AddressWithCountryCodeAndPosition,
  addressDtoToString,
  defaultCountryCode,
  type LookupAddress,
  type SupportedCountryCode,
} from "shared";
import { fetchAgencySlice } from "src/core-logic/domain/agencies/fetch-agency/fetchAgency.slice";
import {
  type AutocompleteItem,
  type AutocompleteState,
  initialAutocompleteItem,
  type PayloadActionWithLocator,
} from "src/core-logic/domain/autocomplete.utils";

export type MultipleAddressAutocompleteLocator = `multiple-address-${number}`;

export type AddressAutocompleteLocator =
  | "convention-immersion-address"
  | "convention-beneficiary-address"
  | "convention-beneficiary-current-employer-address"
  | "agency-address"
  | "create-establishment-address"
  | "create-establishment-in-person-address"
  | MultipleAddressAutocompleteLocator;

const initialState: AutocompleteState<
  AddressAutocompleteLocator,
  AddressAndPositionWithFormattedAddress
> = {
  data: {},
};

export const geocodingSlice = createSlice({
  name: "geocoding",
  initialState,
  reducers: {
    clearLocatorDataRequested: (
      state,
      action: PayloadActionWithLocator<
        AddressAutocompleteLocator,
        { multiple?: boolean }
      >,
    ) => {
      const { locator, multiple } = action.payload;
      if (multiple) {
        const multipleLocators = keys(state.data)
          .filter((key): key is MultipleAddressAutocompleteLocator =>
            String(key).startsWith("multiple-address-"),
          )
          .sort((a, b) => {
            const aIndex = getMultipleAddressLocatorIndex(a);
            const bIndex = getMultipleAddressLocatorIndex(b);
            return aIndex - bIndex;
          });

        const maxIndex = multipleLocators.length - 2; // 1 because 0 based index + 1 for the locator we're removing
        const newMultipleData = multipleLocators.reduce(
          (acc, key) => {
            if (key === locator) return acc;

            const currentIndex = getMultipleAddressLocatorIndex(key);
            const newIndex =
              currentIndex >
              getMultipleAddressLocatorIndex(
                locator as MultipleAddressAutocompleteLocator,
              )
                ? currentIndex - 1
                : currentIndex;
            if (newIndex <= maxIndex) {
              const nextKey =
                `multiple-address-${newIndex}` as MultipleAddressAutocompleteLocator;
              const value = state.data[key];
              if (value) acc[nextKey] = value;
            }
            return acc;
          },
          {} as Record<
            MultipleAddressAutocompleteLocator,
            AutocompleteItem<AddressWithCountryCodeAndPosition>
          >,
        );
        const nonMultipleData = keys(state.data).reduce(
          (acc, key) => {
            if (!String(key).startsWith("multiple-address-")) {
              const value = state.data[key as AddressAutocompleteLocator];
              if (value) acc[String(key)] = value;
            }
            return acc;
          },
          {} as Record<
            string,
            AutocompleteItem<AddressWithCountryCodeAndPosition>
          >,
        );

        return {
          ...state,
          data: {
            ...nonMultipleData,
            ...newMultipleData,
          },
        };
      }

      return {
        ...state,
        data: {
          ...state.data,
          [locator]: initialAutocompleteItem,
        },
      };
    },
    emptyQueryRequested: (
      state,
      action: PayloadActionWithLocator<AddressAutocompleteLocator>,
    ) => ({
      ...initialState,
      data: {
        ...state.data,
        [action.payload.locator]: {
          ...initialAutocompleteItem,
          ...state.data[action.payload.locator],
          query: "",
        },
      },
    }),
    changeQueryRequested: (
      state,
      action: PayloadActionWithLocator<
        AddressAutocompleteLocator,
        {
          lookup: LookupAddress;
          countryCode: SupportedCountryCode;
        }
      >,
    ) => {
      const { locator } = action.payload;
      state.data[locator] = {
        ...initialAutocompleteItem,
        ...state.data[locator],
        isDebouncing: true,
      };
    },
    fetchSuggestionsRequested: (
      state,
      action: PayloadActionWithLocator<
        AddressAutocompleteLocator,
        {
          lookup: LookupAddress;
          countryCode: SupportedCountryCode;
          selectFirstSuggestion: boolean;
        }
      >,
    ) => {
      const { locator } = action.payload;
      return {
        ...state,
        data: {
          ...state.data,
          [locator]: {
            ...initialAutocompleteItem,
            ...state.data[locator],
            query: action.payload.lookup,
            isLoading: true,
            isDebouncing: false,
          },
        },
      };
    },
    fetchSuggestionsSucceeded: (
      state,
      action: PayloadActionWithLocator<
        AddressAutocompleteLocator,
        {
          suggestions: AddressAndPositionWithFormattedAddress[];
          selectFirstSuggestion: boolean;
        }
      >,
    ) => {
      const { locator } = action.payload;
      return {
        ...state,
        data: {
          ...state.data,
          [locator]: {
            ...initialAutocompleteItem,
            ...state.data[locator],
            isLoading: false,
            suggestions: action.payload.suggestions,
            ...(action.payload.selectFirstSuggestion
              ? { value: action.payload.suggestions[0] }
              : {}),
          } satisfies AutocompleteItem<AddressAndPositionWithFormattedAddress>,
        },
      };
    },
    fetchSuggestionsFailed: (
      state,
      action: PayloadActionWithLocator<AddressAutocompleteLocator>,
    ) => {
      const { locator } = action.payload;
      return {
        ...state,
        data: {
          ...state.data,
          [locator]: {
            ...initialAutocompleteItem,
            ...state.data[locator],
            isLoading: false,
          },
        },
      };
    },
    selectSuggestionRequested: (
      state,
      action: PayloadActionWithLocator<
        AddressAutocompleteLocator,
        { item: AddressWithCountryCodeAndPosition }
      >,
    ) => {
      const { locator } = action.payload;
      return {
        ...state,
        data: {
          ...state.data,
          [locator]: {
            ...initialAutocompleteItem,
            ...state.data[locator],
            value: action.payload.item,
          },
        },
      };
    },
  },
  extraReducers: (builder) => {
    builder.addCase(
      fetchAgencySlice.actions.fetchAgencySucceeded,
      (state, action) => {
        if (!action.payload) return;
        state.data["agency-address"] = {
          ...initialAutocompleteItem,
          value: {
            address: {
              ...action.payload.address,
              countryCode: defaultCountryCode,
            },
            position: {
              lat: action.payload.position.lat,
              lon: action.payload.position.lon,
            },
            formattedAddress: addressDtoToString(action.payload.address),
          },
        };
      },
    );
  },
});

const getMultipleAddressLocatorIndex = (
  locator: MultipleAddressAutocompleteLocator,
): number => {
  return Number.parseInt(locator.substring(locator.lastIndexOf("-") + 1));
};
