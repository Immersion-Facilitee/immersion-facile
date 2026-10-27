import { filter, map, switchMap } from "rxjs";
import { catchEpicError } from "src/core-logic/storeConfig/catchEpicError";
import type {
  ActionOfSlice,
  AppEpic,
} from "src/core-logic/storeConfig/redux.helpers";
import { agenciesSlice } from "./agencies.slice";

type AgencyInfoAction = ActionOfSlice<typeof agenciesSlice>;

const agencyInfoGetByIdEpic: AppEpic<AgencyInfoAction> = (
  action$,
  _state$,
  { agencyGateway },
) =>
  action$.pipe(
    filter(agenciesSlice.actions.fetchAgencyInfoRequested.match),
    switchMap((action) =>
      agencyGateway.getAgencyPublicInfoById$({ agencyId: action.payload }),
    ),
    map((agencyInfo) =>
      agenciesSlice.actions.fetchAgencyInfoSucceeded(agencyInfo),
    ),
    catchEpicError((error) =>
      agenciesSlice.actions.fetchAgencyInfoFailed(error.message),
    ),
  );

const getFetchAgencyOptionsEpic: AppEpic<AgencyInfoAction> = (
  action$,
  _state$,
  dependencies,
) =>
  action$.pipe(
    filter(agenciesSlice.actions.fetchAgencyOptionsRequested.match),
    switchMap((action) =>
      dependencies.agencyGateway
        .listAgencyOptionsByFilter$(action.payload)
        .pipe(
          map(agenciesSlice.actions.fetchAgencyOptionsSucceeded),
          catchEpicError((error) =>
            agenciesSlice.actions.fetchAgencyOptionsFailed(error.message),
          ),
        ),
    ),
  );

const addAgencyEpic: AppEpic<AgencyInfoAction> = (
  action$,
  _state$,
  dependencies,
) =>
  action$.pipe(
    filter(agenciesSlice.actions.addAgencyRequested.match),
    switchMap((action) =>
      dependencies.agencyGateway.addAgency$(action.payload).pipe(
        map(() => agenciesSlice.actions.addAgencySucceeded(action.payload)),
        catchEpicError((error) =>
          agenciesSlice.actions.addAgencyFailed(error.message),
        ),
      ),
    ),
  );

export const agenciesEpics = [
  agencyInfoGetByIdEpic,
  getFetchAgencyOptionsEpic,
  addAgencyEpic,
];
