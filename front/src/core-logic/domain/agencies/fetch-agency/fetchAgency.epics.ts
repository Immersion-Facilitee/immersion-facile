import { filter } from "rxjs";
import { map, switchMap } from "rxjs/operators";
import type { AgencyId, WithAgencyId } from "shared";
import { getConnectedUserJwt } from "src/core-logic/domain/admin/admin.helpers";
import { closeAgencyAndTransferConventionsSlice } from "src/core-logic/domain/agencies/close-agency-and-transfert-conventions/closeAgencyAndTransferConventions.slice";
import { createUserOnAgencySlice } from "src/core-logic/domain/agencies/create-user-on-agency/createUserOnAgency.slice";
import { fetchAgencySlice } from "src/core-logic/domain/agencies/fetch-agency/fetchAgency.slice";
import { removeUserFromAgencySlice } from "src/core-logic/domain/agencies/remove-user-from-agency/removeUserFromAgency.slice";
import { updateAgencySlice } from "src/core-logic/domain/agencies/update-agency/updateAgency.slice";
import { updateUserOnAgencySlice } from "src/core-logic/domain/agencies/update-user-on-agency/updateUserOnAgency.slice";
import type {
  PayloadActionWithFeedbackTopic,
  PayloadActionWithOrWithoutFeedbackTopic,
} from "src/core-logic/domain/feedback/feedback.slice";
import { catchEpicError } from "src/core-logic/storeConfig/catchEpicError";
import type {
  ActionOfSlice,
  AppEpic,
} from "src/core-logic/storeConfig/redux.helpers";

export type FetchAgencyAction = ActionOfSlice<typeof fetchAgencySlice>;

type FetchAgencyEpic = AppEpic<FetchAgencyAction | { type: "do-nothing" }>;

const agencyIdFromFetchOrMutationPayload = (payload: {
  agencyId?: AgencyId;
  id?: AgencyId;
}): AgencyId => {
  if ("agencyId" in payload && payload.agencyId) return payload.agencyId;
  if ("id" in payload && payload.id) return payload.id;
  throw new Error("Missing agency id in action payload");
};

const getAgencyEpic: FetchAgencyEpic = (action$, state$, dependencies) =>
  action$.pipe(
    filter(
      (action) =>
        fetchAgencySlice.actions.fetchAgencyRequested.match(action) ||
        updateAgencySlice.actions.updateAgencySucceeded.match(action) ||
        closeAgencyAndTransferConventionsSlice.actions.closeAgencyAndTransferConventionsSucceeded.match(
          action,
        ),
    ),
    filter((action) => {
      if (fetchAgencySlice.actions.fetchAgencyRequested.match(action))
        return true;
      const agencyId = agencyIdFromFetchOrMutationPayload(action.payload);
      return state$.value.agency.fetchAgency.agency?.id === agencyId;
    }),
    switchMap(
      (
        action: PayloadActionWithFeedbackTopic<WithAgencyId | { id: AgencyId }>,
      ) => {
        const agencyId = agencyIdFromFetchOrMutationPayload(action.payload);
        return dependencies.agencyGateway
          .getAgencyById$(agencyId, getConnectedUserJwt(state$.value))
          .pipe(
            map((agency) =>
              fetchAgencySlice.actions.fetchAgencySucceeded(agency),
            ),
            catchEpicError((error: Error) =>
              fetchAgencySlice.actions.fetchAgencyFailed({
                errorMessage: error.message,
                feedbackTopic: action.payload.feedbackTopic,
              }),
            ),
          );
      },
    ),
  );

const getAgencyUsersEpic: FetchAgencyEpic = (action$, state$, dependencies) =>
  action$.pipe(
    filter(fetchAgencySlice.actions.fetchAgencyUsersRequested.match),
    switchMap((action: PayloadActionWithOrWithoutFeedbackTopic<WithAgencyId>) =>
      dependencies.agencyGateway
        .getAgencyUsers$(getConnectedUserJwt(state$.value), {
          agencyIds: [action.payload.agencyId],
        })
        .pipe(
          map((users) =>
            fetchAgencySlice.actions.fetchAgencyUsersSucceeded(
              users.reduce((acc, user) => ({ ...acc, [user.id]: user }), {}),
            ),
          ),
          catchEpicError((error: Error) =>
            fetchAgencySlice.actions.fetchAgencyUsersFailed({
              errorMessage: error.message,
              ...(action.payload.feedbackTopic
                ? { feedbackTopic: action.payload.feedbackTopic }
                : {}),
            }),
          ),
        ),
    ),
  );

const refetchAgencyUsersOnMutationEpic: FetchAgencyEpic = (action$, state$) =>
  action$.pipe(
    filter(
      (action) =>
        createUserOnAgencySlice.actions.createUserOnAgencySucceeded.match(
          action,
        ) ||
        removeUserFromAgencySlice.actions.removeUserFromAgencySucceeded.match(
          action,
        ) ||
        updateUserOnAgencySlice.actions.updateUserAgencyRightSucceeded.match(
          action,
        ),
    ),
    filter((action) => {
      const { agency, agencyUsers } = state$.value.agency.fetchAgency;
      if (agency?.id === action.payload.agencyId) return true;
      if (
        "userId" in action.payload &&
        agencyUsers[action.payload.userId] !== undefined
      )
        return true;
      return false;
    }),
    map((action) =>
      fetchAgencySlice.actions.fetchAgencyUsersRequested({
        agencyId: action.payload.agencyId,
      }),
    ),
  );

export const fetchAgencyEpics = [
  getAgencyEpic,
  getAgencyUsersEpic,
  refetchAgencyUsersOnMutationEpic,
];
