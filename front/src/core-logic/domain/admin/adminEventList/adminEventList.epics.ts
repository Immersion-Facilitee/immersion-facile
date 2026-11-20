import { filter, map, switchMap } from "rxjs";
import { adminEventListSlice } from "src/core-logic/domain/admin/adminEventList/adminEventList.slice";
import { catchEpicError } from "src/core-logic/storeConfig/catchEpicError";
import type {
  ActionOfSlice,
  AppEpic,
} from "src/core-logic/storeConfig/redux.helpers";

type AdminEventListAction = ActionOfSlice<typeof adminEventListSlice>;

const fetchAdminEventListEpic: AppEpic<AdminEventListAction> = (
  action$,
  _state$,
  { adminGateway },
) =>
  action$.pipe(
    filter(adminEventListSlice.actions.fetchAdminEventListRequested.match),
    switchMap((action) =>
      adminGateway
        .getEventsForAdmin$(action.payload.filters, action.payload.jwt)
        .pipe(
          map((adminEventList) =>
            adminEventListSlice.actions.fetchAdminEventListSucceeded({
              adminEventList,
              feedbackTopic: action.payload.feedbackTopic,
            }),
          ),
          catchEpicError((error) =>
            adminEventListSlice.actions.fetchAdminEventListFailed({
              errorMessage: error.message,
              feedbackTopic: action.payload.feedbackTopic,
            }),
          ),
        ),
    ),
  );

export const adminEventListEpics = [fetchAdminEventListEpic];
