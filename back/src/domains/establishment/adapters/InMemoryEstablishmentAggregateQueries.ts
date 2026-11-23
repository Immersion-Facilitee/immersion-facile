import {
  type AdminEstablishmentListItemDto,
  type AppellationCode,
  calculatePaginationResult,
  type DataWithPagination,
  type LocationId,
  type SiretDto,
} from "shared";
import type {
  EstablishmentAggregateQueries,
  GetEstablishmentsForAdminQueryParams,
} from "../ports/EstablishmentAggregateQueries";
import type { RepositorySearchResultDto } from "../ports/EstablishmentAggregateRepository";
import {
  buildSearchImmersionResultDtoForSiretRomeAndLocation,
  type InMemoryEstablishmentAggregateRepository,
} from "./InMemoryEstablishmentAggregateRepository";

export class InMemoryEstablishmentAggregateQueries
  implements EstablishmentAggregateQueries
{
  constructor(
    private readonly establishmentAggregateRepository: InMemoryEstablishmentAggregateRepository,
  ) {}

  public async getSearchResultBySearchQuery(
    siret: SiretDto,
    appellationCode: AppellationCode,
    locationId?: LocationId,
  ): Promise<RepositorySearchResultDto | undefined> {
    const aggregate =
      this.establishmentAggregateRepository.establishmentAggregates.find(
        (aggregate) => aggregate.establishment.siret === siret,
      );
    if (!aggregate) return;

    const offer = aggregate.offers.find(
      (offer) => offer.appellationCode === appellationCode,
    );
    if (!offer) return;

    const { locations } = aggregate.establishment;

    const resolvedLocationId =
      locations.find((location) => location.id === locationId)?.id ??
      locations[locations.length - 1].id;

    const { nextAvailabilityDate: _, ...searchResult } =
      buildSearchImmersionResultDtoForSiretRomeAndLocation({
        establishmentAgg: aggregate,
        searchedAppellationCode: offer.appellationCode,
        locationId: resolvedLocationId,
        remoteWorkMode: offer.remoteWorkMode,
      });

    return searchResult;
  }

  public establishmentsForAdmin: AdminEstablishmentListItemDto[] = [];

  public getEstablishmentsForAdminCalls: GetEstablishmentsForAdminQueryParams[] =
    [];

  public async getEstablishmentsForAdmin(
    params: GetEstablishmentsForAdminQueryParams,
  ): Promise<DataWithPagination<AdminEstablishmentListItemDto>> {
    this.getEstablishmentsForAdminCalls.push(params);
    return {
      data: this.establishmentsForAdmin,
      pagination: calculatePaginationResult({
        ...params.pagination,
        totalRecords: this.establishmentsForAdmin.length,
      }),
    };
  }
}
