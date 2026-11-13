import { createSelector } from "@reduxjs/toolkit";
import type { RootState } from "src/core-logic/storeConfig/store";

const visitorSessionState = (state: RootState) => state.visitorSession;

const activeSession = createSelector(visitorSessionState, (visitorSession) =>
  visitorSession.status === "active" ? visitorSession.activeSession : null,
);

const isOtpRequired = createSelector(
  visitorSessionState,
  ({ status }) => status === "otpRequired",
);

export const visitorSessionSelectors = {
  activeSession,
  isOtpRequired,
};
