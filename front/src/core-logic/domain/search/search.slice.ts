import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type {
  AppellationAndRomeDto,
  DataWithPagination,
  GetOffersFlatQueryParams,
  OfferDto,
  SearchResultQuery,
  SiretAndAppellationDto,
  WithAcquisition,
} from "shared";
import type {
  PayloadActionWithFeedbackTopic,
  PayloadActionWithFeedbackTopicError,
} from "src/core-logic/domain/feedback/feedback.slice";

export type SearchResultPayload = SearchResultQuery | OfferDto;

export type GetOffersPayload = SearchPageParams & { isExternal?: boolean };

export type SearchPageParams = GetOffersFlatQueryParams & {
  appellations?: AppellationAndRomeDto[];
  nafLabel?: string;
} & WithAcquisition;

type SearchState = {
  searchResultsWithPagination: DataWithPagination<OfferDto>;
  currentSearchResult: OfferDto | null;
  isLoading: boolean;
  searchParams: SearchPageParams;
};

const emptySearchResult: DataWithPagination<OfferDto> = {
  data: [],
  pagination: {
    totalPages: 1,
    currentPage: 1,
    numberPerPage: 12,
    totalRecords: 0,
  },
};

export const minimalInitialSearchParams: SearchPageParams = {
  sortBy: "score",
  sortOrder: "desc",
  showOnlyAvailableOffers: true,
};

const initialSearchParams: SearchPageParams = {
  ...minimalInitialSearchParams,
  appellationCodes: [],
  distanceKm: 10,
  latitude: 0,
  longitude: 0,
  fitForDisabledWorkers: undefined,
  page: 1,
  perPage: 12,
};

export const initialState: SearchState = {
  searchResultsWithPagination: emptySearchResult,
  currentSearchResult: null,
  isLoading: false,
  searchParams: initialSearchParams,
};

export const searchSlice = createSlice({
  name: "search",
  initialState,
  reducers: {
    getOffersRequested: (state, action: PayloadAction<GetOffersPayload>) => {
      state.searchResultsWithPagination = emptySearchResult;
      state.searchParams = action.payload;
      state.isLoading = true;
    },
    getOffersSucceeded: (
      state,
      action: PayloadAction<{
        searchResultsWithPagination: DataWithPagination<OfferDto>;
        searchParams: GetOffersFlatQueryParams;
      }>,
    ) => {
      state.searchResultsWithPagination =
        action.payload.searchResultsWithPagination;
      state.isLoading = false;
    },
    getOffersFailed: (
      state,
      _action: PayloadAction<{ errorMessage: string }>,
    ) => {
      state.searchResultsWithPagination = emptySearchResult;
      state.isLoading = false;
    },
    fetchSearchResultRequested: (
      state,
      _action: PayloadActionWithFeedbackTopic<{
        searchResult: SearchResultPayload;
      }>,
    ) => {
      state.isLoading = true;
    },
    externalSearchResultRequested: (
      state,
      _action: PayloadActionWithFeedbackTopic<{
        siretAndAppellation: SiretAndAppellationDto;
      }>,
    ) => {
      state.isLoading = true;
    },
    fetchSearchResultSucceeded: (state, action: PayloadAction<OfferDto>) => {
      state.currentSearchResult = action.payload;
      state.isLoading = false;
    },
    fetchSearchResultFailed: (
      state,
      _action: PayloadActionWithFeedbackTopicError,
    ) => {
      state.isLoading = false;
    },
  },
});
