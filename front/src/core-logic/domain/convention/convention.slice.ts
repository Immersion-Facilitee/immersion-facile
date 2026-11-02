import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type {
  AbsoluteUrl,
  AgencyId,
  ConventionDraftId,
  ConventionId,
  ConventionJwt,
  ConventionReadDto,
  ConventionSupportedJwt,
  DiscussionId,
  FindSimilarConventionsParams,
  SignatoryRole,
} from "shared";
import type {
  PayloadActionWithFeedbackTopic,
  PayloadActionWithFeedbackTopicError,
} from "src/core-logic/domain/feedback/feedback.slice";

export type NumberOfSteps = 1 | 2 | 3 | 4 | 5;

export interface ConventionState {
  formUi: {
    preselectedAgencyId: AgencyId | null;
    isMinor: boolean;
    isTutorEstablishmentRepresentative: boolean;
    hasCurrentEmployer: boolean;
    currentStep: NumberOfSteps;
    showSummary: boolean;
    agencyDepartment: string | null;
  };
  jwt: string | null;
  isLoading: boolean;
  convention: ConventionReadDto | null;
  initialFetchedConvention: ConventionReadDto | null;
  conventionStatusDashboardUrl: AbsoluteUrl | null;
  currentSignatoryRole: SignatoryRole | null;
  similarConventionIds: ConventionId[];
}

export const initialConventionState: ConventionState = {
  formUi: {
    preselectedAgencyId: null,
    isMinor: false,
    isTutorEstablishmentRepresentative: true,
    hasCurrentEmployer: false,
    currentStep: 1,
    showSummary: false,
    agencyDepartment: null,
  },
  jwt: null,
  convention: null,
  initialFetchedConvention: null,
  conventionStatusDashboardUrl: null,
  isLoading: false,
  currentSignatoryRole: null,
  similarConventionIds: [],
};

export type FetchConventionRequestedPayload = {
  jwt: ConventionSupportedJwt;
  conventionId: ConventionId;
};

export const conventionSlice = createSlice({
  name: "convention",
  initialState: initialConventionState,
  reducers: {
    showSummaryChangeRequested: (
      state,
      action: PayloadAction<
        | {
            showSummary: true;
            convention: ConventionReadDto;
            fromConventionDraftId?: ConventionDraftId;
          }
        | { showSummary: false }
      >,
    ) => {
      state.formUi.showSummary = action.payload.showSummary;
      if (action.payload.showSummary) {
        state.convention = action.payload.convention;
      }
    },
    agencyDepartementChangeRequested: (
      state,
      action: PayloadAction<string>,
    ) => {
      state.formUi.agencyDepartment = action.payload;
    },
    // Save convention
    saveConventionRequested: (
      state,
      action: PayloadActionWithFeedbackTopic<{
        convention: ConventionReadDto;
        fromConventionDraftId?: ConventionDraftId;
        discussionId?: DiscussionId;
      }>,
    ) => {
      state.isLoading = true;
      state.convention = action.payload.convention;
    },
    updateConventionSucceeded: (
      state,
      _action: PayloadActionWithFeedbackTopic<{
        convention: ConventionReadDto;
        discussionId?: DiscussionId;
      }>,
    ) => {
      state.isLoading = false;
    },
    updateConventionFailed: (
      state,
      _action: PayloadActionWithFeedbackTopicError,
    ) => {
      state.isLoading = false;
    },
    createConventionSucceeded: (
      state,
      _action: PayloadActionWithFeedbackTopic<{
        convention: ConventionReadDto;
        discussionId?: DiscussionId;
      }>,
    ) => {
      state.isLoading = false;
    },
    createConventionFailed: (
      state,
      _action: PayloadActionWithFeedbackTopicError,
    ) => {
      state.isLoading = false;
    },

    // Get convention from token
    fetchConventionRequested: (
      state,
      _action: PayloadActionWithFeedbackTopic<FetchConventionRequestedPayload>,
    ) => {
      state.isLoading = true;
    },
    fetchConventionSucceeded: (
      state,
      action: PayloadActionWithFeedbackTopic<{
        convention: ConventionReadDto | undefined;
      }>,
    ) => {
      state.convention = action.payload.convention ?? null;
      state.initialFetchedConvention = action.payload.convention ?? null;
      state.isLoading = false;
    },
    fetchConventionFailed: (
      state,
      _action: PayloadActionWithFeedbackTopicError,
    ) => {
      state.isLoading = false;
    },

    // get convention status dashboard
    conventionStatusDashboardRequested: (
      state,
      _action: PayloadActionWithFeedbackTopic<{
        conventionId: ConventionId;
        jwt: ConventionJwt;
      }>,
    ) => {
      state.isLoading = true;
    },
    conventionStatusDashboardSucceeded: (
      state,
      {
        payload,
      }: PayloadActionWithFeedbackTopic<{
        url: AbsoluteUrl;
      }>,
    ) => {
      state.isLoading = false;
      state.conventionStatusDashboardUrl = payload.url;
    },
    conventionStatusDashboardFailed: (
      state,
      _action: PayloadActionWithFeedbackTopicError,
    ) => {
      state.isLoading = false;
    },

    isMinorChanged: (state, action: PayloadAction<boolean>) => {
      state.formUi.isMinor = action.payload;
    },
    isCurrentEmployerChanged: (state, action: PayloadAction<boolean>) => {
      state.formUi.hasCurrentEmployer = action.payload;
    },

    isTutorEstablishmentRepresentativeChanged: (
      state,
      action: PayloadAction<boolean>,
    ) => {
      state.formUi.isTutorEstablishmentRepresentative = action.payload;
    },

    clearFetchedConvention: (state) => {
      state.convention = initialConventionState.convention;
      state.initialFetchedConvention =
        initialConventionState.initialFetchedConvention;
      state.formUi = initialConventionState.formUi;
    },

    jwtProvided: (state, action: PayloadAction<string>) => {
      state.jwt = action.payload;
    },

    currentSignatoryRoleChanged: (
      state,
      action: PayloadAction<SignatoryRole | null>,
    ) => {
      state.currentSignatoryRole = action.payload;
    },

    setCurrentStep: (state, { payload }: PayloadAction<NumberOfSteps>) => {
      state.formUi.currentStep = payload;
    },

    // Get similar conventions
    getSimilarConventionsRequested: (
      _state,
      _action: PayloadActionWithFeedbackTopic<FindSimilarConventionsParams>,
    ) => {},

    getSimilarConventionsSucceeded: (
      state,
      {
        payload,
      }: PayloadActionWithFeedbackTopic<{
        similarConventionIds: ConventionId[];
      }>,
    ) => {
      state.similarConventionIds = payload.similarConventionIds;
    },
    getSimilarConventionsFailed: (
      state,
      _action: PayloadActionWithFeedbackTopicError,
    ) => {
      state.isLoading = false;
    },
  },
});
