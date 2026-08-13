import { createSelector } from "@reduxjs/toolkit";
import type { RootState } from "src/core-logic/storeConfig/store";

const fetchAgencyOptionsState = ({ fetchAgencyOptions }: RootState) =>
  fetchAgencyOptions;

export const fetchAgencyOptionsSelectors = {
  agencyOptions: createSelector(
    fetchAgencyOptionsState,
    ({ agencyOptions }) => agencyOptions,
  ),
  isLoading: createSelector(
    fetchAgencyOptionsState,
    ({ isLoading }) => isLoading,
  ),
};
