import { createSelector } from "@reduxjs/toolkit";
import type { RootState } from "src/core-logic/storeConfig/store";

const usersToReviewState = (rootState: RootState) => rootState.usersToReview;

const usersToReview = createSelector(
  usersToReviewState,
  (state) => state.usersToReview,
);

const isLoading = createSelector(
  usersToReviewState,
  (state) => state.isLoading,
);

export const usersToReviewSelectors = {
  usersToReview,
  isLoading,
};
