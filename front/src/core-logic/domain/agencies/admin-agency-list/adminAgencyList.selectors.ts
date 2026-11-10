import { createSelector } from "@reduxjs/toolkit";
import type { AdminAgencyListState } from "src/core-logic/domain/agencies/admin-agency-list/adminAgencyList.slice";
import type { RootState } from "src/core-logic/storeConfig/store";

const adminAgencyListState = ({ agency }: RootState): AdminAgencyListState =>
  agency.adminAgencyList;

export const adminAgencyListSelectors = {
  isLoading: createSelector(adminAgencyListState, ({ isLoading }) => isLoading),
  adminAgencyList: createSelector(
    adminAgencyListState,
    ({ data, pagination, filters }) => ({ data, pagination, filters }),
  ),
};
