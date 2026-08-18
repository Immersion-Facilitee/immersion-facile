import { type QueryCreator, sql } from "kysely";
import { values } from "ramda";
import {
  type AppellationDto,
  type DateTimeIsoString,
  type EstablishmentSearchableByValue,
  type EstablishmentWebSite,
  type ExpectTrue,
  errors,
  type NumberEmployeesRange,
  pipeWithValue,
  type RemoteWorkMode,
  type RomeCode,
  type SearchSortedBy,
  type WithSort,
} from "shared";
import {
  jsonBuildObject,
  jsonStripNulls,
  type KyselyDb,
} from "../../../config/pg/kysely/kyselyUtils";
import type { Database } from "../../../config/pg/kysely/model/database";
import {
  type GeoParams,
  hasSearchGeoParams,
} from "../entities/SearchMadeEntity";
import type { SearchImmersionResult } from "../ports/EstablishmentAggregateRepository";
import type { ExtractAddedOrMissingSearchFiltersKeys } from "../ports/SearchMadeRepository";
import type { SearchImmersionFilters } from "./PgEstablishmentAggregateRepository";

type _CheckExaustiveSearchFilters = ExpectTrue<
  ExtractAddedOrMissingSearchFiltersKeys<SearchImmersionFilters>
>;

type SearchImmersionResultsParams = {
  filters: SearchImmersionFilters;
  limit: number;
  offset: number;
  shouldCountAll: boolean;
} & WithSort<SearchSortedBy>;

export const updateAllEstablishmentScoresQuery = async (
  db: KyselyDb,
): Promise<void> => {
  const minimumScore = 10;
  const conventionCountCoefficient = 20;

  await db
    .with("convention_counts", (qb) =>
      qb
        .selectFrom("conventions")
        .where("date_submission", ">=", sql<Date>`NOW() - INTERVAL '1 year'`)
        .where("status", "=", "ACCEPTED_BY_VALIDATOR")
        .groupBy("siret")
        .select([
          "siret",
          ({ fn }) => fn.count("siret").as("convention_count"),
        ]),
    )
    .with("discussion_counts", (qb) =>
      qb
        .selectFrom("discussions as d")
        .innerJoin("exchanges", "d.id", "exchanges.discussion_id")
        .where("d.created_at", ">=", sql<Date>`NOW() - INTERVAL '1 year'`)
        .select([
          "siret",
          sql`COUNT
              (DISTINCT d.id)`.as("total_discussions"),
          sql`COUNT
          (DISTINCT CASE WHEN exchanges.sender = 'establishment'::exchange_role THEN d.id END)`.as(
            "answered_discussions",
          ),
        ])
        .groupBy("siret"),
    )
    .updateTable("establishments as e")
    .set({
      /*
        ARRONDI (
          ( 
            Score minimum (10) 
            + 
            ( nombre conventions validée de l'entreprise depuis 12 mois * coef conventions (20) )
          ) 
          * 
          taux de réponse aux candidatures de l'entreprise depuis 12 mois
        )
      */
      score: sql`
      ROUND
      (
        (
          ${minimumScore} 
          +
          COALESCE 
          (
            (
              SELECT convention_count * ${conventionCountCoefficient} 
              FROM convention_counts 
              WHERE siret = e.siret
            ), 
            0
          )
        )
        *
        (
          COALESCE 
          (
            (
              SELECT 
                CASE
                  WHEN total_discussions > 0 
                  THEN (answered_discussions::float / total_discussions) 
                  ELSE 1 
                END
              FROM discussion_counts
              WHERE siret = e.siret
            ), 
            1
          )
        )
      )`,
    })
    .execute();
};

export const deactivateUnresponsiveEstablishmentsQuery = (db: KyselyDb) =>
  db
    .with("establishment_discussions", (qb) =>
      qb
        .selectFrom("discussions as d")
        .innerJoin("exchanges as e", "d.id", "e.discussion_id")
        .select([
          "d.siret",
          sql<number>`COUNT
              (DISTINCT d.id)`.as("total_discussions"),
          sql<number>`COUNT
          (DISTINCT CASE WHEN e.sender = 'establishment'::exchange_role THEN d.id END)`.as(
            "answered_discussions",
          ),
        ])
        .where("d.created_at", ">=", sql<Date>`NOW() - INTERVAL '5 months'`)
        .groupBy("d.siret"),
    )
    .with("recent_conventions", (qb) =>
      qb
        .selectFrom("conventions as c")
        .select("c.siret")
        .where("c.status", "=", "ACCEPTED_BY_VALIDATOR")
        .where("c.date_start", ">=", sql<Date>`NOW() - INTERVAL '5 months'`)
        .groupBy("c.siret"),
    )
    .updateTable("establishments as e")
    .set({
      max_contacts_per_month: 0,
      status: "DEACTIVATED_FOR_LACK_OF_RESPONSES",
      status_updated_at: sql`NOW()`,
    })
    .where((eb) =>
      eb.exists(
        eb
          .selectFrom("establishment_discussions as ed")
          .whereRef("ed.siret", "=", "e.siret")
          .where("ed.total_discussions", ">=", 50)
          .where("ed.answered_discussions", "=", 0),
      ),
    )
    .where((eb) =>
      eb.not(
        eb.exists(
          eb
            .selectFrom("recent_conventions as rc")
            .whereRef("rc.siret", "=", "e.siret"),
        ),
      ),
    )
    .returningAll()
    .execute();

