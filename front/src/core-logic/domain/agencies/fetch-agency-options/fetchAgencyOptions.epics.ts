import type { PayloadAction } from "@reduxjs/toolkit";
import { debounceTime, distinctUntilChanged, filter } from "rxjs";
import { map, switchMap } from "rxjs/operators";
import {
  allAgencyStatuses,
  looksLikeSiret,
  maxAgencyOptionsPerRequest,
} from "shared";
import type {
  ActionOfSlice,
  AppEpic,
} from "src/core-logic/storeConfig/redux.helpers";
import { agencyAdminSlice } from "./fetchAgencyOptions.slice";

export type AgencyAction = ActionOfSlice<typeof agencyAdminSlice>;

type AgencyEpic = AppEpic<AgencyAction | { type: "do-nothing" }>;

const agencyAdminGetByNameEpic: AgencyEpic = (
  action$,
  _state$,
  { agencyGateway, scheduler },
) =>
  action$.pipe(
    filter(agencyAdminSlice.actions.fetchAgencyOptionsRequested.match),
    debounceTime(400, scheduler),
    distinctUntilChanged(),
    switchMap((action: PayloadAction<string>) =>
      agencyGateway.listAgencyOptionsByFilter$({
        status: [...allAgencyStatuses],
        limit: maxAgencyOptionsPerRequest,
        [looksLikeSiret(action.payload) ? "siret" : "nameIncludes"]:
          action.payload,
      }),
    ),
    map(agencyAdminSlice.actions.setAgencyOptions),
  );

export const agenciesAdminEpics = [agencyAdminGetByNameEpic];
