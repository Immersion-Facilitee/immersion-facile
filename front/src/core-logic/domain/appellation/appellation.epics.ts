import {
  debounceTime,
  distinctUntilChanged,
  filter,
  map,
  mergeMap,
} from "rxjs";
import { catchEpicError } from "src/core-logic/storeConfig/catchEpicError";
import type {
  ActionOfSlice,
  AppEpic,
} from "src/core-logic/storeConfig/redux.helpers";
import { appellationSlice } from "./appellation.slice";

type AppellationAction = ActionOfSlice<typeof appellationSlice>;

export const queryMinLength = 3;
export const debounceDuration = 500;

const appellationQueryEpic: AppEpic<AppellationAction> = (
  action$,
  _state$,
  { scheduler },
) =>
  action$.pipe(
    filter(appellationSlice.actions.changeQueryRequested.match),
    map((action) => ({
      ...action,
      payload: {
        ...action.payload,
        lookup: action.payload.lookup.trim(),
      },
    })),
    filter((action) => action.payload.lookup.length >= queryMinLength),
    debounceTime(debounceDuration, scheduler),
    distinctUntilChanged(),
    map((action) =>
      appellationSlice.actions.fetchSuggestionsRequested({
        locator: action.payload.locator,
        lookup: action.payload.lookup,
      }),
    ),
  );

const appellationRequestEpic: AppEpic<AppellationAction> = (
  action$,
  _,
  { formCompletionGateway },
) =>
  action$.pipe(
    filter(appellationSlice.actions.fetchSuggestionsRequested.match),
    mergeMap((action) =>
      formCompletionGateway
        .getAppellationDtoMatching$({
          searchText: action.payload.lookup,
          fetchAppellationsFromNaturalLanguage: true,
        })
        .pipe(
          map((suggestions) => ({
            suggestions,
            locator: action.payload.locator,
          })),
          map(appellationSlice.actions.fetchSuggestionsSucceeded),
          catchEpicError(() =>
            appellationSlice.actions.fetchSuggestionsFailed({
              locator: action.payload.locator,
            }),
          ),
        ),
    ),
  );

export const appellationEpics = [appellationQueryEpic, appellationRequestEpic];