export const searchImmersionResultsQuery = async (
  transaction: KyselyDb,
  {
    filters,
    sort,
    limit,
    offset,
    shouldCountAll,
  }: SearchImmersionResultsParams,
): Promise<{
  totalRecords: number | undefined;
  data: SearchImmersionResult[];
}> => {
  const { geoParams } = filters;

  const countAllRecords = async () => {
    const { count } = await transaction
      .with("filtered_results", (qb) =>
        makeGetFilteredResultsSubQueryBuilder({
          filters,
          sort,
        })(qb),
      )
      .selectFrom("filtered_results as r")
      .select(({ fn }) => fn.countAll<string>().as("count"))
      .executeTakeFirstOrThrow();
    return +count;
  };

  const totalRecords = shouldCountAll ? await countAllRecords() : undefined;

  const results = await transaction
    .with("filtered_results", (qb) =>
      makeGetFilteredResultsSubQueryBuilder({
        filters,
        sort,
      })(qb)
        .limit(limit)
        .offset(offset),
    )
    .selectFrom("filtered_results as r")
    .innerJoin("establishments as e", "e.siret", "r.siret")
    .innerJoin("establishments_location_infos as loc", "loc.id", "r.loc_id")
    .innerJoin(
      "establishments_location_positions as loc_pos",
      "loc.id",
      "loc_pos.id",
    )
    .innerJoin("public_naf_rev2_sous_classes as n", "n.naf_code", "e.naf_code")
    .innerJoin("public_romes_data as ro", "ro.code_rome", "r.code_rome")
    .orderBy("r.rank")
    .select(({ ref, fn }) =>
      jsonStripNulls(
        jsonBuildObject({
          naf: ref("e.naf_code"),
          siret: ref("e.siret"),
          establishmentScore: ref("r.score"),
          isMaxDiscussionsForPeriodReached: ref(
            "e.is_max_discussions_for_period_reached",
          ),
          nextAvailabilityDate: ref("e.next_availability_date"),
          name: ref("e.name"),
          website: ref("e.website").$castTo<EstablishmentWebSite>(),
          additionalInformation: ref("e.additional_information"),
          customizedName: ref("e.customized_name"),
          fitForDisabledWorkers: ref("e.fit_for_disabled_workers"),
          numberOfEmployeeRange:
            ref("e.number_employees").$castTo<NumberEmployeesRange>(),
          nafLabel: ref("n.libelle"),
          contactMode: ref("e.contact_mode"),
          rome: ref("ro.code_rome"),
          romeLabel: ref("ro.libelle_rome"),
          remoteWorkMode: sql<RemoteWorkMode>`${ref("r.remote_work_mode")}`,
          address: jsonBuildObject({
            streetNumberAndAddress: ref("loc.street_number_and_address"),
            postcode: ref("loc.post_code"),
            city: ref("loc.city"),
            departmentCode: ref("loc.department_code"),
          }),
          position: jsonBuildObject({
            lon: ref("loc.lon"),
            lat: ref("loc.lat"),
          }),
          locationId: ref("loc.id"),
          updatedAt: sql<DateTimeIsoString>`date_to_iso(e.update_date)`,
          createdAt: sql<DateTimeIsoString>`date_to_iso(e.created_at)`,
          ...(geoParams && hasSearchGeoParams(geoParams)
            ? {
                distance_m: fn("ST_Distance", [
                  ref("loc_pos.position"),
                  fn("ST_GeographyFromText", [
                    sql`${`POINT(${geoParams.lon} ${geoParams.lat})`}`,
                  ]),
                ]),
              }
            : {}),
          voluntaryToImmersion: sql`TRUE`,
          appellations: ref("r.appellations"),
        }),
      ).as("search_immersion_result"),
    )
    .execute();

  return {
    totalRecords,
    data: results.map(
      ({ search_immersion_result: result }): SearchImmersionResult => {
        if (!result.naf) throw new Error("Missing naf.");
        if (!result.name) throw new Error("Missing name.");

        return {
          address: result.address,
          appellations: result.appellations,
          establishmentScore: result.establishmentScore,
          locationId: result.locationId,
          naf: result.naf,
          nafLabel: result.nafLabel,
          additionalInformation: result.additionalInformation,
          contactMode: result.contactMode,
          createdAt: result.createdAt,
          name: result.name,
          position: result.position,
          rome: result.rome,
          romeLabel: result.romeLabel,
          remoteWorkMode: result.remoteWorkMode,
          siret: result.siret,
          voluntaryToImmersion: Boolean(result.voluntaryToImmersion),
          customizedName: result.customizedName,
          distance_m: result.distance_m,
          fitForDisabledWorkers: result.fitForDisabledWorkers,
          nextAvailabilityDate: result.nextAvailabilityDate
            ? new Date(result.nextAvailabilityDate).toISOString()
            : undefined,
          numberOfEmployeeRange: result.numberOfEmployeeRange,
          updatedAt: result.updatedAt,
          website: result.website,
          isAvailable: !result.isMaxDiscussionsForPeriodReached,
        };
      },
    ),
  };
};

