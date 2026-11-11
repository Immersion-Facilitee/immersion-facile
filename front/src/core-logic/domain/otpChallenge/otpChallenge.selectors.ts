import { createSelector } from "@reduxjs/toolkit";
import type { RootState } from "src/core-logic/storeConfig/store";

const otpChallengeState = (state: RootState) => state.otpChallenge;

const maskedRecipients = createSelector(
  otpChallengeState,
  ({ maskedRecipients }) => maskedRecipients,
);

const isCodeSent = createSelector(
  otpChallengeState,
  ({ isCodeSent }) => isCodeSent,
);

const isVerified = createSelector(
  otpChallengeState,
  ({ isVerified }) => isVerified,
);

const isLoading = createSelector(
  otpChallengeState,
  ({ isLoading }) => isLoading,
);

export const otpChallengeSelectors = {
  maskedRecipients,
  isCodeSent,
  isVerified,
  isLoading,
};
