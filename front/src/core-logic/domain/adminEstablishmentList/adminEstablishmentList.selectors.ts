import { createSelector } from "@reduxjs/toolkit";
import type { AdminEstablishmentListState } from "src/core-logic/domain/adminEstablishmentList/adminEstablishmentList.slice";
import type { RootState } from "src/core-logic/storeConfig/store";

const adminEstablishmentListState = ({
  adminEstablishmentList,
}: RootState): AdminEstablishmentListState => adminEstablishmentList;

export const adminEstablishmentListSelectors = {
  isLoading: createSelector(
    adminEstablishmentListState,
    ({ isLoading }) => isLoading,
  ),
  adminEstablishmentList: createSelector(
    adminEstablishmentListState,
    ({ data, pagination, filters }) => ({ data, pagination, filters }),
  ),
};
