import { createSelector } from "@reduxjs/toolkit";
import { createRootSelector } from "src/core-logic/storeConfig/store";

const groupState = createRootSelector((state) => state.group);

const isLoading = createSelector(groupState, ({ isLoading }) => isLoading);
const currentGroup = createSelector(
  groupState,
  ({ currentGroup }) => currentGroup,
);

export const groupSelectors = {
  isLoading,
  currentGroup,
};
