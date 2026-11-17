import { createSelector } from "@reduxjs/toolkit";
import type { AdminEventListState } from "src/core-logic/domain/admin/adminEventList/adminEventList.slice";
import type { RootState } from "src/core-logic/storeConfig/store";

const adminEventListState = ({ admin }: RootState): AdminEventListState =>
  admin.adminEventList;

export const adminEventListSelectors = {
  isLoading: createSelector(adminEventListState, ({ isLoading }) => isLoading),
  adminEventList: createSelector(
    adminEventListState,
    ({ data, pagination, filters }) => ({ data, pagination, filters }),
  ),
};
