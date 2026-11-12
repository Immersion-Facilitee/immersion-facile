import { createSlice } from "@reduxjs/toolkit";
import type {
  ConventionId,
  ConventionSupportedJwt,
  EditConventionCounsellorNameRequestDto,
  RenewConventionParams,
  TransferConventionToAgencyRequestDto,
  UpdateConventionStatusRequestDto,
  WithConventionId,
} from "shared";

import type {
  PayloadActionWithFeedbackTopic,
  PayloadActionWithFeedbackTopicError,
} from "src/core-logic/domain/feedback/feedback.slice";

export type StatusChangePayload = {
  jwt: ConventionSupportedJwt;
  updateStatusParams: UpdateConventionStatusRequestDto;
};

export type RenewConventionPayload = {
  jwt: ConventionSupportedJwt;
  params: RenewConventionParams;
};

type TransferConventionToAgencyPayload = {
  jwt: ConventionSupportedJwt;
  transferConventionToAgencyParams: TransferConventionToAgencyRequestDto;
};

export type EditCounsellorNamePayload = {
  jwt: ConventionSupportedJwt;
  editCounsellorNameParams: EditConventionCounsellorNameRequestDto;
};

type SignPayload = {
  conventionId: ConventionId;
  jwt: ConventionSupportedJwt;
};

export interface ConventionActionState {
  isLoading: boolean;
  isBroadcasting: boolean;
}

export const conventionActionInitialState: ConventionActionState = {
  isLoading: false,
  isBroadcasting: false,
};

const setIsLoading =
  <PayloadAction>(isLoading: boolean) =>
  (state: ConventionActionState, _action: PayloadAction) => {
    state.isLoading = isLoading;
  };
const setIsBroadcasting =
  <PayloadAction>(isBroadcasting: boolean) =>
  (state: ConventionActionState, _action: PayloadAction) => {
    state.isBroadcasting = isBroadcasting;
  };

export const conventionActionSlice = createSlice({
  name: "conventionAction",
  initialState: conventionActionInitialState,
  reducers: {
    cancelConventionRequested:
      setIsLoading<PayloadActionWithFeedbackTopic<StatusChangePayload>>(true),
    cancelConventionSucceeded:
      setIsLoading<PayloadActionWithFeedbackTopic<StatusChangePayload>>(false),
    cancelConventionFailed:
      setIsLoading<PayloadActionWithFeedbackTopicError>(false),

    deprecateConventionRequested:
      setIsLoading<PayloadActionWithFeedbackTopic<StatusChangePayload>>(true),
    deprecateConventionSucceeded:
      setIsLoading<PayloadActionWithFeedbackTopic<StatusChangePayload>>(false),
    deprecateConventionFailed:
      setIsLoading<PayloadActionWithFeedbackTopicError>(false),

    rejectConventionRequested:
      setIsLoading<PayloadActionWithFeedbackTopic<StatusChangePayload>>(true),
    rejectConventionSucceeded:
      setIsLoading<PayloadActionWithFeedbackTopic<StatusChangePayload>>(false),
    rejectConventionFailed:
      setIsLoading<PayloadActionWithFeedbackTopicError>(false),

    acceptByCounsellorRequested:
      setIsLoading<PayloadActionWithFeedbackTopic<StatusChangePayload>>(true),
    acceptByCounsellorSucceeded:
      setIsLoading<PayloadActionWithFeedbackTopic<StatusChangePayload>>(false),
    acceptByCounsellorFailed:
      setIsLoading<PayloadActionWithFeedbackTopicError>(false),

    acceptByValidatorRequested:
      setIsLoading<PayloadActionWithFeedbackTopic<StatusChangePayload>>(true),
    acceptByValidatorSucceeded:
      setIsLoading<PayloadActionWithFeedbackTopic<StatusChangePayload>>(false),
    acceptByValidatorFailed:
      setIsLoading<PayloadActionWithFeedbackTopicError>(false),

    editCounsellorNameRequested:
      setIsLoading<PayloadActionWithFeedbackTopic<EditCounsellorNamePayload>>(
        true,
      ),
    editCounsellorNameSucceeded:
      setIsLoading<PayloadActionWithFeedbackTopic<EditCounsellorNamePayload>>(
        false,
      ),
    editCounsellorNameFailed:
      setIsLoading<PayloadActionWithFeedbackTopicError>(false),

    transferConventionToAgencyRequested:
      setIsLoading<
        PayloadActionWithFeedbackTopic<TransferConventionToAgencyPayload>
      >(true),
    transferConventionToAgencySucceeded:
      setIsLoading<
        PayloadActionWithFeedbackTopic<TransferConventionToAgencyPayload>
      >(false),
    transferConventionToAgencyFailed:
      setIsLoading<PayloadActionWithFeedbackTopicError>(false),

    broadcastConventionToPartnerRequested:
      setIsBroadcasting<PayloadActionWithFeedbackTopic<WithConventionId>>(true),
    broadcastConventionToPartnerSucceeded:
      setIsBroadcasting<PayloadActionWithFeedbackTopic<WithConventionId>>(
        false,
      ),
    broadcastConventionToPartnerFailed:
      setIsBroadcasting<PayloadActionWithFeedbackTopicError>(false),

    signConventionRequested:
      setIsLoading<PayloadActionWithFeedbackTopic<SignPayload>>(true),
    signConventionSucceeded:
      setIsLoading<PayloadActionWithFeedbackTopic<SignPayload>>(false),
    signConventionFailed:
      setIsLoading<PayloadActionWithFeedbackTopicError>(false),

    renewConventionRequested:
      setIsLoading<PayloadActionWithFeedbackTopic<RenewConventionPayload>>(
        true,
      ),
    renewConventionSucceeded:
      setIsLoading<PayloadActionWithFeedbackTopic<RenewConventionPayload>>(
        false,
      ),
    renewConventionFailed:
      setIsLoading<PayloadActionWithFeedbackTopicError>(false),
  },
});
