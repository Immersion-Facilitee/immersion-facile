import type {
  ApiConsumerName,
  DepartmentCode,
  EstablishmentSearchableByValue,
  ExpectTrue,
  FitForDisableWorkerOption,
  Flavor,
  GroupSlug,
  LocationId,
  NafCode,
  RemoteWorkMode,
  RomeCode,
  SearchSortedBy,
  SiretDto,
  WithAcquisition,
  WithNafCodes,
} from "shared";
import type { ExtractAddedOrMissingSearchFiltersKeys } from "../ports/SearchMadeRepository";

export type SearchMadeId = Flavor<string, "SearchMadeId">;

type SearchMadeFilters = {
  appellationCodes?: string[];
  romeCodes?: RomeCode[]; // TODO: remove when legacy search is off
  searchableBy?: EstablishmentSearchableByValue;
  fitForDisabledWorkers?: FitForDisableWorkerOption[];
  locationIds?: LocationId[];
  nafCodes?: NafCode[];
  remoteWorkModes?: RemoteWorkMode[];
  showOnlyAvailableOffers?: boolean;
  sirets?: SiretDto[];
  departmentCodes?: DepartmentCode[];
  group?: GroupSlug;
};

type _CheckExaustiveSearchFilters = ExpectTrue<
  ExtractAddedOrMissingSearchFiltersKeys<
    SearchMadeFilters,
    "geoParams" | "excludedSirets"
  >
>;

export type SearchMadeCommon = SearchMadeFilters & {
  place?: string;
  voluntaryToImmersion?: boolean;
  sortedBy?: SearchSortedBy;
};

type SearchMadeWithoutGeoParams = SearchMadeCommon &
  WithAcquisition &
  WithNafCodes;

type SearchMadeWithGeoParams = GeoParams & SearchMadeWithoutGeoParams;

export type SearchMade = SearchMadeWithGeoParams | SearchMadeWithoutGeoParams;

export type SearchMadeEntity = {
  id: SearchMadeId;
  needsToBeSearched: boolean;
  apiConsumerName?: ApiConsumerName;
  numberOfResults: number;
} & SearchMade;

export type GeoParams = {
  lat: number;
  lon: number;
  distanceKm: number;
};

export const hasSearchMadeGeoParams = (
  searchMade: SearchMade,
): searchMade is SearchMadeWithGeoParams => {
  const searchMadeWithGeoParams = searchMade as SearchMadeWithGeoParams;
  return hasSearchGeoParams(searchMadeWithGeoParams);
};

export const hasSearchGeoParams = (
  geoParams: Partial<GeoParams>,
): geoParams is GeoParams =>
  !!geoParams.lat &&
  !!geoParams.lon &&
  !!geoParams.distanceKm &&
  geoParams.distanceKm > 0;
