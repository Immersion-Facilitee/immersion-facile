import { createSlice } from "@reduxjs/toolkit";
import {
  type AdminEstablishmentListItemDto,
  adminEstablishmentListDefaultPerPage,
  type ConnectedUserJwt,
  type DataWithPagination,
  type GetEstablishmentsForAdminParams,
} from "shared";
import type {
  PayloadActionWithFeedbackTopic,
  PayloadActionWithFeedbackTopicError,
} from "src/core-logic/domain/feedback/feedback.slice";

type FetchAdminEstablishmentListRequestedPayload = {
  jwt: ConnectedUserJwt;
  filters: GetEstablishmentsForAdminParams;
};

export type AdminEstablishmentListState =
  DataWithPagination<AdminEstablishmentListItemDto> & {
    isLoading: boolean;
    filters: GetEstablishmentsForAdminParams;
  };

export const initialAdminEstablishmentListFilters: GetEstablishmentsForAdminParams =
  {
    page: 1,
    perPage: adminEstablishmentListDefaultPerPage,
  };

export const adminEstablishmentListInitialState: AdminEstablishmentListState = {
  isLoading: false,
  data: [],
  pagination: {
    totalRecords: 0,
    currentPage: 1,
    totalPages: 1,
    numberPerPage: adminEstablishmentListDefaultPerPage,
  },
  filters: initialAdminEstablishmentListFilters,
};

export const adminEstablishmentListSlice = createSlice({
  name: "adminEstablishmentList",
  initialState: adminEstablishmentListInitialState,
  reducers: {
    fetchAdminEstablishmentListRequested: (
      state,
      action: PayloadActionWithFeedbackTopic<FetchAdminEstablishmentListRequestedPayload>,
    ) => {
      state.isLoading = true;
      state.filters = action.payload.filters;
    },
    fetchAdminEstablishmentListSucceeded: (
      state,
      action: PayloadActionWithFeedbackTopic<{
        adminEstablishmentList: DataWithPagination<AdminEstablishmentListItemDto>;
      }>,
    ) => {
      state.isLoading = false;
      state.data = action.payload.adminEstablishmentList.data;
      state.pagination = action.payload.adminEstablishmentList.pagination;
    },
    fetchAdminEstablishmentListFailed: (
      state,
      _action: PayloadActionWithFeedbackTopicError,
    ) => {
      state.isLoading = false;
    },
    clearAdminEstablishmentListRequested: () =>
      adminEstablishmentListInitialState,
  },
});
