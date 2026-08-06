import { createSlice } from "@reduxjs/toolkit";
import { keys } from "ramda";
import type { AppellationAndRomeDto } from "shared";
import {
  type AutocompleteItem,
  type AutocompleteState,
  initialAutocompleteItem,
  type PayloadActionWithLocator,
} from "src/core-logic/domain/autocomplete.utils";

export type MultipleAppellationAutocompleteLocator =
  `multiple-appellation-${number}`;

export type AppellationAutocompleteLocator =
  | "search-form-appellation"
  | "convention-profession"
  | "archived-convention-request"
  | "form-establishment-offer-modal"
  | MultipleAppellationAutocompleteLocator;

const initialState: AutocompleteState<
  AppellationAutocompleteLocator,
  AppellationAndRomeDto
> = {
  data: {},
};

export const appellationSlice = createSlice({
  name: "appellation",
  initialState,
  reducers: {
    clearLocatorDataRequested: (
      state,
      action: PayloadActionWithLocator<
        AppellationAutocompleteLocator,
        { multiple?: boolean }
      >,
    ) => {
      const { locator, multiple } = action.payload;
      if (multiple) {
        const multipleLocators = keys(state.data)
          .filter((key): key is MultipleAppellationAutocompleteLocator =>
            key.startsWith("multiple-appellation-"),
          )
          .sort((a, b) => {
            const aIndex = getMultipleAppellationLocatorIndex(a);
            const bIndex = getMultipleAppellationLocatorIndex(b);
            return aIndex - bIndex;
          });

        const maxIndex = multipleLocators.length - 2; // 1 because 0 based index + 1 for the locator we're removing
        const newMultipleData = multipleLocators.reduce(
          (acc, key) => {
            if (key === locator) return acc;

            const currentIndex = getMultipleAppellationLocatorIndex(key);
            const newIndex =
              currentIndex >
              getMultipleAppellationLocatorIndex(
                locator as MultipleAppellationAutocompleteLocator,
              )
                ? currentIndex - 1
                : currentIndex;
            if (newIndex <= maxIndex) {
              const nextKey =
                `multiple-appellation-${newIndex}` as MultipleAppellationAutocompleteLocator;
              const value = state.data[key];
              if (value) acc[nextKey] = value;
            }
            return acc;
          },
          {} as Record<
            MultipleAppellationAutocompleteLocator,
            AutocompleteItem<AppellationAndRomeDto>
          >,
        );
        const nonMultipleData = keys(state.data).reduce(
          (acc, key) => {
            if (!key.startsWith("multiple-appellation-")) {
              const value = state.data[key];
              if (value) acc[key] = value;
            }
            return acc;
          },
          {} as Record<string, AutocompleteItem<AppellationAndRomeDto>>,
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
      action: PayloadActionWithLocator<AppellationAutocompleteLocator>,
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
        AppellationAutocompleteLocator,
        { lookup: string }
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
        AppellationAutocompleteLocator,
        { lookup: string }
      >,
    ) => {
      const { locator } = action.payload;
      state.data[locator] = {
        ...initialAutocompleteItem,
        ...state.data[locator],
        query: action.payload.lookup,
        isLoading: true,
        isDebouncing: false,
      };
    },
    fetchSuggestionsSucceeded: (
      state,
      action: PayloadActionWithLocator<
        AppellationAutocompleteLocator,
        {
          suggestions: AppellationAndRomeDto[];
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
          },
        },
      };
    },
    fetchSuggestionsFailed: (
      state,
      action: PayloadActionWithLocator<AppellationAutocompleteLocator>,
    ) => {
      const { locator } = action.payload;
      return {
        ...state,
        data: {
          ...state.data,
          [locator]: {
            ...state.data[locator],
            isLoading: false,
          },
        },
      };
    },
    selectSuggestionRequested: (
      state,
      action: PayloadActionWithLocator<
        AppellationAutocompleteLocator,
        {
          item: AppellationAndRomeDto;
        }
      >,
    ) => {
      const { locator } = action.payload;
      return {
        ...state,
        data: {
          ...state.data,
          [locator]: {
            ...state.data[locator],
            value: action.payload.item,
          },
        },
      };
    },
  },
});

const getMultipleAppellationLocatorIndex = (
  locator: MultipleAppellationAutocompleteLocator,
): number => {
  return Number.parseInt(locator.substring(locator.lastIndexOf("-") + 1), 10);
};
