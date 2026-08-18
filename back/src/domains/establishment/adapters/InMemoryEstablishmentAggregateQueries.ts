import type { AppellationCode, LocationId, SiretDto } from "shared";
import type { EstablishmentAggregateQueries } from "../ports/EstablishmentAggregateQueries";
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
}
