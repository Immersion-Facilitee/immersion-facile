import { parseISO, startOfDay } from "date-fns";
import { sql } from "kysely";
import { map, partition, toPairs } from "ramda";
import {
  type AbsoluteUrl,
  type AddressDto,
  type AgencyDto,
  type AgencyId,
  type AgencyKind,
  type AgencyRole,
  type AgencyStatus,
  type AgencyUsersRights,
  type AgencyWithUsersRights,
  activeAgencyStatuses,
  calculateLimitAndOffsetFromPagination,
  calculatePaginationResult,
  type DataWithPagination,
  type DateString,
  type DelegationAgencyInfo,
  type DepartmentCode,
  errors,
  isTruthy,
  isWithAgencyRole,
  type OmitFromExistingKeys,
  type PaginationQueryParams,
  pipeWithValue,
  type SiretDto,
  type UserId,
  type WithUserFilters,
} from "shared";
import { z } from "zod";
import {
  cast,
  jsonBuildObject,
  jsonStripNulls,
  type KyselyDb,
} from "../../../config/pg/kysely/kyselyUtils";
import { createLogger } from "../../../utils/logger";
import { getOrCreatePhoneIds } from "../../core/phone-number/adapters/pgPhoneHelper";
import {
  type AgencyRepository,
  type AgencyRightOfUser,
  type AgencyWithNumberOfUsersToReview,
  type GetAgenciesFilters,
  type GetAgencyIdsFilters,
  type PartialAgencyWithUsersRights,
  throwIfAgencyHasNoUsersWhileNotClosedOrRejected,
} from "../ports/AgencyRepository";

const logger = createLogger(__filename);

const MAX_AGENCIES_RETURNED = 1500;

// PostgreSQL uuid accepts GUID-shaped values without RFC version/variant bits,
// so use z.guid() here instead of stricter z.uuid().
const guidSchema = z.guid();

const isUuid = (value: string) => guidSchema.safeParse(value.trim()).success;

export class PgAgencyRepository implements AgencyRepository {
  constructor(private transaction: KyselyDb) {}

  public async insert(
    agency: AgencyWithUsersRights,
    updatedAt?: DateString,
  ): Promise<void> {
    await this.insertAgency(agency, updatedAt);
    await this.#saveAgencyRights(agency);
  }

  private async insertAgency(
    agency: AgencyWithUsersRights,
    updatedAt?: DateString,
  ) {
    const phoneId = (
      await getOrCreatePhoneIds(this.transaction, [agency.phoneNumber])
    )[agency.phoneNumber];

    return this.transaction
      .insertInto("agencies")
      .values(({ fn }) => ({
        id: agency.id,
        name: agency.name,
        contact_email: agency.contactEmail,
        status: agency.status,
        kind: agency.kind,
        email_signature: agency.signature,
        logo_url: agency.logoUrl,
        position: fn("ST_MakePoint", [
          sql`${agency.position.lon}, ${agency.position.lat}`,
        ]),
        agency_siret: agency.agencySiret,
        code_safir: agency.codeSafir,
        street_number_and_address: agency.address.streetNumberAndAddress,
        post_code: agency.address.postcode,
        city: agency.address.city,
        department_code: agency.address.departmentCode,
        covered_departments: JSON.stringify(agency.coveredDepartments),
        refers_to_agency_id: agency.refersToAgencyId,
        acquisition_campaign: agency.acquisitionCampaign,
        acquisition_keyword: agency.acquisitionKeyword,
        phone_id: phoneId,
        status_justification: agency.statusJustification,
        delegation_info: agency.delegationAgencyInfo
          ? JSON.stringify(agency.delegationAgencyInfo)
          : null,
        created_at: agency.createdAt
          ? sql<Date>`${agency.createdAt}::timestamp`
          : sql`now()`,
        updated_at: updatedAt ?? sql`now()`,
      }))
      .execute()
      .catch((error) => {
        // Detect attempts to re-insert an existing key (error code 23505: unique_violation)
        // See https://www.postgresql.org/docs/10/errcodes-appendix.html
        if (error.code === "23505") {
          logger.error({ error });
          throw errors.agency.alreadyExist(agency.id);
        }
        throw error;
      });
  }

