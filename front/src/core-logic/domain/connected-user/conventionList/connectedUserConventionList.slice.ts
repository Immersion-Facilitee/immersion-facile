import { createSlice } from "@reduxjs/toolkit";
import {
  type AdminConventionListDto,
  type AgencyUserConventionListDto,
  type BeneficiaryConventionListDto,
  type ConnectedUserJwt,
  type DataWithPagination,
  defaultPerPageInWebPagination,
  type EstablishmentUserConventionListDto,
  type FlatGetBeneficiaryConventionListParams,
  type FlatGetConventionsForAdminParams,
  type FlatGetConventionsForAgencyUserParams,
  type FlatGetConventionsForEstablishmentUserParams,
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

export type FetchEstablishmentConventionListRequestedPayload = {
  jwt: ConnectedUserJwt;
  filters: FlatGetConventionsForEstablishmentUserParams;
};

export type FetchAdminConventionListRequestedPayload = {
  jwt: ConnectedUserJwt;
  filters: FlatGetConventionsForAdminParams;
};

export type AdminConventionListState =
  DataWithPagination<AdminConventionListDto> & {
    filters: FlatGetConventionsForAdminParams;
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
  establishmentConventionList: DataWithPagination<EstablishmentUserConventionListDto> & {
    filters: FlatGetConventionsForEstablishmentUserParams;
  };
  adminConventionList: AdminConventionListState;
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

export const initialEstablishmentConventionList: DataWithPagination<EstablishmentUserConventionListDto> & {
  filters: FlatGetConventionsForEstablishmentUserParams;
} = {
  data: [],
  pagination: {
    totalRecords: 0,
    currentPage: 1,
    totalPages: 1,
    numberPerPage: 10,
  },
  filters: {
    page: 1,
    perPage: 10,
  },
};

export const initialAdminConventionList: AdminConventionListState = {
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
  establishmentConventionList: initialEstablishmentConventionList,
  adminConventionList: initialAdminConventionList,
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

    fetchEstablishmentConventionListRequested: (
      state,
      action: PayloadActionWithFeedbackTopic<FetchEstablishmentConventionListRequestedPayload>,
    ) => {
      state.isLoading = true;
      state.establishmentConventionList = {
        ...state.establishmentConventionList,
        filters: action.payload.filters,
      };
    },
    fetchEstablishmentConventionListSucceeded: (
      state,
      action: PayloadActionWithFeedbackTopic<{
        establishmentConventionList: DataWithPagination<EstablishmentUserConventionListDto>;
      }>,
    ) => {
      state.establishmentConventionList = {
        ...state.establishmentConventionList,
        ...action.payload.establishmentConventionList,
      };
      state.isLoading = false;
    },
    fetchEstablishmentConventionListFailed: (
      state,
      _action: PayloadActionWithFeedbackTopicError,
    ) => {
      state.isLoading = false;
    },

    clearEstablishmentConventionListRequested: (state) => {
      state.establishmentConventionList = initialEstablishmentConventionList;
    },

    fetchAdminConventionListRequested: (
      state,
      action: PayloadActionWithFeedbackTopic<FetchAdminConventionListRequestedPayload>,
    ) => {
      state.isLoading = true;
      state.adminConventionList = {
        ...state.adminConventionList,
        filters: action.payload.filters,
      };
    },
    fetchAdminConventionListSucceeded: (
      state,
      action: PayloadActionWithFeedbackTopic<{
        adminConventionList: DataWithPagination<AdminConventionListDto>;
      }>,
    ) => {
      state.adminConventionList = {
        ...state.adminConventionList,
        ...action.payload.adminConventionList,
      };
      state.isLoading = false;
    },
    fetchAdminConventionListFailed: (
      state,
      _action: PayloadActionWithFeedbackTopicError,
    ) => {
      state.isLoading = false;
    },

    clearAdminConventionListRequested: (state) => {
      state.adminConventionList = initialAdminConventionList;
    },
  },
});
