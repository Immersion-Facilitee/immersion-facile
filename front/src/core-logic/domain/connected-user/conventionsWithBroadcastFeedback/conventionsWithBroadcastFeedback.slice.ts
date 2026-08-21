import { createSlice } from "@reduxjs/toolkit";
import {
  type DataWithPagination,
  defaultPerPageInWebPagination,
  type FlatGetConventionsWithErroredBroadcastFeedbackParams,
} from "shared";
import type {
  PayloadActionWithFeedbackTopic,
  PayloadActionWithFeedbackTopicError,
} from "src/core-logic/domain/feedback/feedback.slice";
import type { ConventionWithBroadcastFeedbackReadDto } from "../../../../../../shared/src/convention/conventionWithBroadcastFeedback.dto";

export type FetchConventionsWithErroredBroadcastFeedbackRequestedPayload = {
  jwt: string;
  filters: FlatGetConventionsWithErroredBroadcastFeedbackParams;
};

export type ConventionsWithBroadcastFeedbackState = {
  isLoading: boolean;
  erroredBroadcastConventionsWithPagination: DataWithPagination<ConventionWithBroadcastFeedbackReadDto> & {
    filters: FlatGetConventionsWithErroredBroadcastFeedbackParams;
  };
};

export const initialConventionsWithPagination: DataWithPagination<ConventionWithBroadcastFeedbackReadDto> & {
  filters: FlatGetConventionsWithErroredBroadcastFeedbackParams;
} = {
  data: [],
  pagination: {
    totalRecords: 0,
    currentPage: 1,
    totalPages: 1,
    numberPerPage: defaultPerPageInWebPagination,
  },
  filters: {
    page: 1,
    perPage: defaultPerPageInWebPagination,
  },
};

const initialState: ConventionsWithBroadcastFeedbackState = {
  isLoading: false,
  erroredBroadcastConventionsWithPagination: initialConventionsWithPagination,
};

export const conventionsWithBroadcastFeedbackSlice = createSlice({
  name: "conventionsWithBroadcastFeedback",
  initialState,
  reducers: {
    getConventionsWithErroredBroadcastFeedbackRequested: (
      state,
      action: PayloadActionWithFeedbackTopic<FetchConventionsWithErroredBroadcastFeedbackRequestedPayload>,
    ) => {
      state.isLoading = true;
      state.erroredBroadcastConventionsWithPagination = {
        ...state.erroredBroadcastConventionsWithPagination,
        filters: action.payload.filters,
      };
    },
    getConventionsWithErroredBroadcastFeedbackSucceeded: (
      state,
      action: PayloadActionWithFeedbackTopic<
        DataWithPagination<ConventionWithBroadcastFeedbackReadDto>
      >,
    ) => {
      state.isLoading = false;
      state.erroredBroadcastConventionsWithPagination = {
        ...state.erroredBroadcastConventionsWithPagination,
        ...action.payload,
      };
    },
    getConventionsWithErroredBroadcastFeedbackFailed: (
      state,
      _action: PayloadActionWithFeedbackTopicError,
    ) => {
      state.isLoading = false;
    },
    clearConventionsWithBroadcastFeedbackFilters: (state) => {
      state.erroredBroadcastConventionsWithPagination =
        initialConventionsWithPagination;
    },
  },
});
