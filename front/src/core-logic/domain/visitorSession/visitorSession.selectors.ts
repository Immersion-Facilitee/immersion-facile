import { createSelector } from "@reduxjs/toolkit";
import type { RootState } from "src/core-logic/storeConfig/store";

const visitorSessionState = (state: RootState) => state.visitorSession;

const isLoading = createSelector(
  visitorSessionState,
  ({ isLoading }) => isLoading,
);

const activeSession = createSelector(
  visitorSessionState,
  ({ activeSession }) => activeSession,
);

const needsOtp = createSelector(
  visitorSessionState,
  ({ needsOtp }) => needsOtp,
);

export const visitorSessionSelectors = {
  isLoading,
  activeSession,
  needsOtp,
};