  public async update(agency: PartialAgencyWithUsersRights): Promise<void> {
    const phoneId = agency.phoneNumber
      ? (await getOrCreatePhoneIds(this.transaction, [agency.phoneNumber]))[
          agency.phoneNumber
        ]
      : undefined;

    await this.transaction
      .updateTable("agencies")
      .set(({ fn }) => ({
        name: agency.name,
        contact_email: agency.contactEmail,
        status: agency.status,
        kind: agency.kind,
        email_signature: agency.signature,
        logo_url: agency.logoUrl,
        position: agency.position
          ? fn("ST_MakePoint", [
              sql`${agency.position.lon}, ${agency.position.lat}`,
            ])
          : undefined,
        agency_siret: agency.agencySiret,
        code_safir: agency.codeSafir,
        street_number_and_address: agency.address?.streetNumberAndAddress,
        post_code: agency.address?.postcode,
        city: agency.address?.city,
        department_code: agency.address?.departmentCode,
        covered_departments:
          agency.coveredDepartments &&
          JSON.stringify(agency.coveredDepartments),
        refers_to_agency_id: agency.refersToAgencyId,
        updated_at: sql`NOW()`,
        status_justification: agency.statusJustification,
        phone_id: phoneId,
        delegation_info:
          agency.delegationAgencyInfo &&
          JSON.stringify(agency.delegationAgencyInfo),
      }))
      .where("id", "=", agency.id)
      .execute();

    if (agency.usersRights)
      await this.#saveAgencyRights({
        id: agency.id,
        status: agency.status,
        usersRights: agency.usersRights,
      });
  }

  public async getAllAgenciesWithUsersToReview(): Promise<
    AgencyWithNumberOfUsersToReview[]
  > {
    const agencyIdsWithUsersToReview = await this.transaction
      .selectFrom("users__agencies")
      .select(({ ref, fn }) => [
        cast<AgencyId>(ref("agency_id")).as("agencyId"),
        fn.count<number>("user_id").as("numberOfUsersToReview"),
      ])
      .where("roles", "@>", `["to-review"]`)
      .groupBy("agency_id")
      .execute();

    if (agencyIdsWithUsersToReview.length === 0) return [];

    const agencyIds = agencyIdsWithUsersToReview.map(
      (result) => result.agencyId,
    );

    const results = await this.#getAgencyWithJsonBuiltQueryBuilder()
      .where("agencies.id", "in", agencyIds)
      .execute();

    return results
      .map(({ agency }) => {
        const agencyWithRights = this.#pgAgencyToAgencyWithRights(agency);
        if (!agencyWithRights) return null;

        const numberOfUsersToReview = agencyIdsWithUsersToReview.find(
          (result) => result.agencyId === agencyWithRights.id,
        )?.numberOfUsersToReview;

        return {
          agency: agencyWithRights,
          numberOfUsersToReview: Number(numberOfUsersToReview),
        };
      })
      .filter(isTruthy);
  }

  public async getById(
    id: AgencyId,
  ): Promise<AgencyWithUsersRights | undefined> {
    const result = await this.#getAgencyWithJsonBuiltQueryBuilder()
      .where("agencies.id", "=", id)
      .executeTakeFirst();

    return this.#pgAgencyToAgencyWithRights(result?.agency);
  }

  public async getBySafirAndActiveStatus(
    safirCode: string,
  ): Promise<AgencyWithUsersRights[]> {
    const results = await this.#getAgencyWithJsonBuiltQueryBuilder()
      .where("agencies.code_safir", "=", safirCode)
      .where("agencies.status", "in", activeAgencyStatuses)
      .execute();

    return results
      .map((result) => this.#pgAgencyToAgencyWithRights(result.agency))
      .filter(isTruthy);
  }

  public async getByIds(ids: AgencyId[]): Promise<AgencyWithUsersRights[]> {
    if (ids.length === 0) return [];
    const results = await this.#getAgencyWithJsonBuiltQueryBuilder()
      .where("agencies.id", "in", ids)
      .orderBy("agencies.updated_at", "desc")
      .execute();

    const [presentAgencyIds, missingAgencyIds] = partition(
      (id) => results.some((result) => result.agency.id === id),
      ids,
    );

    if (missingAgencyIds.length)
      throw errors.agencies.notFound({ missingAgencyIds, presentAgencyIds });

    return results
      .map(({ agency }) => this.#pgAgencyToAgencyWithRights(agency))
      .filter(isTruthy);
  }

  public async getAgencies({
    filters = {},
    pagination,
  }: {
    filters?: GetAgenciesFilters;
    pagination?: PaginationQueryParams;
  }): Promise<DataWithPagination<AgencyWithUsersRights>> {
    const {
      departmentCode,
      kinds,
      doesNotReferToOtherAgency,
      nameIncludes,
      position,
      sirets,
      status,
      createdAtBefore,
      userIds,
      delegationConventionEndDate,
      ...rest
    } = filters;

    rest satisfies Record<string, never>;

    if (userIds?.length === 0)
      return {
        data: [],
        pagination: calculatePaginationResult({
          page: pagination?.page ?? 1,
          perPage: Math.min(
            pagination?.perPage ?? MAX_AGENCIES_RETURNED,
            MAX_AGENCIES_RETURNED,
          ),
          totalRecords: 0,
        }),
      };

    const filteredBuilder = pipeWithValue(
      this.#getAgencyWithJsonBuiltQueryBuilder(),
      (b) =>
        departmentCode
          ? b.where(
              "agencies.covered_departments",
              "@>",
              `["${departmentCode}"]`,
            )
          : b,
      (b) => {
        if (!nameIncludes) return b;

        const trimmedNameIncludes = nameIncludes.trim();
        if (isUuid(trimmedNameIncludes))
          return b.where("agencies.id", "=", trimmedNameIncludes);

        const words = nameIncludes.split(/[^\p{L}\p{N}]+/u).filter(isTruthy);

        return words.reduce(
          (acc, word) =>
            acc.where(
              sql<boolean>`unaccent(${sql.ref("agencies.name")}) ilike unaccent(${`%${word}%`})`,
            ),
          b,
        );
      },
      (b) => (kinds ? b.where("agencies.kind", "in", kinds) : b),
      (b) => (status ? b.where("agencies.status", "in", status) : b),
      (b) =>
        doesNotReferToOtherAgency
          ? b.where("agencies.refers_to_agency_id", "is", null)
          : b,
      (b) =>
        sirets && sirets.length > 0
          ? b.where("agencies.agency_siret", "in", sirets)
          : b,
      (b) =>
        createdAtBefore
          ? b.where("agencies.created_at", "<=", createdAtBefore)
          : b,
      (b) =>
        position
          ? b.where(
              ({ fn }) =>
                fn("ST_Distance", [
                  fn("ST_GeographyFromText", [
                    sql`${`POINT(${position.position.lon} ${position.position.lat})`}`,
                  ]),
                  "agencies.position",
                ]),
              "<=",
              position.distance_km * 1000,
            )
          : b,
      (b) =>
        userIds
          ? b.where((eb) =>
              eb.exists(
                eb
                  .selectFrom("users__agencies as sub")
                  .whereRef("sub.agency_id", "=", "agencies.id")
                  .where("sub.user_id", "in", userIds),
              ),
            )
          : b,
      (b) =>
        delegationConventionEndDate
          ? b
              .where("agencies.delegation_info", "is not", null)
              .where(
                sql<boolean>`(${sql.ref("agencies.delegation_info")} ->> 'delegationEndDate')::timestamptz::date = ${sql`${startOfDay(parseISO(delegationConventionEndDate))}::date`}`,
              )
          : b,
    );

    const resolvedPagination = {
      page: pagination?.page ?? 1,
      perPage: Math.min(
        pagination?.perPage ?? MAX_AGENCIES_RETURNED,
        MAX_AGENCIES_RETURNED,
      ),
    };
    const { limit, offset } =
      calculateLimitAndOffsetFromPagination(resolvedPagination);

    const results = await filteredBuilder
      .select(sql<number>`CAST(COUNT(*) OVER() AS INT)`.as("total_count"))
      .orderBy("agencies.id", "asc")
      .limit(limit)
      .offset(offset)
      .execute();

    const totalRecords = results[0]?.total_count ?? 0;

    return {
      data: results
        .map(({ agency }) => this.#pgAgencyToAgencyWithRights(agency))
        .filter(isTruthy),
      pagination: calculatePaginationResult({
        ...resolvedPagination,
        totalRecords,
      }),
    };
  }

  public async getAgencyIdsByFilters(
    filters: GetAgencyIdsFilters,
  ): Promise<AgencyId[]> {
    const { kinds, statuses, ...rest } = filters;
    rest satisfies Record<string, never>;

    const results = await pipeWithValue(
      this.transaction.selectFrom("agencies").select("agencies.id"),
      (b) => (kinds ? b.where("agencies.kind", "in", kinds) : b),
      (b) => (statuses ? b.where("agencies.status", "in", statuses) : b),
    )
      .orderBy("agencies.id", "asc")
      .execute();

    return results.map(({ id }) => id);
  }

  public async getAgenciesRelatedToAgency(
    id: AgencyId,
  ): Promise<AgencyWithUsersRights[]> {
    const results = await this.#getAgencyWithJsonBuiltQueryBuilder()
      .where("agencies.refers_to_agency_id", "=", id)
      .orderBy("agencies.updated_at", "desc")
      .execute()
      .then(map((row) => row.agency));

    return results
      .map((result) => this.#pgAgencyToAgencyWithRights(result))
      .filter(isTruthy);
  }

  public async getImmersionFacileAgencyId(): Promise<AgencyId | undefined> {
    return this.transaction
      .selectFrom("agencies")
      .select("id")
      .where("kind", "=", "immersion-facile")
      .executeTakeFirst()
      .then((row) => row?.id);
  }

  public async getUserIdWithAgencyRightsByFilters(
    filters: WithUserFilters,
  ): Promise<UserId[]> {
    const results = await pipeWithValue(
      this.transaction.selectFrom("users__agencies").select("user_id"),
      (b) =>
        !isWithAgencyRole(filters)
          ? b.where("agency_id", "=", filters.agencyId)
          : b.where("roles", "@>", `["${filters.agencyRole}"]`),
    )
      .orderBy("user_id", "asc")
      .execute();
    return results.map((result) => result.user_id);
  }

  public async getAgenciesRightsByUserId(
    id: UserId,
  ): Promise<AgencyRightOfUser[]> {
    const results = await this.transaction
      .selectFrom("users__agencies")
      .select(({ ref }) => [
        jsonBuildObject({
          isNotifiedByEmail: ref("is_notified_by_email"),
          roles: ref("roles").$castTo<AgencyRole[]>(),
          agencyId: ref("agency_id"),
        }).as("rights"),
      ])
      .where("user_id", "=", id)
      .orderBy("agency_id", "asc")
      .execute();

    return results.map(({ rights }) => ({
      agencyId: rights.agencyId,
      roles: rights.roles,
      isNotifiedByEmail: rights.isNotifiedByEmail,
    }));
  }

  public async alreadyHasActiveAgencyWithSameAddressAndKind({
    idToIgnore,
    kind,
    address,
  }: {
    idToIgnore: AgencyId;
    kind: AgencyKind;
    address: AddressDto;
  }) {
    const alreadyExistingAgencies = await this.transaction
      .selectFrom("agencies")
      .selectAll()
      .where("kind", "=", kind)
      .where("status", "in", [...activeAgencyStatuses, "needsReview"])
      .where("street_number_and_address", "=", address.streetNumberAndAddress)
      .where("city", "=", address.city)
      .where("id", "!=", idToIgnore)
      .execute();

    return alreadyExistingAgencies.length > 0;
  }

  #getAgencyWithJsonBuiltQueryBuilder() {
    return this.transaction
      .selectFrom("agencies")
      .leftJoin(
        "agencies as refered_agencies",
        "agencies.refers_to_agency_id",
        "refered_agencies.id",
      )
      .innerJoin("phone_numbers", "agencies.phone_id", "phone_numbers.id")
      .leftJoin("users__agencies", "agencies.id", "users__agencies.agency_id")
      .select(({ ref, fn }) => [
        jsonBuildObject({
          id: cast<AgencyId>(ref("agencies.id")),
          name: ref("agencies.name"),
          status: cast<AgencyStatus>(ref("agencies.status")),
          contactEmail: ref("agencies.contact_email"),
          kind: cast<AgencyKind>(ref("agencies.kind")),
          logoUrl: sql<AbsoluteUrl>`${ref("agencies.logo_url")}`,
          position: jsonBuildObject({
            lat: sql<number>`(ST_AsGeoJSON(${ref(
              "agencies.position",
            )})::json->'coordinates'->>1)::numeric`,
            lon: sql<number>`(ST_AsGeoJSON(${ref(
              "agencies.position",
            )})::json->'coordinates'->>0)::numeric`,
          }),
          address: jsonBuildObject({
            streetNumberAndAddress: ref("agencies.street_number_and_address"),
            postcode: ref("agencies.post_code"),
            city: ref("agencies.city"),
            departmentCode: ref("agencies.department_code"),
          }),
          coveredDepartments: cast<DepartmentCode[]>(
            ref("agencies.covered_departments"),
          ),
          agencySiret: ref("agencies.agency_siret"),
          codeSafir: ref("agencies.code_safir"),
          signature: ref("agencies.email_signature"),
          refersToAgencyId: cast<AgencyId>(ref("agencies.refers_to_agency_id")),
          refersToAgencyName: ref("refered_agencies.name"),
          refersToAgencyContactEmail: ref("refered_agencies.contact_email"),
          statusJustification: ref("agencies.status_justification"),
          acquisitionCampaign: ref("agencies.acquisition_campaign"),
          acquisitionKeyword: ref("agencies.acquisition_keyword"),
          phoneNumber: ref("phone_numbers.phone_number"),
          delegationAgencyInfo: cast<DelegationAgencyInfo | null>(
            ref("agencies.delegation_info"),
          ),
          createdAt: sql<DateString>`date_to_iso(agencies.created_at)`,
          usersRights: fn.coalesce(
            fn
              .jsonAgg(
                jsonStripNulls(
                  jsonBuildObject({
                    userId: ref("users__agencies.user_id"),
                    roles: ref("users__agencies.roles"),
                    isNotifiedByEmail: ref(
                      "users__agencies.is_notified_by_email",
                    ),
                  }),
                ),
              )
              .filterWhere("users__agencies.user_id", "is not", null)
              .$castTo<
                {
                  userId: string;
                  roles: AgencyRole[];
                  isNotifiedByEmail: boolean;
                }[]
              >(),
            sql`'[]'`,
          ),
        }).as("agency"),
      ])
      .groupBy(["agencies.id", "refered_agencies.id", "phone_numbers.id"]);
  }

  #pgAgencyToAgencyWithRights(
    result:
      | (OmitFromExistingKeys<
          AgencyDto,
          | "counsellorEmails"
          | "validatorEmails"
          | "acquisitionCampaign"
          | "acquisitionKeyword"
        > & {
          acquisitionCampaign: string | null;
          acquisitionKeyword: string | null;
          usersRights: {
            userId: string;
            roles: AgencyRole[];
            isNotifiedByEmail: boolean;
          }[];
        })
      | undefined,
  ): AgencyWithUsersRights | undefined {
    if (!result) return;
    const { acquisitionCampaign, acquisitionKeyword, usersRights, ...rest } =
      result;

    return {
      ...rest,
      ...(acquisitionCampaign ? { acquisitionCampaign } : {}),
      ...(acquisitionKeyword ? { acquisitionKeyword } : {}),
      usersRights: usersRights.reduce<AgencyUsersRights>(
        (acc, { isNotifiedByEmail, roles, userId }) => ({
          ...acc,
          [userId]: { isNotifiedByEmail, roles },
        }),
        {},
      ),
    } satisfies AgencyWithUsersRights;
  }

  async #saveAgencyRights(
    agency: Pick<AgencyWithUsersRights, "id" | "status" | "usersRights">,
  ): Promise<void> {
    const newRights = toPairs(agency.usersRights)
      .map(([userId, userRights]) =>
        userRights
          ? {
              agency_id: agency.id,
              user_id: userId,
              is_notified_by_email: userRights.isNotifiedByEmail,
              roles: JSON.stringify(userRights.roles),
            }
          : undefined,
      )
      .filter(isTruthy);

    if (!newRights.length)
      throwIfAgencyHasNoUsersWhileNotClosedOrRejected(agency);

    await this.#deleteAgencyRights(agency.id);

    if (newRights.length)
      await this.transaction
        .insertInto("users__agencies")
        .values(newRights)
        .execute();
  }

  async #deleteAgencyRights(agencyId: AgencyId): Promise<void> {
    await this.transaction
      .deleteFrom("users__agencies")
      .where("users__agencies.agency_id", "=", agencyId)
      .execute();
  }

  async getExistingActiveSirets(sirets: SiretDto[]): Promise<SiretDto[]> {
    const results = await this.transaction
      .selectFrom("agencies")
      .select("agency_siret")
      .where("agency_siret", "in", sirets)
      .where("status", "in", activeAgencyStatuses)
      .execute();

    return results.map(({ agency_siret }) => agency_siret);
  }

  async deleteOldClosedAgenciesWithoutConventions(params: {
    updatedBefore: Date;
  }): Promise<AgencyId[]> {
    const { updatedBefore } = params;
    const result = await this.transaction
      .withRecursive("deletionCandidates", (qb) =>
        qb
          .selectFrom("agencies")
          .select("agencies.id")
          .where("status", "in", ["closed", "rejected"])
          .where("updated_at", "<=", updatedBefore)
          .where(({ eb }) =>
            eb.not(
              eb.exists(
                eb
                  .selectFrom("conventions")
                  .select("id")
                  .whereRef("conventions.agency_id", "=", "agencies.id"),
              ),
            ),
          ),
      )
      .withRecursive("candidateSubtree", (qb) =>
        qb
          .selectFrom("deletionCandidates")
          .select(({ ref }) => [
            ref("deletionCandidates.id").as("root_id"),
            ref("deletionCandidates.id").as("id"),
          ])
          .unionAll(
            qb
              .selectFrom("agencies")
              .innerJoin(
                "candidateSubtree",
                "agencies.refers_to_agency_id",
                "candidateSubtree.id",
              )
              .select(({ ref }) => [
                ref("candidateSubtree.root_id").as("root_id"),
                ref("agencies.id").as("id"),
              ]),
          ),
      )
      .withRecursive("agenciesToDelete", (qb) =>
        qb
          .selectFrom("deletionCandidates")
          .select("deletionCandidates.id")
          .where(({ eb }) =>
            eb.not(
              eb.exists(
                eb
                  .selectFrom("candidateSubtree")
                  .innerJoin(
                    "conventions",
                    "conventions.agency_id",
                    "candidateSubtree.id",
                  )
                  .select("conventions.id")
                  .whereRef(
                    "candidateSubtree.root_id",
                    "=",
                    "deletionCandidates.id",
                  ),
              ),
            ),
          )
          .unionAll(
            qb
              .selectFrom("agencies")
              .select("agencies.id")
              .innerJoin(
                "agenciesToDelete",
                "agencies.refers_to_agency_id",
                "agenciesToDelete.id",
              )
              .where(({ eb }) =>
                eb.not(
                  eb.exists(
                    eb
                      .selectFrom("conventions")
                      .select("id")
                      .whereRef("conventions.agency_id", "=", "agencies.id"),
                  ),
                ),
              ),
          ),
      )
      .deleteFrom("agencies")
      .where("id", "in", (eb) => eb.selectFrom("agenciesToDelete").select("id"))
      .returning("id")
      .execute();

    return result.map(({ id }) => id);
  }
}
