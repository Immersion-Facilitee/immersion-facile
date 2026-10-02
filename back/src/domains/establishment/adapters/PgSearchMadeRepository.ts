import { sql } from "kysely";
import { uniq } from "ramda";
import type { AppellationCode, NafCode } from "shared";
import { type KyselyDb, values } from "../../../config/pg/kysely/kyselyUtils";
import {
  hasSearchMadeGeoParams,
  type SearchMadeEntity,
  type SearchMadeId,
} from "../entities/SearchMadeEntity";
import type { SearchMadeRepository } from "../ports/SearchMadeRepository";

export class PgSearchMadeRepository implements SearchMadeRepository {
  constructor(private transaction: KyselyDb) {}

  public async insertSearchMade(searchMade: SearchMadeEntity) {
    await this.#insertSearchMade(searchMade);

    if (searchMade.appellationCodes && searchMade.appellationCodes.length > 0) {
      await this.#insertAppellationCodes(
        searchMade.id,
        searchMade.appellationCodes,
      );
    }
    if (searchMade.nafCodes && searchMade.nafCodes.length > 0) {
      await this.#insertNafCodes(searchMade.id, searchMade.nafCodes);
    }
  }

  async #insertSearchMade(searchMade: SearchMadeEntity): Promise<void> {
    await this.transaction
      .insertInto("searches_made")
      .columns([
        "acquisition_campaign",
        "acquisition_keyword",
        "address",
        "api_consumer_name",
        "department_code",
        "distance",
        "fit_for_disabled_workers",
        "gps",
        "group_slug",
        "id",
        "lat",
        "location_ids",
        "lon",
        "needstobesearched",
        "number_of_results",
        "remote_work_modes",
        "searchable_by",
        "show_only_available_offers",
        "sirets",
        "sorted_by",
        "voluntary_to_immersion",
      ])
      .expression((eb) =>
        eb
          .selectFrom(
            values(
              [
                {
                  id: searchMade.id,
                  needstobesearched: searchMade.needsToBeSearched,
                  voluntary_to_immersion: searchMade.voluntaryToImmersion,
                  api_consumer_name: searchMade.apiConsumerName,
                  sorted_by: searchMade.sortedBy,
                  address: searchMade.place,
                  number_of_results: searchMade.numberOfResults,
                  searchable_by: searchMade.searchableBy,
                  acquisition_keyword: searchMade.acquisitionKeyword,
                  acquisition_campaign: searchMade.acquisitionCampaign,
                  fit_for_disabled_workers: optionalJsonb(
                    searchMade.fitForDisabledWorkers,
                  ),
                  group_slug: searchMade.group ?? null,
                  location_ids: optionalJsonb(searchMade.locationIds),
                  remote_work_modes: optionalJsonb(searchMade.remoteWorkModes),
                  show_only_available_offers:
                    searchMade.showOnlyAvailableOffers ?? null,
                  sirets: optionalJsonb(searchMade.sirets),
                  ...(hasSearchMadeGeoParams(searchMade)
                    ? {
                        lat: searchMade.lat,
                        lon: searchMade.lon,
                        distance: searchMade.distanceKm,
                        gps: `POINT(${searchMade.lon} ${searchMade.lat})`,
                      }
                    : {
                        lat: null,
                        lon: null,
                        distance: null,
                        gps: null,
                      }),
                },
              ],
              "values",
            ),
          )
          .leftJoin("public_department_region", (join) =>
            join.on((eb) =>
              eb.and([
                eb("values.gps", "is not", null),
                eb.fn<boolean>("ST_DWithin", [
                  "public_department_region.shape",
                  sql`${eb.ref("values.gps")}::geography`,
                  sql`0`,
                ]),
              ]),
            ),
          )
          .select((eb) => [
            "values.acquisition_campaign",
            "values.acquisition_keyword",
            "values.address",
            "values.api_consumer_name",
            "public_department_region.department_code",
            eb.fn
              .coalesce(
                sql`${eb.ref("values.distance")}::double precision`,
                sql`NULL`,
              )
              .as("distance"),
            eb.fn
              .coalesce(
                sql`${eb.ref("values.fit_for_disabled_workers")}::jsonb`,
                sql`NULL`,
              )
              .as("fit_for_disabled_workers"),
            eb.fn
              .coalesce(sql`${eb.ref("values.gps")}::geography`, sql`NULL`)
              .as("gps"),
            "values.group_slug",
            sql`${eb.ref("values.id")}::uuid`.as("id"),
            eb.fn
              .coalesce(
                sql`${eb.ref("values.lat")}::double precision`,
                sql`NULL`,
              )
              .as("lat"),
            eb.fn
              .coalesce(sql`${eb.ref("values.location_ids")}::jsonb`, sql`NULL`)
              .as("location_ids"),
            eb.fn
              .coalesce(
                sql`${eb.ref("values.lon")}::double precision`,
                sql`NULL`,
              )
              .as("lon"),
            eb.fn
              .coalesce(
                sql`${eb.ref("values.needstobesearched")}::boolean`,
                sql`NULL`,
              )
              .as("needstobesearched"),
            eb.fn
              .coalesce(
                sql`${eb.ref("values.number_of_results")}::integer`,
                sql`NULL`,
              )
              .as("number_of_results"),
            eb.fn
              .coalesce(
                sql`${eb.ref("values.remote_work_modes")}::jsonb`,
                sql`NULL`,
              )
              .as("remote_work_modes"),
            eb.fn
              .coalesce(
                sql`${eb.ref("values.searchable_by")}::searchable_by`,
                sql`NULL`,
              )
              .as("searchable_by"),
            eb.fn
              .coalesce(
                sql`${eb.ref("values.show_only_available_offers")}::boolean`,
                sql`NULL`,
              )
              .as("show_only_available_offers"),
            eb.fn
              .coalesce(sql`${eb.ref("values.sirets")}::jsonb`, sql`NULL`)
              .as("sirets"),
            eb.fn
              .coalesce(
                sql`${eb.ref("values.sorted_by")}::sorted_by`,
                sql`NULL`,
              )
              .as("sorted_by"),
            eb.fn
              .coalesce(
                sql`${eb.ref("values.voluntary_to_immersion")}::boolean`,
                sql`NULL`,
              )
              .as("voluntary_to_immersion"),
          ]),
      )
      .execute();
  }

  async #insertAppellationCodes(
    id: SearchMadeId,
    appellationCodes: AppellationCode[],
  ): Promise<void> {
    const uniqAppellationCodes = uniq(appellationCodes);

    await this.transaction
      .insertInto("searches_made__appellation_code")
      .values([
        ...uniqAppellationCodes.map((appellationCode) => ({
          search_made_id: id,
          appellation_code: appellationCode,
        })),
      ])
      .execute();
  }

  async #insertNafCodes(
    search_made_id: SearchMadeId,
    nafCodes: NafCode[],
  ): Promise<void> {
    const uniqueNafCodes = uniq(nafCodes);

    await this.transaction
      .insertInto("searches_made__naf_code")
      .values([
        ...uniqueNafCodes.map((naf_code) => ({
          search_made_id,
          naf_code,
        })),
      ])
      .execute();
  }
}

const optionalJsonb = (value: unknown[] | undefined): string | null =>
  value ? JSON.stringify(value) : null;
