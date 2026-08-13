import { createSelector } from "@reduxjs/toolkit";
import type { RootState } from "src/core-logic/storeConfig/store";

const agencyState = ({ admin }: RootState) => admin.agencyAdmin;

export const agencyAdminSelectors = {
  agencyOptions: createSelector(
    agencyState,
    ({ agencyOptions }) => agencyOptions,
  ),
  isLoading: createSelector(agencyState, ({ isLoading }) => isLoading),
};
