import { createSlice } from "@reduxjs/toolkit";
import {
  type AgencyUserConventionListDto,
  type BeneficiaryConventionListDto,
  type ConnectedUserJwt,
  type DataWithPagination,
  defaultPerPageInWebPagination,
  type FlatGetBeneficiaryConventionListParams,
  type FlatGetConventionsForAgencyUserParams,
} from "shared";

import type {
  PayloadActionWithFeedbackTopic,
  PayloadActionWithFeedbackTopicError,
} from "src/core-logic/domain/feedback/feedback.slice";

export type FetchConventionListRequestedPayload = {
  jwt: ConnectedUserJwt;
  filters: FlatGetConventionsForAgencyUserParams;
};

export type FetchBeneficiaryConventionListRequestedPayload = {
  jwt: ConnectedUserJwt;
  filters: FlatGetBeneficiaryConventionListParams;
};

export type BeneficiaryConventionListState = BeneficiaryConventionListDto & {
  filters: FlatGetBeneficiaryConventionListParams;
};

export type ConventionListState = {
  isLoading: boolean;
  conventionsWithPagination: DataWithPagination<AgencyUserConventionListDto> & {
    filters: FlatGetConventionsForAgencyUserParams;
  };
  beneficiaryConventionList: BeneficiaryConventionListState;
};

export const initialConventionWithPagination: DataWithPagination<AgencyUserConventionListDto> & {
  filters: FlatGetConventionsForAgencyUserParams;
} = {
  data: [],
  pagination: {
    totalRecords: 0,
    currentPage: 1,
    totalPages: 1,
    numberPerPage: defaultPerPageInWebPagination,
  },
  filters: {
    sortBy: "dateSubmission",
    sortDirection: "desc",
    page: 1,
    perPage: defaultPerPageInWebPagination,
  },
};

export const initialBeneficiaryConventionList: BeneficiaryConventionListState =
  {
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

const initialConventionListState: ConventionListState = {
  isLoading: false,
  conventionsWithPagination: initialConventionWithPagination,
  beneficiaryConventionList: initialBeneficiaryConventionList,
};

export const conventionListSlice = createSlice({
  name: "conventionList",
  initialState: initialConventionListState,
  reducers: {
    fetchConventionListRequested: (
      state,
      action: PayloadActionWithFeedbackTopic<FetchConventionListRequestedPayload>,
    ) => {
      state.isLoading = true;
      state.conventionsWithPagination = {
        ...state.conventionsWithPagination,
        filters: action.payload.filters,
      };
    },
    fetchConventionListSucceeded: (
      state,
      action: PayloadActionWithFeedbackTopic<{
        conventionsWithPagination: DataWithPagination<AgencyUserConventionListDto>;
      }>,
    ) => {
      state.conventionsWithPagination = {
        ...state.conventionsWithPagination,
        ...action.payload.conventionsWithPagination,
      };
      state.isLoading = false;
    },
    fetchConventionListFailed: (
      state,
      _action: PayloadActionWithFeedbackTopicError,
    ) => {
      state.isLoading = false;
    },

    clearConventionListFilters: (state) => {
      state.conventionsWithPagination = initialConventionWithPagination;
    },

    fetchBeneficiaryConventionListRequested: (
      state,
      action: PayloadActionWithFeedbackTopic<FetchBeneficiaryConventionListRequestedPayload>,
    ) => {
      state.isLoading = true;
      state.beneficiaryConventionList = {
        ...state.beneficiaryConventionList,
        filters: action.payload.filters,
      };
    },
    fetchBeneficiaryConventionListSucceeded: (
      state,
      action: PayloadActionWithFeedbackTopic<{
        beneficiaryConventionList: BeneficiaryConventionListDto;
      }>,
    ) => {
      state.beneficiaryConventionList = {
        ...state.beneficiaryConventionList,
        ...action.payload.beneficiaryConventionList,
      };
      state.isLoading = false;
    },
    fetchBeneficiaryConventionListFailed: (
      state,
      _action: PayloadActionWithFeedbackTopicError,
    ) => {
      state.isLoading = false;
    },

    clearBeneficiaryConventionListRequested: (state) => {
      state.beneficiaryConventionList = initialBeneficiaryConventionList;
    },
  },
});
