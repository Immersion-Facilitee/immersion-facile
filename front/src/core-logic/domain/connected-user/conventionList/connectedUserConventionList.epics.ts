import { filter, map, switchMap } from "rxjs";
import { conventionListSlice } from "src/core-logic/domain/connected-user/conventionList/connectedUserConventionList.slice";
import { catchEpicError } from "src/core-logic/storeConfig/catchEpicError";
import type {
  ActionOfSlice,
  AppEpic,
} from "src/core-logic/storeConfig/redux.helpers";

type ConventionListAction = ActionOfSlice<typeof conventionListSlice>;

type ConnectedUserConventionListEpic = AppEpic<ConventionListAction>;

const fetchConventionListEpic: ConnectedUserConventionListEpic = (
  action$,
  _state$,
  { conventionGateway },
) =>
  action$.pipe(
    filter(conventionListSlice.actions.fetchConventionListRequested.match),
    switchMap((action) =>
      conventionGateway
        .getConventionsForUser$(action.payload.filters, action.payload.jwt)
        .pipe(
          map((conventionsWithPagination) =>
            conventionListSlice.actions.fetchConventionListSucceeded({
              conventionsWithPagination,
              feedbackTopic: action.payload.feedbackTopic,
            }),
          ),
          catchEpicError((error) =>
            conventionListSlice.actions.fetchConventionListFailed({
              errorMessage: error.message,
              feedbackTopic: action.payload.feedbackTopic,
            }),
          ),
        ),
    ),
  );

const fetchBeneficiaryConventionListEpic: ConnectedUserConventionListEpic = (
  action$,
  _state$,
  { conventionGateway },
) =>
  action$.pipe(
    filter(
      conventionListSlice.actions.fetchBeneficiaryConventionListRequested.match,
    ),
    switchMap((action) =>
      conventionGateway
        .getBeneficiaryConventionList$(
          action.payload.filters,
          action.payload.jwt,
        )
        .pipe(
          map((beneficiaryConventionList) =>
            conventionListSlice.actions.fetchBeneficiaryConventionListSucceeded(
              {
                beneficiaryConventionList,
                feedbackTopic: action.payload.feedbackTopic,
              },
            ),
          ),
          catchEpicError((error) =>
            conventionListSlice.actions.fetchBeneficiaryConventionListFailed({
              errorMessage: error.message,
              feedbackTopic: action.payload.feedbackTopic,
            }),
          ),
        ),
    ),
  );

export const connectedUserConventionListEpics = [
  fetchConventionListEpic,
  fetchBeneficiaryConventionListEpic,
];
