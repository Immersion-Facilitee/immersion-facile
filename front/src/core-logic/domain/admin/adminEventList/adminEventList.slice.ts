import { createSlice } from "@reduxjs/toolkit";
import {
  type AdminEventListItemDto,
  type ConnectedUserJwt,
  type DataWithPagination,
  defaultPerPageInWebPagination,
  type GetEventsForAdminParams,
} from "shared";
import type {
  PayloadActionWithFeedbackTopic,
  PayloadActionWithFeedbackTopicError,
} from "src/core-logic/domain/feedback/feedback.slice";

type FetchAdminEventListRequestedPayload = {
  jwt: ConnectedUserJwt;
  filters: GetEventsForAdminParams;
};

export type AdminEventListState = DataWithPagination<AdminEventListItemDto> & {
  isLoading: boolean;
  filters: GetEventsForAdminParams;
};

export const adminEventListInitialState: AdminEventListState = {
  isLoading: false,
  data: [],
  pagination: {
    totalRecords: 0,
    currentPage: 1,
    totalPages: 1,
    numberPerPage: defaultPerPageInWebPagination,
  },
  filters: {
    search: "",
    page: 1,
    perPage: defaultPerPageInWebPagination,
  },
};

export const adminEventListSlice = createSlice({
  name: "adminEventList",
  initialState: adminEventListInitialState,
  reducers: {
    fetchAdminEventListRequested: (
      state,
      action: PayloadActionWithFeedbackTopic<FetchAdminEventListRequestedPayload>,
    ) => {
      state.isLoading = true;
      state.filters = action.payload.filters;
    },
    fetchAdminEventListSucceeded: (
      state,
      action: PayloadActionWithFeedbackTopic<{
        adminEventList: DataWithPagination<AdminEventListItemDto>;
      }>,
    ) => {
      state.isLoading = false;
      state.data = action.payload.adminEventList.data;
      state.pagination = action.payload.adminEventList.pagination;
    },
    fetchAdminEventListFailed: (
      state,
      _action: PayloadActionWithFeedbackTopicError,
    ) => {
      state.isLoading = false;
    },
    clearAdminEventListRequested: () => adminEventListInitialState,
  },
});
