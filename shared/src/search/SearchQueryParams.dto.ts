import type { WithAcquisition } from "../acquisition.dto";
import type { DepartmentCode, LocationId } from "../address/address.dto";
import type {
  EstablishmentSearchableByValue,
  FitForDisableWorkerOption,
} from "../formEstablishment/FormEstablishment.dto";
import type { GroupSlug } from "../group/group.dto";
import type { NafCode, WithNafCodes } from "../naf/naf.dto";
import type {
  PaginationQueryParams,
  SortDirection,
} from "../pagination/pagination.dto";
import type { WithOptionalRemoteWorkModes } from "../remoteWorkMode/remoteWorkMode.dto";
import type {
  AppellationCode,
  RomeCode,
} from "../romeAndAppellationDtos/romeAndAppellation.dto";
import type { SiretDto } from "../siret/siret";

export const searchSortedByOptions = ["distance", "date", "score"] as const;
export type SearchSortedBy = (typeof searchSortedByOptions)[number];

type LatLon = {
  latitude: number;
  longitude: number;
};

export type LatLonDistance = LatLon & {
  distanceKm: number;
};

export type LegacyGeoQueryParamsWithSortedBy<T extends SearchSortedBy> = {
  sortedBy: T;
} & LatLonDistance;

export type LegacyGeoQueryOptionalParamsWithSortedBy<T extends SearchSortedBy> =
  {
    sortedBy: T;
  } & Partial<LatLonDistance>;

type LegacySearchQueryCommonParamsDto = {
  voluntaryToImmersion?: boolean;
} & LegacySearchCommonParamsDto &
  WithAcquisition &
  WithNafCodes;

export type LegacySearchQueryWithOptionalGeoParamsDto =
  LegacySearchQueryCommonParamsDto &
    LegacyGeoQueryOptionalParamsWithSortedBy<"date" | "score">;

export type LegacySearchQueryParamsWithGeoParams =
  LegacySearchQueryCommonParamsDto &
    LegacyGeoQueryParamsWithSortedBy<"distance">;

export type LegacySearchQueryBaseWithoutAppellationsAndRomeDto =
  | LegacySearchQueryParamsWithGeoParams
  | LegacySearchQueryWithOptionalGeoParamsDto;

export type LegacySearchQueryParamsDto =
  LegacySearchQueryBaseWithoutAppellationsAndRomeDto &
    LegacySearchQueryParamsAppellationsAndRome;

type LegacySearchQueryParamsAppellationsAndRome = {
  appellationCodes?: AppellationCode[];
  rome?: RomeCode;
};

type LegacySearchCommonParamsDto = {
  place?: string;
  establishmentSearchableBy?: EstablishmentSearchableByValue;
  fitForDisabledWorkers?: boolean | undefined;
};

// NEW MODEL (from v3)

type WithAppellationCodes = {
  appellationCodes: AppellationCode[];
};

type GetOffersFlatParamsCommon = WithAcquisition & {
  place?: string; // this is just to keep, the data typed for location by the user. Lat/Lon will be used in the query
  fitForDisabledWorkers?: FitForDisableWorkerOption[];
  locationIds?: LocationId[];
  nafCodes?: NafCode[];
  searchableBy?: EstablishmentSearchableByValue;
  sirets?: SiretDto[];
  departmentCodes?: DepartmentCode[];
  showOnlyAvailableOffers?: boolean;
  group?: GroupSlug;
} & Partial<WithAppellationCodes> &
  WithOptionalRemoteWorkModes;

export type GeoQueryParamsWithSortedBy<T extends SearchSortedBy> = {
  sortBy: T;
  sortOrder: SortDirection;
} & LatLonDistance;

export type GeoQueryOptionalParamsWithSortedBy<T extends SearchSortedBy> = {
  sortBy: T;
  sortOrder: SortDirection;
} & Partial<LatLonDistance>;

export type SearchQueryWithOptionalGeoParamsDto = GetOffersFlatParamsCommon &
  GeoQueryOptionalParamsWithSortedBy<"date" | "score">;

export type SearchQueryParamsWithGeoParams = GetOffersFlatParamsCommon &
  GeoQueryParamsWithSortedBy<"distance">;

export type GetOffersFlatQueryParams = PaginationQueryParams &
  (SearchQueryParamsWithGeoParams | SearchQueryWithOptionalGeoParamsDto);

export type GetExternalOffersFlatQueryParams = {
  appellationCode: AppellationCode;
} & WithNafCodes &
  LatLonDistance;

export const hasSearchGeoParams = (
  geoParams: Partial<LatLonDistance>,
): geoParams is LatLonDistance =>
  !!geoParams.latitude &&
  !!geoParams.longitude &&
  !!geoParams.distanceKm &&
  geoParams.distanceKm > 0;
