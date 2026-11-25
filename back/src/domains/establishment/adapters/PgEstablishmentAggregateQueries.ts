import { sql } from "kysely";
import {
  type AdminEstablishmentListItemDto,
  type AppellationCode,
  calculateLimitAndOffsetFromPagination,
  calculatePaginationResult,
  type DataWithPagination,
  type LocationId,
  type SiretDto,
  toLowerCaseWithoutDiacritics,
} from "shared";
import type { KyselyDb } from "../../../config/pg/kysely/kyselyUtils";
import type {
  EstablishmentAggregateQueries,
  GetEstablishmentsForAdminQueryParams,
} from "../ports/EstablishmentAggregateQueries";
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

  public async getEstablishmentsForAdmin({
    search,
    pagination,
  }: GetEstablishmentsForAdminQueryParams): Promise<
    DataWithPagination<AdminEstablishmentListItemDto>
  > {
    const { limit, offset } = calculateLimitAndOffsetFromPagination(pagination);
    const establishments = search
      ? this.transaction
          .selectFrom("establishments")
          .where(
            "siret",
            "in",
            makeSiretsMatchingSearchBuilder(this.transaction, search),
          )
      : this.transaction.selectFrom("establishments");

    const [rows, countResult] = await Promise.all([
      this.transaction
        .with("page", () =>
          establishments
            .select([
              "siret",
              "name",
              "customized_name",
              "created_at",
              "update_date",
            ])
            .orderBy("update_date", "desc")
            .orderBy("siret", "asc")
            .limit(limit)
            .offset(offset),
        )
        .selectFrom("page")
        .innerJoinLateral(
          (eb) =>
            eb
              .selectFrom("establishments_location_infos")
              .select(["city", "post_code"])
              .whereRef("establishment_siret", "=", "page.siret")
              .orderBy("id")
              .limit(1)
              .as("first_location"),
          (join) => join.onTrue(),
        )
        .select((eb) => [
          "page.siret",
          "page.name",
          "page.customized_name",
          "page.created_at",
          "page.update_date",
          "first_location.city",
          "first_location.post_code",
          eb
            .selectFrom("establishments_location_infos")
            .select(sql<number>`CAST(${eb.fn.countAll()} AS INT)`.as("count"))
            .whereRef("establishment_siret", "=", "page.siret")
            .as("locations_count"),
          eb
            .selectFrom("discussions")
            .select(sql<number>`CAST(${eb.fn.countAll()} AS INT)`.as("count"))
            .whereRef("discussions.siret", "=", "page.siret")
            .as("discussions_count"),
          eb
            .selectFrom("conventions")
            .select(sql<number>`CAST(${eb.fn.countAll()} AS INT)`.as("count"))
            .whereRef("conventions.siret", "=", "page.siret")
            .where("conventions.status", "=", "ACCEPTED_BY_VALIDATOR")
            .as("validated_conventions_count"),
        ])
        .orderBy("page.update_date", "desc")
        .orderBy("page.siret", "asc")
        .execute(),
      establishments
        .select((eb) =>
          sql<number>`CAST(${eb.fn.countAll()} AS INT)`.as("count"),
        )
        .executeTakeFirstOrThrow(),
    ]);

    return {
      data: rows.map(
        (row): AdminEstablishmentListItemDto => ({
          siret: row.siret,
          name: row.name ?? "",
          customizedName: row.customized_name,
          city: row.city,
          postcode: row.post_code,
          otherLocationsCount: (row.locations_count ?? 1) - 1,
          createdAt: row.created_at.toISOString(),
          updatedAt: row.update_date.toISOString(),
          discussionsCount: row.discussions_count ?? 0,
          validatedConventionsCount: row.validated_conventions_count ?? 0,
        }),
      ),
      pagination: calculatePaginationResult({
        ...pagination,
        totalRecords: countResult.count,
      }),
    };
  }
}

const makeSiretsMatchingSearchBuilder = (db: KyselyDb, search: string) => {
  const namePattern = `%${search}%`;

  return db
    .selectFrom("establishments")
    .select("siret")
    .where("siret", "=", search)
    .union(
      db
        .selectFrom("establishments")
        .select("siret")
        .where((eb) =>
          eb.or([
            eb("name", "ilike", namePattern),
            eb("customized_name", "ilike", namePattern),
          ]),
        ),
    )
    .union(
      db
        .selectFrom("users")
        .innerJoin(
          "establishments__users",
          "establishments__users.user_id",
          "users.id",
        )
        .select("establishments__users.siret")
        .where((eb) =>
          eb.or([
            eb("users.email", "=", toLowerCaseWithoutDiacritics(search)),
            sql<boolean>`${sql.ref("users.first_name")} || ' ' || ${sql.ref("users.last_name")} || ' ' || ${sql.ref("users.first_name")} ILIKE ${namePattern}`,
          ]),
        ),
    );
};