const makeGetFilteredResultsSubQueryBuilder = ({
  filters,
  sort,
}: Pick<SearchImmersionResultsParams, "filters" | "sort">) => {
  const {
    appellationCodes,
    departmentCodes,
    excludedSirets,
    fitForDisabledWorkers,
    geoParams,
    locationIds,
    nafCodes,
    remoteWorkModes,
    romeCodes,
    searchableBy,
    sirets,
    showOnlyAvailableOffers,
  } = filters;

  return (qb: QueryCreator<Database>) =>
    pipeWithValue(
      qb
        .selectFrom((qb) =>
          pipeWithValue(
            qb
              .selectFrom("establishments")
              .select(["siret", "score", "update_date"])
              .where("is_open", "=", true)

              .where((eb) =>
                eb.or([
                  eb("next_availability_date", "<=", new Date()),
                  eb("next_availability_date", "is", null),
                ]),
              ),
            (qb) =>
              excludedSirets?.length
                ? qb.where("establishments.siret", "not in", excludedSirets)
                : qb,
            (qb) =>
              showOnlyAvailableOffers === true
                ? qb.whereRef(
                    "establishments.is_max_discussions_for_period_reached",
                    "is",
                    sql`FALSE`,
                  )
                : qb,
            (qb) =>
              nafCodes?.length
                ? qb.where("establishments.naf_code", "in", nafCodes)
                : qb,
            (qb) => {
              if (fitForDisabledWorkers === undefined) return qb;
              if (fitForDisabledWorkers.length === 0)
                return qb.where(
                  "establishments.fit_for_disabled_workers",
                  "is",
                  null, // this is not possible so this will return no results
                );

              return qb.where(
                "establishments.fit_for_disabled_workers",
                "in",
                fitForDisabledWorkers,
              );
            },
            (qb) =>
              sirets?.length
                ? qb.where("establishments.siret", "in", sirets)
                : qb,
            (qb) => {
              if (searchableBy === "jobSeekers")
                return qb.whereRef(
                  "searchable_by_job_seekers",
                  "is",
                  sql`TRUE`,
                );
              if (searchableBy === "students")
                return qb.whereRef("searchable_by_students", "is", sql`TRUE`);
              return qb;
            },
            (qb) => {
              const hasNoJoinFilters = checkHasNoJoinFilters(filters);

              if (
                hasNoJoinFilters &&
                (sort.by === "date" || sort.by === "score")
              ) {
                return qb
                  .orderBy(
                    sort.by === "date" ? "update_date" : "score",
                    sort.direction,
                  )
                  .limit(5000);
              }
              return qb;
            },
          ).as("e"),
        )
        .innerJoin(
          (eb) =>
            pipeWithValue(
              eb
                .selectFrom("establishments_location_positions")
                .innerJoin(
                  "establishments_location_infos",
                  "establishments_location_infos.id",
                  "establishments_location_positions.id",
                )
                .select([
                  "establishment_siret as siret",
                  "establishments_location_infos.id",
                  "position",
                ]),
              (eb) =>
                geoParams && hasSearchGeoParams(geoParams)
                  ? eb.where(({ fn }) =>
                      fn("ST_DWithin", [
                        "position",
                        fn("ST_GeographyFromText", [
                          sql`${`POINT(${geoParams.lon} ${geoParams.lat})`}`,
                        ]),
                        sql`${(1000 * geoParams.distanceKm).toString()}`,
                      ]),
                    )
                  : eb,
              (eb) =>
                locationIds?.length
                  ? eb.where(
                      "establishments_location_infos.id",
                      "in",
                      locationIds,
                    )
                  : eb,
              (eb) =>
                departmentCodes?.length
                  ? eb.where(
                      "establishments_location_infos.department_code",
                      "in",
                      departmentCodes,
                    )
                  : eb,
            ).as("loc"),
          (join) => join.onRef("loc.siret", "=", "e.siret"),
        )
        .innerJoin(
          (eb) =>
            pipeWithValue(
              eb
                .selectFrom("immersion_offers")
                .leftJoin(
                  "public_appellations_data",
                  "immersion_offers.appellation_code",
                  "public_appellations_data.ogr_appellation",
                )
                .select([
                  "siret",
                  "public_appellations_data.code_rome as rome_code",
                  "created_at",
                  "appellation_code",
                  "remote_work_mode",
                ]),
              (eb) =>
                romeCodes
                  ? eb.where(
                      "public_appellations_data.code_rome",
                      "in",
                      romeCodes,
                    )
                  : eb,
              (eb) =>
                appellationCodes?.length
                  ? eb.where(
                      "immersion_offers.appellation_code",
                      "in",
                      appellationCodes.map((code) => Number.parseInt(code, 10)),
                    )
                  : eb,
              (eb) =>
                remoteWorkModes?.length
                  ? eb.where(
                      "immersion_offers.remote_work_mode",
                      "in",
                      remoteWorkModes,
                    )
                  : eb,
            ).as("offer"),
          (join) => join.onRef("offer.siret", "=", "e.siret"),
        )
        .innerJoin(
          "public_appellations_data as a",
          "a.ogr_appellation",
          "offer.appellation_code",
        )
        .select([
          "e.siret",
          "e.score",
          "loc.id as loc_id",
          "offer.rome_code as code_rome",
          "offer.remote_work_mode",
          sql<AppellationDto[]>`JSON_AGG
              ( JSON_BUILD_OBJECT(
                  'appellationCode', a.ogr_appellation::text,
                  'appellationLabel', a.libelle_appellation_long
                  ) ORDER BY a.ogr_appellation)`.as("appellations"),
          sql<number>`ROW_NUMBER() OVER (ORDER BY ${makeOrderByClauses(
            sort,
            filters,
          )})`.as("rank"),
        ])
        .groupBy([
          "e.siret",
          "e.score",
          "e.update_date",
          "offer.rome_code",
          "offer.remote_work_mode",
          "loc.position",
          "loc.id",
        ])
        .orderBy(makeOrderByClauses(sort, filters)),
    );
};

