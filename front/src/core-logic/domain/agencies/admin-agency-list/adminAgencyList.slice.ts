import { createSlice } from "@reduxjs/toolkit";
import {
  type AdminAgencyListItemDto,
  type ConnectedUserJwt,
  type DataWithPagination,
  defaultPerPageInWebPagination,
  type GetAgenciesForAdminParams,
} from "shared";
import type {
  PayloadActionWithFeedbackTopic,
  PayloadActionWithFeedbackTopicError,
} from "src/core-logic/domain/feedback/feedback.slice";

type FetchAdminAgencyListRequestedPayload = {
  jwt: ConnectedUserJwt;
  filters: GetAgenciesForAdminParams;
};

export type AdminAgencyListState =
  DataWithPagination<AdminAgencyListItemDto> & {
    isLoading: boolean;
    filters: GetAgenciesForAdminParams;
  };

export const initialAdminAgencyListFilters: GetAgenciesForAdminParams = {
  statuses: ["needsReview"],
  page: 1,
  perPage: defaultPerPageInWebPagination,
};

export const adminAgencyListInitialState: AdminAgencyListState = {
  isLoading: false,
  data: [],
  pagination: {
    totalRecords: 0,
    currentPage: 1,
    totalPages: 1,
    numberPerPage: defaultPerPageInWebPagination,
  },
  filters: initialAdminAgencyListFilters,
};

export const adminAgencyListSlice = createSlice({
  name: "adminAgencyList",
  initialState: adminAgencyListInitialState,
  reducers: {
    fetchAdminAgencyListRequested: (
      state,
      action: PayloadActionWithFeedbackTopic<FetchAdminAgencyListRequestedPayload>,
    ) => {
      state.isLoading = true;
      state.filters = action.payload.filters;
    },
    fetchAdminAgencyListSucceeded: (
      state,
      action: PayloadActionWithFeedbackTopic<{
        adminAgencyList: DataWithPagination<AdminAgencyListItemDto>;
      }>,
    ) => {
      state.isLoading = false;
      state.data = action.payload.adminAgencyList.data;
      state.pagination = action.payload.adminAgencyList.pagination;
    },
    fetchAdminAgencyListFailed: (
      state,
      _action: PayloadActionWithFeedbackTopicError,
    ) => {
      state.isLoading = false;
    },
    clearAdminAgencyListRequested: () => adminAgencyListInitialState,
  },
});
