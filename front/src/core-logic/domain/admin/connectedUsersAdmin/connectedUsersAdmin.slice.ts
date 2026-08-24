import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type {
  AgencyId,
  AgencyRight,
  ConnectedUser,
  OmitFromExistingKeys,
  RejectConnectedUserRoleForAgencyParams,
  User,
  UserId,
  UserParamsForAgency,
  WithAgencyId,
  WithUserFilters,
} from "shared";
import type { SubmitFeedBack } from "src/core-logic/domain/SubmitFeedback";
import type { PayloadActionWithFeedbackTopic } from "../../feedback/feedback.slice";

export type ConnectedUserWithNormalizedAgencyRights = OmitFromExistingKeys<
  ConnectedUser,
  "agencyRights"
> & {
  agencyRights: Record<AgencyId, AgencyRight>;
};

export type ConnectedUsersWithNormalizedAgencyRightsById = Record<
  UserId,
  ConnectedUserWithNormalizedAgencyRights
>;

type ConnectedUsersAdminFeedbackKind =
  | "usersToReviewFetchSuccess"
  | "agencyRegisterToUserSuccess"
  | "agencyRejectionForUserSuccess"
  | "agencyUsersFetchSuccess";

export type ConnectedUsersAdminFeedback =
  SubmitFeedBack<ConnectedUsersAdminFeedbackKind>;

export type ConnectedUsersAdminState = {
  connectedUsersNeedingReview: ConnectedUsersWithNormalizedAgencyRightsById;
  agencyUsers: ConnectedUsersWithNormalizedAgencyRightsById;
  selectedUser: User | null;
  isUpdatingConnectedUserAgency: boolean;
  isFetchingAgenciesNeedingReviewForIcUser: boolean;
  isFetchingAgencyUsers: boolean;
  feedback: ConnectedUsersAdminFeedback;
};

export const connectedUsersAdminInitialState: ConnectedUsersAdminState = {
  connectedUsersNeedingReview: {},
  agencyUsers: {},
  selectedUser: null,
  isUpdatingConnectedUserAgency: false,
  isFetchingAgenciesNeedingReviewForIcUser: false,
  isFetchingAgencyUsers: false,
  feedback: { kind: "idle" },
};

