import {
  filter,
  map,
  type Observable,
  of,
  switchMap,
  take,
  throwError,
} from "rxjs";
import {
  type DataWithPagination,
  errors,
  hasSearchGeoParams,
  internalOfferSchema,
  type OfferDto,
} from "shared";
import {
  type GetOffersPayload,
  type SearchResultPayload,
  searchSlice,
} from "src/core-logic/domain/search/search.slice";
import type { SearchGateway } from "src/core-logic/ports/SearchGateway";
import { catchEpicError } from "src/core-logic/storeConfig/catchEpicError";
import type {
  ActionOfSlice,
  AppEpic,
} from "src/core-logic/storeConfig/redux.helpers";

type SearchAction = ActionOfSlice<typeof searchSlice>;

type SearchEpic = AppEpic<SearchAction>;

const offers$ = (
  searchGateway: SearchGateway,
  payload: GetOffersPayload,
): Observable<DataWithPagination<OfferDto>> => {
  if (payload.isExternal !== true) return searchGateway.getOffers$(payload);
  if (!hasSearchGeoParams(payload))
    return throwError(() => errors.search.invalidGeoParams());
  return searchGateway.getExternalOffers$({
    ...payload,
    appellationCode: payload.appellationCodes
      ? payload.appellationCodes[0]
      : "",
  });
};

const getOffersEpic: SearchEpic = (action$, _state$, { searchGateway }) =>
  action$.pipe(
    filter(searchSlice.actions.getOffersRequested.match),
    switchMap((action) =>
      offers$(searchGateway, action.payload).pipe(
        take(1),
        map((searchResultWithPagination) =>
          searchSlice.actions.getOffersSucceeded({
            searchResultsWithPagination: searchResultWithPagination,
            searchParams: action.payload,
          }),
        ),
        catchEpicError((error) =>
          searchSlice.actions.getOffersFailed({
            errorMessage: error.message,
          }),
        ),
      ),
    ),
  );

const isSearchResultDto = (
  payload: SearchResultPayload | OfferDto,
): payload is OfferDto => internalOfferSchema.safeParse(payload).success;

const fetchSearchResultEpic: SearchEpic = (
  action$,
  _state$,
  { searchGateway },
) =>
  action$.pipe(
    filter(searchSlice.actions.fetchSearchResultRequested.match),
    switchMap(({ payload }) => {
      const searchResult$ = isSearchResultDto(payload.searchResult)
        ? of(payload.searchResult)
        : searchGateway.getOffer$(payload.searchResult);
      return searchResult$.pipe(
        map(searchSlice.actions.fetchSearchResultSucceeded),
        catchEpicError((error) =>
          searchSlice.actions.fetchSearchResultFailed({
            errorMessage: error.message,
            feedbackTopic: payload.feedbackTopic,
          }),
        ),
      );
    }),
  );

const searchResultExternalProvidedEpic: SearchEpic = (
  action$,
  _state$,
  { searchGateway },
) =>
  action$.pipe(
    filter(searchSlice.actions.externalSearchResultRequested.match),
    switchMap(({ payload }) =>
      searchGateway.getExternalOffer$(payload.siretAndAppellation).pipe(
        map(searchSlice.actions.fetchSearchResultSucceeded),
        catchEpicError((error) =>
          searchSlice.actions.fetchSearchResultFailed({
            errorMessage: error.message,
            feedbackTopic: payload.feedbackTopic,
          }),
        ),
      ),
    ),
  );

export const searchEpics = [
  getOffersEpic,
  fetchSearchResultEpic,
  searchResultExternalProvidedEpic,
];
