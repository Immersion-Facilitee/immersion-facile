import {
  debounceTime,
  distinctUntilChanged,
  filter,
  map,
  mergeMap,
} from "rxjs";
import type { LookupAddress } from "shared";
import { siretSlice } from "src/core-logic/domain/siret/siret.slice";
import { catchEpicError } from "src/core-logic/storeConfig/catchEpicError";
import type {
  ActionOfSlice,
  AppEpic,
} from "src/core-logic/storeConfig/redux.helpers";
import {
  type AddressAutocompleteLocator,
  geocodingSlice,
} from "./geocoding.slice";

type GeocodingAction = ActionOfSlice<typeof geocodingSlice>;

export const queryMinLength = 3;
export const debounceDuration = 500;

const geocodingQueryEpic: AppEpic<GeocodingAction> = (
  action$,
  _state$,
  { scheduler },
) =>
  action$.pipe(
    filter(geocodingSlice.actions.changeQueryRequested.match),
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
      geocodingSlice.actions.fetchSuggestionsRequested({
        locator: action.payload.locator,
        lookup: action.payload.lookup,
        countryCode: action.payload.countryCode,
        selectFirstSuggestion: false,
      }),
    ),
  );

export const geocodingRequestEpic: AppEpic<GeocodingAction> = (
  action$,
  _,
  { addressGateway },
) =>
  action$.pipe(
    filter(geocodingSlice.actions.fetchSuggestionsRequested.match),
    mergeMap((action) =>
      addressGateway
        .lookupStreetAddress$(action.payload.lookup, action.payload.countryCode)
        .pipe(
          map((suggestions) => ({
            suggestions,
            selectFirstSuggestion: action.payload.selectFirstSuggestion,
            locator: action.payload.locator,
          })),
          map(geocodingSlice.actions.fetchSuggestionsSucceeded),
          catchEpicError(() =>
            geocodingSlice.actions.fetchSuggestionsFailed({
              locator: action.payload.locator,
            }),
          ),
        ),
    ),
  );

const geocodingFromSiretInfoEpic: AppEpic<GeocodingAction> = (action$) =>
  action$.pipe(
    filter(siretSlice.actions.siretInfoSucceeded.match),
    filter(
      (
        action,
      ): action is typeof action & {
        payload: {
          addressAutocompleteLocator: AddressAutocompleteLocator;
        };
      } => action.payload.addressAutocompleteLocator !== null,
    ),
    map((action) =>
      geocodingSlice.actions.fetchSuggestionsRequested({
        locator: action.payload.addressAutocompleteLocator,
        lookup: action.payload.siretEstablishment
          .businessAddress as LookupAddress,
        selectFirstSuggestion: true,
        countryCode: action.payload.countryCode,
      }),
    ),
  );

export const geocodingEpics = [
  geocodingQueryEpic,
  geocodingRequestEpic,
  geocodingFromSiretInfoEpic,
];
