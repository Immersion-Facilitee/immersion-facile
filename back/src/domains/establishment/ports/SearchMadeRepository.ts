import type {
  ExtractAddedOrMissingKeys,
  GetOffersFlatQueryParams,
} from "shared";
import type { SearchMadeEntity } from "../entities/SearchMadeEntity";

const searchFilters = [
  "fitForDisabledWorkers",
  "searchableBy",
  "nafCodes",
  "remoteWorkModes",
  "sirets",
  "appellationCodes",
  "locationIds",
  "showOnlyAvailableOffers",
  "departmentCodes",
  "group",
] as const;

type SearchFilterKey = (typeof searchFilters)[number];

export type SearchImmersionFiltersKey =
  | keyof Pick<GetOffersFlatQueryParams, SearchFilterKey>
  | "geoParams"
  | "romeCodes"
  | "excludedSirets";

export type ExtractAddedOrMissingSearchFiltersKeys<
  T extends object,
  I extends SearchImmersionFiltersKey = never,
> = ExtractAddedOrMissingKeys<SearchImmersionFiltersKey, T, I>;

export interface SearchMadeRepository {
  insertSearchMade: (searchMadeEntity: SearchMadeEntity) => Promise<void>;
}