export const connectedUsersAdminSlice = createSlice({
  name: "connectedUsersAdmin",
  initialState: connectedUsersAdminInitialState,
  reducers: {
    connectedUserSelected: (state, action: PayloadAction<User | null>) => {
      state.selectedUser = action.payload;
      if (state.feedback.kind === "errored")
        state.feedback = { kind: "usersToReviewFetchSuccess" };
    },
    fetchConnectedUsersToReviewRequested: (
      state,
      _action: PayloadAction<WithUserFilters>,
    ) => {
      state.isFetchingAgenciesNeedingReviewForIcUser = true;
    },
    fetchConnectedUsersToReviewFailed: (
      state,
      action: PayloadAction<string>,
    ) => {
      state.isFetchingAgenciesNeedingReviewForIcUser = false;
      state.feedback = { kind: "errored", errorMessage: action.payload };
    },
    fetchConnectedUsersToReviewSucceeded: (
      state,
      action: PayloadAction<ConnectedUsersWithNormalizedAgencyRightsById>,
    ) => {
      state.isFetchingAgenciesNeedingReviewForIcUser = false;
      state.connectedUsersNeedingReview = action.payload;
      state.feedback.kind = "usersToReviewFetchSuccess";
    },
    fetchAgencyUsersRequested: (
      state,
      _action: PayloadAction<WithUserFilters>,
    ) => {
      state.agencyUsers = connectedUsersAdminInitialState.agencyUsers;
      state.isFetchingAgencyUsers = true;
    },
    fetchAgencyUsersFailed: (state, action: PayloadAction<string>) => {
      state.isFetchingAgencyUsers = false;
      state.feedback = { kind: "errored", errorMessage: action.payload };
    },
    fetchAgencyUsersSucceeded: (
      state,
      action: PayloadAction<ConnectedUsersWithNormalizedAgencyRightsById>,
    ) => {
      state.isFetchingAgencyUsers = false;
      state.agencyUsers = action.payload;
      state.feedback.kind = "agencyUsersFetchSuccess";
    },
    registerAgencyWithRoleToUserRequested: (
      state,
      _action: PayloadAction<UserParamsForAgency>,
    ) => {
      state.isUpdatingConnectedUserAgency = true;
    },
    registerAgencyWithRoleToUserSucceeded: (
      state,
      action: PayloadAction<UserParamsForAgency>,
    ) => {
      const { userId, agencyId, roles: newRoles } = action.payload;
      state.isUpdatingConnectedUserAgency = false;
      state.feedback.kind = "agencyRegisterToUserSuccess";
      if (
        !state.connectedUsersNeedingReview[userId].agencyRights[
          agencyId
        ].roles.some((role) => newRoles.includes(role))
      ) {
        state.connectedUsersNeedingReview[userId].agencyRights[agencyId].roles =
          newRoles;
      }
    },
    registerAgencyWithRoleToUserFailed: (
      state,
      action: PayloadAction<string>,
    ) => {
      state.isUpdatingConnectedUserAgency = false;
      state.feedback = { kind: "errored", errorMessage: action.payload };
    },
    rejectAgencyWithRoleToUserRequested: (
      state,
      _action: PayloadAction<RejectConnectedUserRoleForAgencyParams>,
    ) => {
      state.isUpdatingConnectedUserAgency = true;
    },

    rejectAgencyWithRoleToUserSucceeded: (
      state,
      action: PayloadAction<RejectConnectedUserRoleForAgencyParams>,
    ) => {
      const { userId, agencyId } = action.payload;

      const { [agencyId]: _agency, ...agenciesFiltered } =
        state.connectedUsersNeedingReview[userId].agencyRights;
      state.isUpdatingConnectedUserAgency = false;
      state.feedback.kind = "agencyRejectionForUserSuccess";
      state.connectedUsersNeedingReview[userId].agencyRights = agenciesFiltered;
    },

    rejectAgencyWithRoleToUserFailed: (
      state,
      action: PayloadAction<string>,
    ) => {
      state.isUpdatingConnectedUserAgency = false;
      state.feedback = { kind: "errored", errorMessage: action.payload };
    },

    createUserOnAgencyRequested: (
      state,
      _action: PayloadActionWithFeedbackTopic<UserParamsForAgency>,
    ) => {
      state.isUpdatingConnectedUserAgency = true;
    },

    createUserOnAgencySucceeded: (
      state,
      action: PayloadActionWithFeedbackTopic<
        {
          icUser: ConnectedUserWithNormalizedAgencyRights;
        } & WithAgencyId
      >,
    ) => {
      state.isUpdatingConnectedUserAgency = false;
      const { id } = action.payload.icUser;

      state.agencyUsers[id] = action.payload.icUser;
    },

    createUserOnAgencyFailed: (
      state,
      _action: PayloadActionWithFeedbackTopic<{ errorMessage: string }>,
    ) => {
      state.isUpdatingConnectedUserAgency = false;
    },

    updateUserOnAgencyRequested: (
      state,
      _action: PayloadActionWithFeedbackTopic<UserParamsForAgency>,
    ) => {
      state.isUpdatingConnectedUserAgency = true;
    },

    updateUserOnAgencySucceeded: (
      state,
      action: PayloadActionWithFeedbackTopic<UserParamsForAgency>,
    ) => {
      state.isUpdatingConnectedUserAgency = false;
      const {
        userId,
        agencyId,
        roles: newRoles,
        email,
        isNotifiedByEmail,
      } = action.payload;
      state.agencyUsers[userId].agencyRights[agencyId].roles = newRoles;
      state.agencyUsers[userId].agencyRights[agencyId].isNotifiedByEmail =
        isNotifiedByEmail;
      state.agencyUsers[userId].email =
        email ?? state.agencyUsers[userId].email;
    },

    updateUserOnAgencyFailed: (
      state,
      _action: PayloadActionWithFeedbackTopic<{ errorMessage: string }>,
    ) => {
      state.isUpdatingConnectedUserAgency = false;
    },
  },
});
