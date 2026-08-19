import type { AppellationCode, LocationId, SiretDto } from "shared";
import type { KyselyDb } from "../../../config/pg/kysely/kyselyUtils";
import type { EstablishmentAggregateQueries } from "../ports/EstablishmentAggregateQueries";
import type { RepositorySearchResultDto } from "../ports/EstablishmentAggregateRepository";
import { searchImmersionResultsQuery } from "./PgEstablishmentAggregateRepository.sql";

export class PgEstablishmentAggregateQueries
  implements EstablishmentAggregateQueries
{
  constructor(private readonly transaction: KyselyDb) {}

  public async getSearchResultBySearchQuery(
    siret: SiretDto,
    appellationCode: AppellationCode,
    locationId?: LocationId,
  ): Promise<RepositorySearchResultDto | undefined> {
    const isLocationIdExisting = locationId
      ? await this.transaction
          .selectFrom("establishments_location_infos")
          .select("id")
          .where("id", "=", locationId)
          .where("establishment_siret", "=", siret)
          .executeTakeFirst()
          .then((result) => result !== undefined)
      : false;

    const locationIds =
      isLocationIdExisting && locationId ? [locationId] : undefined;

    const { data } = await searchImmersionResultsQuery(this.transaction, {
      limit: 1,
      offset: 0,
      sort: { by: "date", direction: "desc" },
      filters: {
        sirets: [siret],
        appellationCodes: [appellationCode],
        locationIds,
        showOnlyAvailableOffers: false,
      },
      shouldCountAll: false,
    });

    const searchResult = data.at(0);

    if (!searchResult) return;

    const { nextAvailabilityDate: __, ...rest } = searchResult;

    return rest;
  }
}
