import { createSlice } from "@reduxjs/toolkit";
import {
  type AgencyUserConventionListDto,
  type ConventionWithUnfinalizedAssessment,
  type DataWithPagination,
  type FlatGetConventionsForAgencyUserParams,
  type FlatGetConventionsWithUnfinalizedAssessmentParams,
  NUMBER_ITEM_TO_DISPLAY_IN_PAGINATED_PAGE,
  type Pagination,
} from "shared";
import type {
  PayloadActionWithFeedbackTopic,
  PayloadActionWithFeedbackTopicError,
} from "src/core-logic/domain/feedback/feedback.slice";

export type FetchConventionsWithUnfinalizedAssessmentRequestedPayload = {
  jwt: string;
  filters: FlatGetConventionsWithUnfinalizedAssessmentParams;
};

type ConnectedUserConventionsToManageState = {
  conventions: AgencyUserConventionListDto[];
  isLoading: boolean;
  pagination: Pagination | undefined;
  conventionsWithUnfinalizedAssessment: ConventionWithUnfinalizedAssessment[];
  conventionsWithUnfinalizedAssessmentPagination: Pagination | undefined;
  conventionsWithUnfinalizedAssessmentFilters: FlatGetConventionsWithUnfinalizedAssessmentParams;
  isLoadingConventionsWithUnfinalizedAssessment: boolean;
};

export const initialConventionsWithUnfinalizedAssessmentFilters: FlatGetConventionsWithUnfinalizedAssessmentParams =
  {
    page: 1,
    perPage: NUMBER_ITEM_TO_DISPLAY_IN_PAGINATED_PAGE,
  };

export const connectedUserConventionsToManageInitialState: ConnectedUserConventionsToManageState =
  {
    conventions: [],
    isLoading: false,
    pagination: undefined,
    conventionsWithUnfinalizedAssessment: [],
    conventionsWithUnfinalizedAssessmentPagination: undefined,
    conventionsWithUnfinalizedAssessmentFilters:
      initialConventionsWithUnfinalizedAssessmentFilters,
    isLoadingConventionsWithUnfinalizedAssessment: false,
  };

export const connectedUserConventionsToManageSlice = createSlice({
  name: "connectedUserConventionsToManage",
  initialState: connectedUserConventionsToManageInitialState,
  reducers: {
    getConventionsForConnectedUserRequested: (
      state,
      _action: PayloadActionWithFeedbackTopic<{
        params: FlatGetConventionsForAgencyUserParams;
        jwt: string;
      }>,
    ) => {
      state.isLoading = true;
    },
    getConventionsForConnectedUserSucceeded: (
      state,
      action: PayloadActionWithFeedbackTopic<
        DataWithPagination<AgencyUserConventionListDto>
      >,
    ) => {
      state.isLoading = false;
      state.conventions = action.payload.data;
      state.pagination = action.payload.pagination;
    },
    getConventionsForConnectedUserFailed: (
      state,
      _action: PayloadActionWithFeedbackTopicError,
    ) => {
      state.isLoading = false;
    },
    getConventionsWithUnfinalizedAssessmentRequested: (
      state,
      action: PayloadActionWithFeedbackTopic<FetchConventionsWithUnfinalizedAssessmentRequestedPayload>,
    ) => {
      state.isLoadingConventionsWithUnfinalizedAssessment = true;
      state.conventionsWithUnfinalizedAssessmentFilters = action.payload.filters;
    },
    getConventionsWithUnfinalizedAssessmentSucceeded: (
      state,
      action: PayloadActionWithFeedbackTopic<
        DataWithPagination<ConventionWithUnfinalizedAssessment>
      >,
    ) => {
      state.isLoadingConventionsWithUnfinalizedAssessment = false;
      state.conventionsWithUnfinalizedAssessment = action.payload.data;
      state.conventionsWithUnfinalizedAssessmentPagination =
        action.payload.pagination;
    },
    getConventionsWithUnfinalizedAssessmentFailed: (
      state,
      _action: PayloadActionWithFeedbackTopicError,
    ) => {
      state.isLoadingConventionsWithUnfinalizedAssessment = false;
    },
    clearConventionsWithUnfinalizedAssessment: (state) => {
      state.conventionsWithUnfinalizedAssessment = [];
      state.conventionsWithUnfinalizedAssessmentPagination = undefined;
      state.conventionsWithUnfinalizedAssessmentFilters =
        initialConventionsWithUnfinalizedAssessmentFilters;
    },
  },
});
