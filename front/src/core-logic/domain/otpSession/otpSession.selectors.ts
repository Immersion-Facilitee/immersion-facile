import { createSelector } from "@reduxjs/toolkit";
import type { RootState } from "src/core-logic/storeConfig/store";

const otpSessionState = (state: RootState) => state.otpSession;

const activeSession = createSelector(
  otpSessionState,
  ({ activeSession }) => activeSession,
);

const isOtpRequired = createSelector(
  otpSessionState,
  ({ hasCheckedSession, isLoading, activeSession }) =>
    hasCheckedSession && !isLoading && activeSession === null,
);

export const otpSessionSelectors = {
  activeSession,
  isOtpRequired,
};
