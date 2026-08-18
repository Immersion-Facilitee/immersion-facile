import type { AppellationCode, LocationId, SiretDto } from "shared";
import type { EstablishmentAggregateQueries } from "../ports/EstablishmentAggregateQueries";
import type { RepositorySearchResultDto } from "../ports/EstablishmentAggregateRepository";

export class InMemoryEstablishmentAggregateQueries
  implements EstablishmentAggregateQueries
{
  getSearchResultBySearchQuery(
    siret: SiretDto,
    appellationCode: AppellationCode,
    locationId?: LocationId,
  ): Promise<RepositorySearchResultDto | undefined> {
    throw new Error("Method not implemented.");
  }
}
