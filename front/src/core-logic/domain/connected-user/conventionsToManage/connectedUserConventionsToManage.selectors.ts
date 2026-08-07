import { createSelector } from "@reduxjs/toolkit";
import { createRootSelector } from "src/core-logic/storeConfig/store";

const connectedUserConventionsToManageState = createRootSelector(
  (state) => state.connectedUserConventionsToManage,
);

const conventions = createSelector(
  connectedUserConventionsToManageState,
  (state) => state.conventions,
);

const pagination = createSelector(
  connectedUserConventionsToManageState,
  (state) => state.pagination,
);

const isLoading = createSelector(
  connectedUserConventionsToManageState,
  (state) => state.isLoading,
);

const conventionsWithUnfinalizedAssessment = createSelector(
  connectedUserConventionsToManageState,
  (state) => state.conventionsWithUnfinalizedAssessment,
);

const conventionsWithUnfinalizedAssessmentPagination = createSelector(
  connectedUserConventionsToManageState,
  (state) => state.conventionsWithUnfinalizedAssessmentPagination,
);

const conventionsWithUnfinalizedAssessmentFilters = createSelector(
  connectedUserConventionsToManageState,
  (state) => state.conventionsWithUnfinalizedAssessmentFilters,
);

const isLoadingConventionsWithUnfinalizedAssessment = createSelector(
  connectedUserConventionsToManageState,
  (state) => state.isLoadingConventionsWithUnfinalizedAssessment,
);

export const connectedUserConventionsToManageSelectors = {
  conventions,
  isLoading,
  pagination,
  conventionsWithUnfinalizedAssessment,
  conventionsWithUnfinalizedAssessmentPagination,
  conventionsWithUnfinalizedAssessmentFilters,
  isLoadingConventionsWithUnfinalizedAssessment,
};
