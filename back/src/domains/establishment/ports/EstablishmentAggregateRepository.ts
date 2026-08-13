import type {
  AppellationAndRomeDto,
  AppellationCode,
  DataWithPagination,
  DateTimeIsoString,
  DepartmentCode,
  EstablishmentSearchableByValue,
  FitForDisableWorkerOption,
  InternalOfferDto,
  LocationId,
  NafCode,
  RemoteWorkMode,
  SearchSortedBy,
  SiretDto,
  UserId,
  WithRequiredPagination,
  WithSort,
} from "shared";
import type { EstablishmentAggregate } from "../entities/EstablishmentAggregate";
import type { EstablishmentEntity } from "../entities/EstablishmentEntity";
import type { OfferEntity } from "../entities/OfferEntity";
import type { GeoParams, SearchMade } from "../entities/SearchMadeEntity";

export type RepositorySearchResultDto = Omit<InternalOfferDto, "urlOfPartner">;
export type RepositorySearchImmersionResult = Omit<
  SearchImmersionResult,
  "urlOfPartner"
>;
export type OfferWithSiret = OfferEntity & { siret: SiretDto };
export type SearchImmersionResult = InternalOfferDto & {
  nextAvailabilityDate?: DateTimeIsoString;
};

export type LegacySearchImmersionParams = {
  searchMade: SearchMade;
  fitForDisabledWorkers?: boolean;
  maxResults?: number;
};

type GetOffersFilters = {
  appellationCodes?: AppellationCode[];
  fitForDisabledWorkers?: FitForDisableWorkerOption[]; // if not defined -> return all
  geoParams?: GeoParams;
  locationIds?: LocationId[];
  nafCodes?: NafCode[];
  remoteWorkModes?: RemoteWorkMode[];
  searchableBy?: EstablishmentSearchableByValue; // if not defined -> return all
  sirets?: SiretDto[];
  excludedSirets?: SiretDto[];
  showOnlyAvailableOffers: boolean;
  departmentCodes?: DepartmentCode[];
};

export type GetOffersParams = WithRequiredPagination &
  WithSort<SearchSortedBy> & {
    filters: GetOffersFilters;
  };

export type EstablishmentAggregateFilters = {
  nameIncludes?: string;
  sirets?: SiretDto[];
  userId?: UserId;
};

export interface EstablishmentAggregateRepository {
  delete(siret: SiretDto): Promise<void>;
  insertEstablishmentAggregate(
    establishmentAggregate: EstablishmentAggregate,
  ): Promise<void>;
  updateEstablishmentAggregate(
    establishmentAggregate: EstablishmentAggregate,
    updatedAt: Date,
  ): Promise<void>;
  getEstablishmentAggregateBySiret(
    siret: SiretDto,
  ): Promise<EstablishmentAggregate | undefined>;
  getEstablishmentAggregatesByFilters(
    params: EstablishmentAggregateFilters,
  ): Promise<EstablishmentAggregate[]>;
  hasEstablishmentAggregateWithSiret(siret: string): Promise<boolean>;
  updateEstablishmentsWithInseeData(
    inseeCheckDate: Date,
    params: UpdateEstablishmentsWithInseeDataParams,
  ): Promise<void>;
  markEstablishmentAsSearchableWhenRecentDiscussionAreUnderMaxContactPerMonth(
    fromDate: Date,
  ): Promise<number>;

  getOffersAsAppellationAndRomeDtosBySiret(
    siret: string,
  ): Promise<AppellationAndRomeDto[]>;

  getSearchResultBySearchQuery(
    siret: SiretDto,
    appellationCode: AppellationCode,
    locationId?: LocationId,
  ): Promise<RepositorySearchResultDto | undefined>;
  legacySearchImmersionResults(
    searchImmersionParams: LegacySearchImmersionParams,
  ): Promise<RepositorySearchImmersionResult[]>;
  getOffers(
    params: GetOffersParams,
  ): Promise<DataWithPagination<InternalOfferDto>>;

  getSiretsOfEstablishmentsWithRomeCode(rome: string): Promise<SiretDto[]>;
  getSiretsOfEstablishmentsNotUpdatedSince(params: {
    updatedBefore: Date;
    limit: number;
    offset?: number;
  }): Promise<SiretDto[]>;
  getSiretsOfEstablishmentsNotCheckedAtInseeSince(
    checkDate: Date,
    maxResults: number,
  ): Promise<SiretDto[]>;
  getSiretsInRepoFromSiretList(sirets: SiretDto[]): Promise<SiretDto[]>;
}

export type ValuesToUpdateFromInseeApi = Partial<
  Pick<
    EstablishmentEntity,
    "name" | "numberEmployeesRange" | "isOpen" | "nafDto"
  >
>;

export type UpdateEstablishmentsWithInseeDataParams = Partial<
  Record<SiretDto, ValuesToUpdateFromInseeApi>
>;
