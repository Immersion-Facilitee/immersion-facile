import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type {
  AbsoluteUrl,
  AfterOAuthSuccessRedirectionResponse,
  ConnectedUserJwt,
  ConventionJwt,
  Email,
  EmailAuthCodeJwt,
  FederatedIdentity,
  OAuthState,
  OtpJwt,
  ShortLinkId,
  WithRedirectUri,
} from "shared";
import type {
  PayloadActionWithFeedbackTopic,
  PayloadActionWithFeedbackTopicError,
} from "src/core-logic/domain/feedback/feedback.slice";

type WithUrl = {
  url: AbsoluteUrl;
};

export type RenewJwtPayload = {
  expiredJwt: ConventionJwt | ConnectedUserJwt | EmailAuthCodeJwt | OtpJwt;
  originalUrl?: string;
  shortLinkId?: ShortLinkId;
  state?: OAuthState;
};

export interface AuthState {
  isLoading: boolean;
  isRequestingLoginByEmail: boolean;
  isRequestingRenewExpiredJwt: boolean;
  requestedEmail: Email | null;
  federatedIdentity: FederatedIdentity | null;
  afterLoginRedirectionUrl: AbsoluteUrl | null;
}

export const initialAuthState: AuthState = {
  isLoading: true,
  isRequestingLoginByEmail: false,
  isRequestingRenewExpiredJwt: false,
  federatedIdentity: null,
  afterLoginRedirectionUrl: null,
  requestedEmail: null,
};

const onFederatedIdentityReceived = (
  state: AuthState,
  action: PayloadActionWithFeedbackTopic<{
    federatedIdentity: FederatedIdentity | null;
  }>,
) => {
  state.isLoading = false;
  state.federatedIdentity = action.payload.federatedIdentity;
};

export const authSlice = createSlice({
  name: "auth",
  initialState: initialAuthState,
  reducers: {
    saveRedirectionAfterLoginRequested: (
      _state,
      _action: PayloadAction<WithUrl>,
    ) => {},
    saveRedirectAfterLoginSucceeded: (
      state,
      action: PayloadAction<WithUrl>,
    ) => {
      state.afterLoginRedirectionUrl = action.payload.url;
    },
    redirectionAfterLoginFoundInDevice: (
      state,
      action: PayloadAction<WithUrl>,
    ) => {
      state.afterLoginRedirectionUrl = action.payload.url;
    },
    redirectionAfterLoginNotFoundInDevice: (state) => state,
    redirectAndClearUrlAfterLoginRequested: () => {},
    redirectAndClearUrlAfterLoginSucceeded: (
      state,
      _action: PayloadAction<WithUrl | undefined>,
    ) => {
      state.afterLoginRedirectionUrl = null;
    },
    federatedIdentityProvided: onFederatedIdentityReceived,
    federatedIdentityFoundInDevice: onFederatedIdentityReceived,
    federatedIdentityFromStoreToDeviceStorageSucceeded: (
      state,
      _action: PayloadActionWithFeedbackTopic<{
        federatedIdentity: FederatedIdentity;
      }>,
    ) => state,
    federatedIdentityNotFoundInDevice: (state) => {
      state.isLoading = false;
    },
    fetchLogoutUrlRequested: (
      state,
      _action: PayloadActionWithFeedbackTopic<{
        mode: "device-only" | "device-and-oauth";
      }>,
    ) => state,
    fetchLogoutUrlSucceeded: (
      state,
      _action: PayloadActionWithFeedbackTopic<{ url: AbsoluteUrl | undefined }>,
    ) => state,
    fetchLogoutUrlFailed: (state, _action: PayloadActionWithFeedbackTopic) => {
      state.federatedIdentity = null;
    },
    redirectAfterLogoutSucceeded: (state) => state,
    federatedIdentityInDeviceDeletionSucceeded: (
      state,
      _action: PayloadAction<AbsoluteUrl | undefined>,
    ) => {
      state.federatedIdentity = null;
    },
    loginByEmailRequested: (
      state,
      action: PayloadActionWithFeedbackTopic<
        WithRedirectUri & {
          email: Email;
        }
      >,
    ) => {
      state.isRequestingLoginByEmail = true;
      state.requestedEmail = action.payload.email; // TODO test à faire évoluer
    },
    loginByEmailSucceded: (state, _action: PayloadActionWithFeedbackTopic) => {
      state.isRequestingLoginByEmail = false;
    },
    loginByEmailFailed: (
      state,
      _action: PayloadActionWithFeedbackTopicError,
    ) => {
      state.isRequestingLoginByEmail = false;
    },
    renewExpiredJwtRequested: (
      state,
      _action: PayloadActionWithFeedbackTopic<RenewJwtPayload>,
    ) => {
      state.isRequestingRenewExpiredJwt = true;
    },
    renewExpiredJwtSucceded: (
      state,
      _action: PayloadActionWithFeedbackTopic,
    ) => {
      state.isRequestingRenewExpiredJwt = false;
    },
    renewExpiredJwtFailed: (
      state,
      _action: PayloadActionWithFeedbackTopicError,
    ) => {
      state.isRequestingRenewExpiredJwt = false;
    },
    confirmLoginByMagicLinkRequested: (
      state,
      _action: PayloadActionWithFeedbackTopic<{
        code: string;
        state: string;
        email: Email;
      }>,
    ) => {
      state.isLoading = true;
    },
    confirmLoginByMagicLinkSucceeded: (
      state,
      _action: PayloadActionWithFeedbackTopic<AfterOAuthSuccessRedirectionResponse>,
    ) => {
      state.isLoading = false;
    },
    confirmLoginByMagicLinkFailed: (
      state,
      _action: PayloadActionWithFeedbackTopicError,
    ) => {
      state.isLoading = false;
    },
  },
});