const makeOrderByClauses = (
  sort: WithSort<SearchSortedBy>["sort"],
  filters?: {
    searchableBy?: EstablishmentSearchableByValue;
    romeCodes?: RomeCode[];
    geoParams?: GeoParams;
  },
) => {
  if (sort.by === "date")
    return sort.direction === "desc"
      ? sql`e.update_date DESC`
      : sql`e.update_date ASC`;
  if (sort.by === "score")
    return sort.direction === "desc" ? sql`e.score DESC` : sql`e.score ASC`;
  const geoParams = filters?.geoParams;
  if (geoParams && hasSearchGeoParams(geoParams))
    return sql`ST_Distance(loc.position,ST_GeographyFromText(${sql`${`POINT(${geoParams.lon} ${geoParams.lat})`}`})) ASC`;

  throw errors.establishment.invalidGeoParams();
};

const checkHasNoJoinFilters = (filters: SearchImmersionFilters): boolean => {
  const isEmptyByKey: Record<keyof SearchImmersionFilters, boolean> = {
    geoParams: !hasSearchGeoParams(filters.geoParams ?? {}),
    romeCodes: !filters.romeCodes,
    appellationCodes: !filters.appellationCodes?.length,
    sirets: !filters.sirets?.length,
    excludedSirets: !filters.excludedSirets?.length,
    nafCodes: !filters.nafCodes?.length,
    remoteWorkModes: !filters.remoteWorkModes?.length,
    locationIds: !filters.locationIds?.length,
    departmentCodes: !filters.departmentCodes?.length,
    fitForDisabledWorkers: true,
    searchableBy: true,
    showOnlyAvailableOffers: true,
  };
  return values(isEmptyByKey).every(Boolean);
};
