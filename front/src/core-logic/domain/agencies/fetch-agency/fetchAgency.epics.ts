import { filter } from "rxjs";
import { map, switchMap } from "rxjs/operators";
import type { WithAgencyId } from "shared";
import { getConnectedUserJwt } from "src/core-logic/domain/admin/admin.helpers";
import { normalizeUsers } from "src/core-logic/domain/admin/connectedUsersAdmin/connectedUsersAdmin.epics";
import { connectedUsersAdminSlice } from "src/core-logic/domain/admin/connectedUsersAdmin/connectedUsersAdmin.slice";
import { closeAgencyAndTransferConventionsSlice } from "src/core-logic/domain/agencies/close-agency-and-transfert-conventions/closeAgencyAndTransferConventions.slice";
import { fetchAgencySlice } from "src/core-logic/domain/agencies/fetch-agency/fetchAgency.slice";
import type {
  PayloadActionWithFeedbackTopic,
  PayloadActionWithOrWithoutFeedbackTopic,
} from "src/core-logic/domain/feedback/feedback.slice";
import { catchEpicError } from "src/core-logic/storeConfig/catchEpicError";
import type {
  ActionOfSlice,
  AppEpic,
} from "src/core-logic/storeConfig/redux.helpers";
import { removeUserFromAgencySlice } from "../remove-user-from-agency/removeUserFromAgency.slice";

export type FetchAgencyAction = ActionOfSlice<typeof fetchAgencySlice>;

type FetchAgencyEpic = AppEpic<FetchAgencyAction | { type: "do-nothing" }>;

const getAgencyEpic: FetchAgencyEpic = (action$, state$, dependencies) =>
  action$.pipe(
    filter(
      (action) =>
        fetchAgencySlice.actions.fetchAgencyRequested.match(action) ||
        connectedUsersAdminSlice.actions.updateUserOnAgencySucceeded.match(
          action,
        ) ||
        removeUserFromAgencySlice.actions.removeUserFromAgencySucceeded.match(
          action,
        ) ||
        connectedUsersAdminSlice.actions.createUserOnAgencySucceeded.match(
          action,
        ) ||
        closeAgencyAndTransferConventionsSlice.actions.closeAgencyAndTransferConventionsSucceeded.match(
          action,
        ),
    ),
    switchMap((action: PayloadActionWithFeedbackTopic<WithAgencyId>) =>
      dependencies.agencyGateway
        .getAgencyById$(
          action.payload.agencyId,
          getConnectedUserJwt(state$.value),
        )
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
        ),
    ),
  );

const getAgencyUsersEpic: FetchAgencyEpic = (action$, state$, dependencies) =>
  action$.pipe(
    filter(fetchAgencySlice.actions.fetchAgencyUsersRequested.match),
    switchMap((action: PayloadActionWithOrWithoutFeedbackTopic<WithAgencyId>) =>
      dependencies.authGateway
        .getConnectedUsers$(getConnectedUserJwt(state$.value), {
          agencyIds: [action.payload.agencyId],
        })
        .pipe(
          map(normalizeUsers),
          map((users) =>
            fetchAgencySlice.actions.fetchAgencyUsersSucceeded(users),
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

export const fetchAgencyEpics = [getAgencyEpic, getAgencyUsersEpic];
