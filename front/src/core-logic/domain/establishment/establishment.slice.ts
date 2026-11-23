import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import {
  type BanEstablishmentPayload,
  type ConnectedUserJwt,
  defaultMaxContactsPerMonth,
  type EstablishmentNameAndAdmins,
  type EstablishmentPublicOption,
  type FormEstablishmentDto,
  type FormEstablishmentUserRight,
  type GetEstablishmentPublicOptionsByFiltersInput,
  type SiretDto,
} from "shared";
import type {
  PayloadActionWithFeedbackTopic,
  PayloadActionWithFeedbackTopicError,
} from "src/core-logic/domain/feedback/feedback.slice";
import { conventionSlice } from "../convention/convention.slice";

export type EstablishmentUpdatePayload = {
  formEstablishment: FormEstablishmentDto;
  jwt: ConnectedUserJwt;
};

export type EstablishmentDeletePayload = {
  siret: SiretDto;
  jwt: ConnectedUserJwt;
};

export type SiretAndJwtPayload = {
  siret: SiretDto;
  jwt: ConnectedUserJwt;
};

export type EstablishmentPublicOptionsPayload = {
  filters: GetEstablishmentPublicOptionsByFiltersInput;
  jwt: ConnectedUserJwt;
};

export type UserRegistrationOnEstablishmentPayload = {
  siret: SiretDto;
  userRight: FormEstablishmentUserRight;
  jwt: ConnectedUserJwt;
};

export type BanEstablishmentRequestPayload = BanEstablishmentPayload & {
  jwt: ConnectedUserJwt;
};

export type EstablishmentRequestedPayload = SiretAndJwtPayload;

export const defaultFormEstablishmentValue = (
  siret?: SiretDto,
): FormEstablishmentDto => ({
  source: "immersion-facile",
  siret: siret || "",
  businessName: "",
  businessAddresses: [],
  offers: [],
  userRights: [],
  contactMode: "EMAIL",
  website: "",
  additionalInformation: "",
  maxContactsPerMonth: defaultMaxContactsPerMonth,
  naf: undefined,
  fitForDisabledWorkers: "no",
  businessNameCustomized: undefined,
  searchableBy: {
    jobSeekers: true,
    students: true,
  },
  isEstablishmentBanned: false,
});

export type EstablishmentState = {
  isLoading: boolean;
  formEstablishment: FormEstablishmentDto;
  establishmentNameAndAdmins:
    | EstablishmentNameAndAdmins
    | null
    | "establishmentNotFound";
  establishmentPublicOptions: EstablishmentPublicOption[];
};

const initialState: EstablishmentState = {
  isLoading: false,
  formEstablishment: defaultFormEstablishmentValue(),
  establishmentNameAndAdmins: null,
  establishmentPublicOptions: [],
};

