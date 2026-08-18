import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import {
  type FeatureFlags,
  makeBooleanFeatureFlag,
  makeHighlightFeatureFlag,
  makeTextImageAndRedirectFeatureFlag,
  makeTextWithSeverityFeatureFlag,
  type SetFeatureFlagParam,
} from "shared";

export type FeatureFlagsState = FeatureFlags & {
  isLoading: boolean;
};

const initialState: FeatureFlagsState = {
  enableTemporaryOperation: makeTextImageAndRedirectFeatureFlag(false, {
    message: "",
    imageAlt: "",
    imageUrl: "https://",
    redirectUrl: "https://",
    overtitle: "",
    title: "",
  }),
  enableMaintenance: makeTextWithSeverityFeatureFlag(false, {
    message: "",
    severity: "warning",
  }),
  enableSearchByScore: makeBooleanFeatureFlag(false),
  enableBroadcastOfConseilDepartementalToFT: makeBooleanFeatureFlag(false),
  enableBroadcastOfCapEmploiToFT: makeBooleanFeatureFlag(false),
  enableBroadcastOfMissionLocaleToFT: makeBooleanFeatureFlag(false),
  enableEstablishmentDashboardHighlight: makeHighlightFeatureFlag(false, {
    title: "",
    message: "",
    href: "",
    label: "",
  }),
  enableAgencyDashboardHighlight: makeHighlightFeatureFlag(false, {
    title: "",
    message: "",
    href: "",
    label: "",
  }),
  enableInactiveUsersCleanup: makeBooleanFeatureFlag(false),
  enableInactiveUsersDeletionAutoProcessing: makeBooleanFeatureFlag(false),
  enableRequestArchivedConvention: makeBooleanFeatureFlag(false),
  enableBeneficiaryManageConvention: makeBooleanFeatureFlag(false),
  isLoading: true,
};

export const featureFlagsSlice = createSlice({
  name: "featureFlags",
  initialState,
  reducers: {
    retrieveFeatureFlagsRequested: (state) => state,
    retrieveFeatureFlagsSucceeded: (
      _,
      action: PayloadAction<FeatureFlags>,
    ): FeatureFlagsState => ({
      ...action.payload,
      isLoading: false,
    }),
    retrieveFeatureFlagsFailed: (
      state,
      _action: PayloadAction<{
        feedbackTopic: "feature-flags-global";
        errorMessage: string;
      }>,
    ): FeatureFlagsState => ({
      ...state,
      isLoading: false,
    }),
    setFeatureFlagRequested: (
      state,
      action: PayloadAction<SetFeatureFlagParam>,
    ): FeatureFlagsState => ({
      ...state,
      isLoading: true,
      [action.payload.flagName]: {
        ...state[action.payload.flagName],
        ...action.payload.featureFlag,
      },
    }),
    setFeatureFlagSucceeded: (state): FeatureFlagsState => ({
      ...state,
      isLoading: false,
    }),
    setFeatureFlagFailed: (state): FeatureFlagsState => ({
      ...state,
      isLoading: false,
    }),
  },
});
