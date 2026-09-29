import { createSelector } from "@reduxjs/toolkit";
import type { RootState } from "src/core-logic/storeConfig/store";

const conventionListState = (state: RootState) => state.conventionList;

export const conventionListSelectors = {
  isLoading: createSelector(conventionListState, ({ isLoading }) => isLoading),
  beneficiaryConventionList: createSelector(
    conventionListState,
    ({ beneficiaryConventionList }) => beneficiaryConventionList,
  ),
  conventionsWithPagination: createSelector(
    conventionListState,
    ({ conventionsWithPagination }) => conventionsWithPagination,
  ),
  establishmentConventionList: createSelector(
    conventionListState,
    ({ establishmentConventionList }) => establishmentConventionList,
  ),
};
