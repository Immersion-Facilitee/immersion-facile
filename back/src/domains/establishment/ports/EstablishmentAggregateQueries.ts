import type {
  AdminEstablishmentListItemDto,
  AppellationCode,
  DataWithPagination,
  LocationId,
  SiretDto,
  WithRequiredPagination,
} from "shared";
import type { RepositorySearchResultDto } from "./EstablishmentAggregateRepository";

export type GetEstablishmentsForAdminQueryParams = WithRequiredPagination & {
  search?: string;
};

export interface EstablishmentAggregateQueries {
  getSearchResultBySearchQuery(
    siret: SiretDto,
    appellationCode: AppellationCode,
    locationId?: LocationId,
  ): Promise<RepositorySearchResultDto | undefined>;
  getEstablishmentsForAdmin(
    params: GetEstablishmentsForAdminQueryParams,
  ): Promise<DataWithPagination<AdminEstablishmentListItemDto>>;
}
