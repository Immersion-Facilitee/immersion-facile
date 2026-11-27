import { createSelector } from "@reduxjs/toolkit";
import type { RootState } from "src/core-logic/storeConfig/store";

const otpSessionState = (state: RootState) => state.otpSession;

const activeSession = createSelector(
  otpSessionState,
  ({ activeSession }) => activeSession,
);

const isLoading = createSelector(
  otpSessionState,
  ({ isLoading, hasCheckedSession }) => isLoading || !hasCheckedSession,
);

export const otpSessionSelectors = {
  activeSession,
  isLoading,
};
