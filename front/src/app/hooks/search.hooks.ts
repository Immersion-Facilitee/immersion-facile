import {
  type AcquisitionParams,
  acquisitionParams,
  frontRoutes,
  type GetOffersFlatQueryParams,
  keys,
} from "shared";
import {
  getUrlParameters,
  isKeyInObjectAndValueNotUndefinedNorEmpty,
} from "src/app/utils/url.utils";
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

type SearchQueryRouteParams = Parameters<typeof frontRoutes.search>[0];

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