export const establishmentSlice = createSlice({
  name: "establishment",
  initialState,
  reducers: {
    fetchEstablishmentRequested: (
      state,
      _action: PayloadActionWithFeedbackTopic<{
        establishmentRequested: EstablishmentRequestedPayload;
      }>,
    ) => {
      state.isLoading = true;
    },
    fetchEstablishmentSucceeded: (
      state,
      action: PayloadAction<FormEstablishmentDto>,
    ) => {
      state.formEstablishment = action.payload;
      state.isLoading = false;
    },
    fetchEstablishmentFailed: (
      state,
      _action: PayloadActionWithFeedbackTopicError,
    ) => {
      state.isLoading = false;
    },

    createEstablishmentRequested: (
      state,
      _action: PayloadActionWithFeedbackTopic<{
        formEstablishment: FormEstablishmentDto;
        jwt: ConnectedUserJwt;
      }>,
    ) => {
      state.isLoading = true;
    },
    createEstablishmentSucceeded: (
      state,
      _action: PayloadActionWithFeedbackTopic,
    ) => {
      state.isLoading = false;
    },
    createEstablishmentFailed: (
      state,
      _action: PayloadActionWithFeedbackTopicError,
    ) => {
      state.isLoading = false;
    },

    updateEstablishmentRequested: (
      state,
      _action: PayloadActionWithFeedbackTopic<{
        establishmentUpdate: EstablishmentUpdatePayload;
      }>,
    ) => {
      state.isLoading = true;
    },
    updateEstablishmentSucceeded: (
      state,
      action: PayloadActionWithFeedbackTopic<{
        establishmentUpdate: EstablishmentUpdatePayload;
      }>,
    ) => {
      state.isLoading = false;
      state.formEstablishment =
        action.payload.establishmentUpdate.formEstablishment;
    },
    updateEstablishmentFailed: (
      state,
      _action: PayloadActionWithFeedbackTopicError,
    ) => {
      state.isLoading = false;
    },

    deleteEstablishmentRequested: (
      state,
      _action: PayloadActionWithFeedbackTopic<{
        establishmentDelete: EstablishmentDeletePayload;
      }>,
    ) => {
      state.isLoading = true;
    },
    deleteEstablishmentSucceeded: (
      state,
      _action: PayloadActionWithFeedbackTopic,
    ) => {
      state.isLoading = false;
    },
    deleteEstablishmentFailed: (
      state,
      _action: PayloadActionWithFeedbackTopicError,
    ) => {
      state.isLoading = false;
    },

    fetchEstablishmentNameAndAdminsRequested: (
      state,
      _action: PayloadActionWithFeedbackTopic<SiretAndJwtPayload>,
    ) => {
      state.isLoading = true;
      state.establishmentNameAndAdmins = null;
    },
    fetchEstablishmentNameAndAdminSucceded: (
      state,
      action: PayloadActionWithFeedbackTopic<{
        establishmentNameAndAdmins:
          | EstablishmentNameAndAdmins
          | "establishmentNotFound";
      }>,
    ) => {
      state.isLoading = false;
      state.establishmentNameAndAdmins =
        action.payload.establishmentNameAndAdmins;
    },
    fetchEstablishmentNameAndAdminsFailed: (
      state,
      _action: PayloadActionWithFeedbackTopicError,
    ) => {
      state.isLoading = false;
    },
    fetchEstablishmentPublicOptionsRequested: (
      state,
      _action: PayloadActionWithFeedbackTopic<EstablishmentPublicOptionsPayload>,
    ) => {
      state.isLoading = true;
    },
    fetchEstablishmentPublicOptionsSucceeded: (
      state,
      action: PayloadActionWithFeedbackTopic<{
        establishmentPublicOptions: EstablishmentPublicOption[];
      }>,
    ) => {
      state.establishmentPublicOptions =
        action.payload.establishmentPublicOptions;
      state.isLoading = false;
    },
    fetchEstablishmentPublicOptionsFailed: (
      state,
      _action: PayloadActionWithFeedbackTopicError,
    ) => {
      state.isLoading = false;
    },
    userRegistrationOnEstablishmentRequested: (
      state,
      _action: PayloadActionWithFeedbackTopic<UserRegistrationOnEstablishmentPayload>,
    ) => {
      state.isLoading = true;
    },
    userRegistrationOnEstablishmentSucceeded: (
      state,
      _action: PayloadActionWithFeedbackTopic,
    ) => {
      state.isLoading = false;
    },
    userRegistrationOnEstablishmentFailed: (
      state,
      _action: PayloadActionWithFeedbackTopicError,
    ) => {
      state.isLoading = false;
    },

    banEstablishmentRequested: (
      state,
      _action: PayloadActionWithFeedbackTopic<BanEstablishmentRequestPayload>,
    ) => {
      state.isLoading = true;
    },
    banEstablishmentSucceeded: (
      state,
      _action: PayloadActionWithFeedbackTopic,
    ) => {
      state.isLoading = false;
    },
    banEstablishmentFailed: (
      state,
      _action: PayloadActionWithFeedbackTopicError,
    ) => {
      state.isLoading = false;
    },

    clearEstablishmentRequested: () => initialState,
  },
  extraReducers(builder) {
    builder.addCase(
      conventionSlice.actions.fetchConventionSucceeded,
      (state, action) => {
        if (!action.payload.convention) return;
        state.isLoading = false;
        const convention = action.payload.convention;

        state.formEstablishment = {
          ...state.formEstablishment,
          siret: convention.siret,
          businessName: convention.businessName,
          offers: [
            {
              appellationCode: convention.immersionAppellation.appellationCode,
              appellationLabel:
                convention.immersionAppellation.appellationLabel,
              romeCode: convention.immersionAppellation.romeCode,
              romeLabel: convention.immersionAppellation.romeLabel,
              remoteWorkMode: "ON_SITE",
            },
          ],
        };
      },
    );
  },
});
