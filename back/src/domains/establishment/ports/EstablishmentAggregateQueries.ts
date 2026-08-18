import type { AppellationCode, LocationId, SiretDto } from "shared";
import type { RepositorySearchResultDto } from "./EstablishmentAggregateRepository";

export interface EstablishmentAggregateQueries {
  getSearchResultBySearchQuery(
    siret: SiretDto,
    appellationCode: AppellationCode,
    locationId?: LocationId,
  ): Promise<RepositorySearchResultDto | undefined>;
}
