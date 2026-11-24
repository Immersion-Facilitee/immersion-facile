import {
  type AcquisitionParams,
  acquisitionParams,
  type FitForDisableWorkerOption,
  fitForDisabledWorkersPositiveOptions,
  frontRoutes,
  type GetOffersFlatQueryParams,
  keys,
  type SearchSortedBy,
  type SortDirection,
  searchSortedByOptions,
} from "shared";
import { useAppSelector } from "src/app/hooks/reduxHooks";
import {
  getUrlParameters,
  isKeyInObjectAndValueNotUndefinedNorEmpty,
} from "src/app/utils/url.utils";
import { searchSelectors } from "src/core-logic/domain/search/search.selectors";
import type { SearchPageParams } from "src/core-logic/domain/search/search.slice";
import type { Route } from "type-route";

export const encodedSearchUriParams = [
  "place",
] satisfies (keyof GetOffersFlatQueryParams)[];

export type SearchRoute = Route<
  | typeof frontRoutes.search
  | typeof frontRoutes.searchForStudent
  | typeof frontRoutes.externalSearch
  | typeof frontRoutes.group
>;

type ClassicSearchRouteName = Exclude<SearchRoute["name"], "group">;

type SearchQueryRouteParams = Extract<
  SearchRoute,
  { name: "search" }
>["params"];

const isSearchSortedBy = (value: string | undefined): value is SearchSortedBy =>
  searchSortedByOptions.some((option) => option === value);

const isSortDirection = (value: string | undefined): value is SortDirection =>
  value === "asc" || value === "desc";

const fitForDisabledWorkersFromRoute = (
  value: boolean | undefined,
): FitForDisableWorkerOption[] | undefined => {
  if (value === undefined) return undefined;
  if (value) return [...fitForDisabledWorkersPositiveOptions];
  return ["no"];
};

const fitForDisabledWorkersToRoute = (
  value: FitForDisableWorkerOption[] | undefined,
): boolean | undefined => {
  if (value === undefined) return undefined;
  return value.some(
    (option) => option === "yes-declared-only" || option === "yes-ft-certified",
  );
};

const withNormalizedSearchQueryParams = ({
  fitForDisabledWorkers,
  sortBy,
  sortOrder,
  ...rest
}: SearchQueryRouteParams): Partial<SearchPageParams> => ({
  ...rest,
  ...(fitForDisabledWorkers === undefined
    ? {}
    : {
        fitForDisabledWorkers: fitForDisabledWorkersFromRoute(
          fitForDisabledWorkers,
        ),
      }),
  ...(isSearchSortedBy(sortBy) ? { sortBy } : {}),
  ...(isSortDirection(sortOrder) ? { sortOrder } : {}),
});

export const searchPageParamsFromRoute = (
  route: SearchRoute,
): Partial<SearchPageParams> => {
  if (route.name === "group") {
    const { groupSlug, ...searchQueryParams } = route.params;
    return {
      ...withNormalizedSearchQueryParams(searchQueryParams),
      group: groupSlug,
    };
  }

  return withNormalizedSearchQueryParams(route.params);
};

const buildSearchQueryRouteParams = ({
  values,
  urlParams,
}: {
  values: SearchPageParams;
  urlParams: Record<string, string>;
}): SearchQueryRouteParams => {
  const acquisitionFromUrl = Object.fromEntries(
    Object.entries(urlParams).filter(([key]) =>
      keys(acquisitionParams).includes(key as keyof AcquisitionParams),
    ),
  );

  return {
    distanceKm: values.distanceKm,
    latitude: values.latitude,
    longitude: values.longitude,
    appellations: values.appellations,
    appellationCodes: values.appellationCodes,
    sortBy: values.sortBy,
    sortOrder: values.sortOrder,
    place: isKeyInObjectAndValueNotUndefinedNorEmpty("place", values)
      ? encodeURIComponent(values.place)
      : values.place,
    page: values.page,
    perPage: values.perPage,
    nafCodes: values.nafCodes,
    nafLabel: values.nafLabel,
    remoteWorkModes: values.remoteWorkModes,
    showOnlyAvailableOffers: values.showOnlyAvailableOffers,
    fitForDisabledWorkers: fitForDisabledWorkersToRoute(
      values.fitForDisabledWorkers,
    ),
    at_campaign: acquisitionFromUrl.at_campaign,
    at_medium: acquisitionFromUrl.at_medium,
    at_kwd: acquisitionFromUrl.at_kwd,
  };
};

const pushClassicSearchRoute = ({
  routeName,
  params,
}: {
  routeName: ClassicSearchRouteName;
  params: SearchQueryRouteParams;
}): void => {
  if (routeName === "search") {
    frontRoutes.search(params).push();
    return;
  }
  if (routeName === "searchForStudent") {
    frontRoutes.searchForStudent(params).push();
    return;
  }
  frontRoutes.externalSearch(params).push();
};

const filterUrlsParamsAndUpdateUrl = ({
  values,
  urlParams,
  routeName,
}: {
  values: SearchPageParams;
  urlParams: Record<string, string>;
  routeName: SearchRoute["name"];
}): void => {
  const searchQueryParams = buildSearchQueryRouteParams({ values, urlParams });

  if (routeName === "group") {
    if (!values.group) return;
    frontRoutes
      .group({
        groupSlug: values.group,
        ...searchQueryParams,
      })
      .push();
    return;
  }

  pushClassicSearchRoute({
    routeName,
    params: searchQueryParams,
  });
};

export const useSearch = ({ name }: SearchRoute) => ({
  navigateToSearch: (params: SearchPageParams) => {
    filterUrlsParamsAndUpdateUrl({
      values: params,
      urlParams: getUrlParameters(window.location),
      routeName: name,
    });
  },
});

export const useLastSearchQueryRouteParams = (): SearchQueryRouteParams =>
  buildSearchQueryRouteParams({
    values: useAppSelector(searchSelectors.searchParams),
    urlParams: getUrlParameters(window.location),
  });
