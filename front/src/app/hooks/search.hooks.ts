import {
  type AcquisitionParams,
  acquisitionParams,
  frontRoutes,
  type GetOffersFlatQueryParams,
  keys,
  searchParams,
} from "shared";
import {
  filterParamsForRoute,
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
>;

const filterUrlsParamsAndUpdateUrl = ({
  values,
  urlParams,
  routeName,
}: {
  values: SearchPageParams;
  urlParams: Record<string, string>;
  routeName: SearchRoute["name"];
}) => {
  const filteredUrlParams = filterParamsForRoute<Partial<SearchPageParams>>({
    urlParams: {
      ...Object.fromEntries(
        Object.entries(urlParams).filter(([key]) =>
          keys(acquisitionParams).includes(key as keyof AcquisitionParams),
        ),
      ),
      ...values,
    },
    matchingParams: searchParams,
  });

  const encodedUrlParams = {
    ...filteredUrlParams,
    ...encodedSearchUriParams.reduce((acc, currentKey) => {
      if (isKeyInObjectAndValueNotUndefinedNorEmpty(currentKey, values)) {
        acc[currentKey] = encodeURIComponent(values[currentKey]);
      }
      return acc;
    }, filteredUrlParams),
  };
  frontRoutes[routeName](encodedUrlParams).push();
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
