import { createSelector } from "@reduxjs/toolkit";
import type { RootState } from "src/core-logic/storeConfig/store";

const updateUserPreventToDeleteState = ({ admin }: RootState) =>
  admin.updateUserPreventToDelete;

const isLoading = createSelector(
  updateUserPreventToDeleteState,
  ({ isLoading }) => isLoading,
);

export const updateUserPreventToDeleteSelectors = {
  isLoading,
};
