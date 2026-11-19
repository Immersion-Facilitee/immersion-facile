import { createSelector } from "@reduxjs/toolkit";
import type { RootState } from "src/core-logic/storeConfig/store";

const otpSessionState = (state: RootState) => state.otpSession;

const activeSession = createSelector(otpSessionState, (otpSession) =>
  otpSession.status === "active" ? otpSession.activeSession : null,
);

const isOtpRequired = createSelector(
  otpSessionState,
  ({ status }) => status === "otpRequired",
);

export const otpSessionSelectors = {
  activeSession,
  isOtpRequired,
};
