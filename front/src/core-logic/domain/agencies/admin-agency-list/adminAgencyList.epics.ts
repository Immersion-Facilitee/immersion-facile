import { filter, map, switchMap } from "rxjs";
import { adminAgencyListSlice } from "src/core-logic/domain/agencies/admin-agency-list/adminAgencyList.slice";
import { catchEpicError } from "src/core-logic/storeConfig/catchEpicError";
import type {
  ActionOfSlice,
  AppEpic,
} from "src/core-logic/storeConfig/redux.helpers";

type AdminAgencyListAction = ActionOfSlice<typeof adminAgencyListSlice>;

const fetchAdminAgencyListEpic: AppEpic<AdminAgencyListAction> = (
  action$,
  _state$,
  { agencyGateway },
) =>
  action$.pipe(
    filter(adminAgencyListSlice.actions.fetchAdminAgencyListRequested.match),
    switchMap((action) =>
      agencyGateway
        .getAgenciesForAdmin$(action.payload.filters, action.payload.jwt)
        .pipe(
          map((adminAgencyList) =>
            adminAgencyListSlice.actions.fetchAdminAgencyListSucceeded({
              adminAgencyList,
              feedbackTopic: action.payload.feedbackTopic,
            }),
          ),
          catchEpicError((error) =>
            adminAgencyListSlice.actions.fetchAdminAgencyListFailed({
              errorMessage: error.message,
              feedbackTopic: action.payload.feedbackTopic,
            }),
          ),
        ),
    ),
  );

export const adminAgencyListEpics = [fetchAdminAgencyListEpic];
