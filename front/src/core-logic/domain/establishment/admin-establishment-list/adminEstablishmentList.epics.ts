import { filter, map, switchMap } from "rxjs";
import { adminEstablishmentListSlice } from "src/core-logic/domain/establishment/admin-establishment-list/adminEstablishmentList.slice";
import { catchEpicError } from "src/core-logic/storeConfig/catchEpicError";
import type {
  ActionOfSlice,
  AppEpic,
} from "src/core-logic/storeConfig/redux.helpers";

type AdminEstablishmentListAction = ActionOfSlice<
  typeof adminEstablishmentListSlice
>;

const fetchAdminEstablishmentListEpic: AppEpic<AdminEstablishmentListAction> = (
  action$,
  _state$,
  { adminGateway },
) =>
  action$.pipe(
    filter(
      adminEstablishmentListSlice.actions.fetchAdminEstablishmentListRequested
        .match,
    ),
    switchMap((action) =>
      adminGateway
        .getEstablishmentsForAdmin$(action.payload.filters, action.payload.jwt)
        .pipe(
          map((adminEstablishmentList) =>
            adminEstablishmentListSlice.actions.fetchAdminEstablishmentListSucceeded(
              {
                adminEstablishmentList,
                feedbackTopic: action.payload.feedbackTopic,
              },
            ),
          ),
          catchEpicError((error) =>
            adminEstablishmentListSlice.actions.fetchAdminEstablishmentListFailed(
              {
                errorMessage: error.message,
                feedbackTopic: action.payload.feedbackTopic,
              },
            ),
          ),
        ),
    ),
  );

export const adminEstablishmentListEpics = [fetchAdminEstablishmentListEpic];
