import { addDays, subDays, subMonths } from "date-fns";
import type { SelectQueryBuilder } from "kysely";
import { sql } from "kysely";
import { andThen } from "ramda";
import {
  type AgencyId,
  ASSESSEMENT_SIGNATURE_RELEASE_DATE,
  type AssessmentCompletionStatusFilter,
  type AssessmentStatus,
  assessmentStatuses,
  type BroadcastErrorKind,
  type ConventionDto,
  type ConventionId,
  type ConventionStatus,
  type ConventionsWithErroredBroadcastFeedbackFilters,
  type ConventionsWithUnfinalizedAssessmentFilters,
  type ConventionWithBroadcastFeedback,
  type ConventionWithUnfinalizedAssessment,
  calculatePaginationResult,
  conventionSchema,
  conventionStatusesDemonstratingUserActivity,
  conventionWithBroadcastFeedbackSchema,
  conventionWithUnfinalizedAssessmentSchema,
  type DataWithPagination,
  type DateFilter,
  type DateString,
  type DateTimeIsoString,
  functionalBroadcastFeedbackErrorMessage,
  type GetPaginatedConventionsSortBy,
  type PaginationQueryParams,
  pipeWithValue,
  type UserId,
  unvalidatedConventionStatuses,
  type WithSort,
} from "shared";
import { match } from "ts-pattern";
import { validateAndParseZodSchema } from "../../../config/helpers/validateAndParseZodSchema";
import {
  isInArray,
  type KyselyDb,
} from "../../../config/pg/kysely/kyselyUtils";
import type { Database } from "../../../config/pg/kysely/model/database";
import { createLogger } from "../../../utils/logger";
import {
  broadcastToFtConsumerName,
  broadcastToPartnersServiceName,
} from "../../core/saved-errors/ports/BroadcastFeedbacksRepository";
import type {
  ConventionQueries,
  GetConventionIdsParams,
  GetConventionsFilters,
  GetConventionsParams,
  GetConventionsSortBy,
  GetPaginatedConventionsParams,
  OmitStatusesForAgenciesFilter,
} from "../ports/ConventionQueries";
import {
  type BroadcastFeedbackBaseQueryBuilder,
  type ConventionBaseQueryBuilder,
  type ConventionQueryBuilder,
  type ConventionsWithErroredBroadcastFeedbackBuilder,
  createBroadcastFeedbackCountBuilder,
  createConventionQueryBuilder,
  createConventionsWithErroredBroadcastFeedbackBuilder,
  createPaginatedConventionsBaseBuilder,
  getConventionDtoById,
  hasEmptyArrayFilter,
  wrapInMaterializedCteWithEnrichment,
} from "./pgConventionSql";

const logger = createLogger(__filename);

export class PgConventionQueries implements ConventionQueries {
  constructor(private transaction: KyselyDb) {}

  public async getUserIdsWithNoActiveConvention({
    userIds,
    since,
  }: {
    userIds: UserId[];
    since: Date;
  }): Promise<UserId[]> {
    if (userIds.length === 0) return [];

    const inactiveRows = await this.transaction
      .selectFrom("users")
      .select("users.id")
      .where((eb) => isInArray(eb, "users.id", userIds))
      .where((eb) =>
        eb.not(
          eb.exists(
            eb
              .selectFrom("actors")
              .innerJoin("conventions", (join) =>
                join.on((joinEb) =>
                  joinEb.or([
                    joinEb(
                      "actors.id",
                      "=",
                      joinEb.ref("conventions.beneficiary_id"),
                    ),
                    joinEb(
                      "actors.id",
                      "=",
                      joinEb.ref("conventions.establishment_tutor_id"),
                    ),
                    joinEb(
                      "actors.id",
                      "=",
                      joinEb.ref("conventions.establishment_representative_id"),
                    ),
                    joinEb(
                      "actors.id",
                      "=",
                      joinEb.ref("conventions.beneficiary_representative_id"),
                    ),
                    joinEb(
                      "actors.id",
                      "=",
                      joinEb.ref("conventions.beneficiary_current_employer_id"),
                    ),
                  ]),
                ),
              )
              .whereRef("actors.email", "=", "users.email")
              .where("conventions.date_end", ">=", since)
              .where(
                "conventions.status",
                "in",
                conventionStatusesDemonstratingUserActivity,
              )
              .select(sql`1`.as("__")),
          ),
        ),
      )
      .execute();

    return inactiveRows.map((r) => r.id);
  }

  public async getConventionIdsByFilters({
    filters: {
      withAgencyIds,
      withAppelationCodes,
      withBeneficiary,
      withDateStart,
      withDateSubmission,
      withEndDate,
      withUpdateDate,
      withEstablishmentRepresentative,
      withEstablishmentTutor,
      withSirets,
      withStatuses,
    },
    limit,
  }: GetConventionIdsParams): Promise<ConventionId[]> {
    const pgResults = await pipeWithValue(
      this.transaction
        .selectFrom("conventions")
        .select("conventions.id")
        .orderBy("conventions.date_start", "desc"),
      (qb) =>
        withAgencyIds && withAgencyIds.length > 0
          ? qb.where("conventions.agency_id", "in", withAgencyIds)
          : qb,
      addDateFilters({
        withDateStart,
        withDateSubmission,
        withEndDate,
        withUpdateDate,
      }),
      (qb) =>
        withAppelationCodes
          ? qb.where(
              "conventions.immersion_appellation",
              "in",
              withAppelationCodes.map((code) => +code),
            )
          : qb,
      (qb) =>
        withSirets ? qb.where("conventions.siret", "in", withSirets) : qb,
      (qb) =>
        withStatuses ? qb.where("conventions.status", "in", withStatuses) : qb,
      (qb) =>
        withEstablishmentRepresentative?.email
          ? qb
              .innerJoin(
                "actors as establishment_representative",
                "conventions.establishment_representative_id",
                "establishment_representative.id",
              )
              .where(
                "establishment_representative.email",
                "=",
                withEstablishmentRepresentative.email,
              )
          : qb,
      (qb) =>
        withEstablishmentTutor?.email
          ? qb
              .innerJoin(
                "actors as establishment_tutor",
                "conventions.establishment_tutor_id",
                "establishment_tutor.id",
              )
              .where(
                "establishment_tutor.email",
                "=",
                withEstablishmentTutor.email,
              )
          : qb,
      (qb) =>
        withBeneficiary
          ? pipeWithValue(
              qb.innerJoin(
                "actors as beneficiary",
                "conventions.beneficiary_id",
                "beneficiary.id",
              ),
              (qb) =>
                withBeneficiary.birthdate
                  ? qb.where(
                      sql`beneficiary.extra_fields ->> 'birthdate'`,
                      "=",
                      withBeneficiary.birthdate,
                    )
                  : qb,
              (qb) =>
                withBeneficiary.lastName
                  ? qb.where(
                      "beneficiary.last_name",
                      "=",
                      withBeneficiary.lastName,
                    )
                  : qb,
            )
          : qb,
      (qb) => qb.orderBy("conventions.date_start", "desc"),
      (qb) => (limit ? qb.limit(limit) : qb),
    ).execute();

    return pgResults.map(({ id }) => id);
  }

  public async getConventionById(
    id: ConventionId,
  ): Promise<ConventionDto | undefined> {
    return getConventionDtoById(this.transaction, id);
  }

  public async getConventions({
    filters,
    sortBy,
    limit,
  }: GetConventionsParams): Promise<ConventionDto[]> {
    const conventionsSortByDateToDatabaseConventionsOrderBy: Record<
      GetConventionsSortBy,
      keyof Pick<Database["conventions"], "date_start" | "date_validation">
    > = {
      dateStart: "date_start",
      dateValidation: "date_validation",
    };

    return pipeWithValue(
      createConventionQueryBuilder(this.transaction, false),
      addFiltersToBuilder(filters),
      (builder) =>
        builder.orderBy(
          `conventions.${conventionsSortByDateToDatabaseConventionsOrderBy[sortBy]}`,
          "desc",
        ),
      (builder) => (limit ? builder.limit(limit) : builder),
      (builder) => builder.execute(),
      andThen(validateConventionResults),
    );
  }

  public async getPaginatedConventions({
    filters = {},
    pagination,
    sort,
  }: GetPaginatedConventionsParams): Promise<
    DataWithPagination<ConventionDto>
  > {
    const {
      search,
      statuses,
      agencyIds,
      omitStatusesForAgencies,
      dateStart,
      dateEnd,
      dateSubmission,
      assessmentCompletionStatus,
      ...rest
    } = filters;

    rest satisfies Record<string, never>;

    if (hasEmptyArrayFilter(filters))
      return {
        data: [],
        pagination: calculatePaginationResult({
          ...pagination,
          totalRecords: 0,
        }),
      };

    const trimmedSearch = search?.trim();

    const filteredBuilder = pipeWithValue(
      createPaginatedConventionsBaseBuilder({
        transaction: this.transaction,
      }),
      filterByAgencyIds(agencyIds),
      filterOmitStatusesForAgencies(omitStatusesForAgencies),
      filterSearch(trimmedSearch),
      filterDate("date_start", dateStart),
      filterDate("date_end", dateEnd),
      filterDate("date_submission", dateSubmission),
      filterInList("status", statuses),
      filterByAssessmentCompletionStatus(assessmentCompletionStatus),
    );

    const countQuery = filteredBuilder.select((eb) =>
      sql<number>`CAST(${eb.fn.countAll()} AS INT)`.as("count"),
    );

    const dataQuery = pipeWithValue(
      wrapInMaterializedCteWithEnrichment({
        transaction: this.transaction,
        filteredBuilder: pipeWithValue(
          filteredBuilder,
          sortConventions(sort),
          applyPagination(pagination),
        ),
      }),
      sortConventions(sort),
    );

    const [data, countResult] = await Promise.all([
      dataQuery.execute(),
      countQuery.executeTakeFirstOrThrow(),
    ]);

    return {
      data: validateConventionResults(data),
      pagination: calculatePaginationResult({
        ...pagination,
        totalRecords: countResult.count,
      }),
    };
  }

  public async getConventionsWithUnfinalizedAssessmentForAgencyUser({
    userAgencyIds,
    pagination,
    now,
    filters = {},
  }: {
    userAgencyIds: AgencyId[];
    pagination: Required<PaginationQueryParams>;
    now: Date;
    filters?: ConventionsWithUnfinalizedAssessmentFilters;
  }): Promise<DataWithPagination<ConventionWithUnfinalizedAssessment>> {
    if (userAgencyIds.length === 0)
      return {
        data: [],
        pagination: {
          totalRecords: 0,
          currentPage: 1,
          totalPages: 1,
          numberPerPage: 0,
        },
      };

    const { assessmentCompletionStatus } = filters;

    const threeMonthsAgo = subMonths(now, 3);
    const twoDaysAgo = subDays(now, 2);
    const signatureReleaseThreshold = addDays(
      ASSESSEMENT_SIGNATURE_RELEASE_DATE,
      1,
    );

    const conventionsWithoutAssessmentRows = this.transaction
      .selectFrom("conventions")
      .innerJoin(
        "actors as beneficiary",
        "beneficiary.id",
        "conventions.beneficiary_id",
      )
      .leftJoin(
        "immersion_assessments as ia",
        "ia.convention_id",
        "conventions.id",
      )
      .where((eb) => isInArray(eb, "conventions.agency_id", userAgencyIds))
      .where("conventions.status", "=", "ACCEPTED_BY_VALIDATOR")
      .where("ia.convention_id", "is", null)
      .where("conventions.date_end", ">=", threeMonthsAgo)
      .where("conventions.date_end", "<=", now);

    const conventionsWithAssessmentToSignRows = this.transaction
      .selectFrom("conventions")
      .innerJoin(
        "actors as beneficiary",
        "beneficiary.id",
        "conventions.beneficiary_id",
      )
      .innerJoin(
        "immersion_assessments as ia",
        "ia.convention_id",
        "conventions.id",
      )
      .where((eb) => isInArray(eb, "conventions.agency_id", userAgencyIds))
      .where("conventions.status", "=", "ACCEPTED_BY_VALIDATOR")
      .where("ia.signed_at", "is", null)
      .where("ia.status", "!=", "DID_NOT_SHOW")
      .where("ia.created_at", ">", signatureReleaseThreshold)
      .where("ia.created_at", ">=", threeMonthsAgo)
      .where("ia.created_at", "<", twoDaysAgo);

    const toCompleteSelect = selectUnfinalizedAssessmentFields(
      conventionsWithoutAssessmentRows,
    );
    const toSignSelect = selectUnfinalizedAssessmentFields(
      conventionsWithAssessmentToSignRows,
    );

    const unfinalizedAssessmentRows = match(assessmentCompletionStatus)
      .with("to-complete", () => toCompleteSelect)
      .with("to-sign", () => toSignSelect)
      .with(undefined, () => toCompleteSelect.unionAll(toSignSelect))
      .exhaustive();

    const paginatedUnfinalizedAssessmentQuery = unfinalizedAssessmentRows
      .orderBy("dateEndRaw", "asc")
      .orderBy("id", "asc")
      .limit(pagination.perPage)
      .offset((pagination.page - 1) * pagination.perPage);

    const countWithoutAssessment = () =>
      conventionsWithoutAssessmentRows
        .select((eb) =>
          sql<number>`CAST(${eb.fn.countAll()} AS INT)`.as("count"),
        )
        .executeTakeFirstOrThrow();

    const countWithAssessmentToSign = () =>
      conventionsWithAssessmentToSignRows
        .select((eb) =>
          sql<number>`CAST(${eb.fn.countAll()} AS INT)`.as("count"),
        )
        .executeTakeFirstOrThrow();

    const countQueries = match(assessmentCompletionStatus)
      .with("to-complete", () => [countWithoutAssessment()])
      .with("to-sign", () => [countWithAssessmentToSign()])
      .with(undefined, () => [
        countWithoutAssessment(),
        countWithAssessmentToSign(),
      ])
      .exhaustive();

    const [rows, ...countResults] = await Promise.all([
      paginatedUnfinalizedAssessmentQuery.execute(),
      ...countQueries,
    ]);

    const totalRecords = countResults.reduce(
      (sum, countResult) => sum + countResult.count,
      0,
    );

    const data = rows.map((row) =>
      validateAndParseZodSchema({
        schemaName: "conventionWithUnfinalizedAssessmentSchema",
        inputSchema: conventionWithUnfinalizedAssessmentSchema,
        id: row.id,
        schemaParsingInput: {
          id: row.id,
          dateEnd: row.dateEnd,
          beneficiary: {
            firstname: row.firstname,
            lastname: row.lastname,
          },
          assessment:
            row.assessmentStatus === null || row.assessmentCreatedAt === null
              ? null
              : {
                  status: row.assessmentStatus,
                  endedWithAJob: row.assessmentEndedWithAJob ?? false,
                  signedAt: row.assessmentSignedAt,
                  createdAt: row.assessmentCreatedAt,
                },
          agencyId: row.agencyId,
          agencyReferent:
            row.agencyReferentFirstName && row.agencyReferentLastName
              ? {
                  firstname: row.agencyReferentFirstName,
                  lastname: row.agencyReferentLastName,
                }
              : null,
        },
        logger,
      }),
    );

    return {
      data,
      pagination: calculatePaginationResult({
        ...pagination,
        totalRecords,
      }),
    };
  }

  public async getConventionsWithErroredBroadcastFeedbackForAgencyUser({
    userAgencyIds,
    pagination,
    filters = {},
  }: {
    userAgencyIds: AgencyId[];
    pagination: Required<PaginationQueryParams>;
    filters?: ConventionsWithErroredBroadcastFeedbackFilters;
  }): Promise<DataWithPagination<ConventionWithBroadcastFeedback>> {
    if (userAgencyIds.length === 0)
      return {
        data: [],
        pagination: {
          totalRecords: 0,
          currentPage: 1,
          totalPages: 1,
          numberPerPage: pagination.perPage,
        },
      };

    const { broadcastErrorKind, conventionStatus, search, ...rest } = filters;
    rest satisfies Record<string, never>;

    const broadcastFeedbackBuilderParams = {
      transaction: this.transaction,
      userAgencyIds,
      conventionSubmittedAfter: new Date("2025-01-01"),
    };

    const applyBroadcastFilters = (qb: BroadcastFeedbackBaseQueryBuilder) =>
      pipeWithValue(
        qb,
        filterHasErroredFeedback(),
        filterBroadcastErrorKind(broadcastErrorKind),
        filterExcludeUnvalidatedConventionsWithoutPriorSuccessfulBroadcast(),
        filterConventionStatus(conventionStatus),
        filterSearchForBroadcastFeedback(search),
      );

    const [result, countResult] = await Promise.all([
      pipeWithValue(
        applyBroadcastFilters(
          createConventionsWithErroredBroadcastFeedbackBuilder(
            broadcastFeedbackBuilderParams,
          ),
        ),
        sortConventionsWithBroadcastFeedback(),
        applyPaginationToBroadcastFeedback(pagination),
      ).execute(),
      applyBroadcastFilters(
        createBroadcastFeedbackCountBuilder(broadcastFeedbackBuilderParams),
      ).executeTakeFirstOrThrow(),
    ]);

    const totalRecords = countResult.count;

    const conventionsWithErroredBroadcastFeedback: ConventionWithBroadcastFeedback[] =
      result.map((row) =>
        validateAndParseZodSchema({
          schemaName: "conventionWithBroadcastFeedbackSchema",
          inputSchema: conventionWithBroadcastFeedbackSchema,
          id: row.conventionId,
          schemaParsingInput: {
            id: row.conventionId,
            status: row.status,
            beneficiary: {
              firstname: row.bFirstName,
              lastname: row.bLastName,
            },
            lastBroadcastFeedback: {
              consumerId: row.consumerId,
              consumerName: row.consumerName,
              conventionId: row.conventionId,
              agencyId: row.agencyId,
              handledByAgency: row.handledByAgency,
              occurredAt: row.occurredAt,
              requestParams: row.requestParams,
              serviceName: row.serviceName,
              response: row.response,
              subscriberErrorFeedback: row.subscriberErrorFeedback
                ? row.subscriberErrorFeedback
                : undefined,
            },
            agencyReferent:
              row.agencyReferentFirstName && row.agencyReferentLastName
                ? {
                    firstname: row.agencyReferentFirstName,
                    lastname: row.agencyReferentLastName,
                  }
                : null,
            agencyId: row.agencyId,
          },
          logger,
        }),
      );

    return {
      data: conventionsWithErroredBroadcastFeedback,
      pagination: calculatePaginationResult({ ...pagination, totalRecords }),
    };
  }
}

const applyPagination =
  (pagination: Required<PaginationQueryParams>) =>
  <T extends ConventionBaseQueryBuilder>(builder: T): T => {
    const { page, perPage } = pagination;
    const offset = (page - 1) * perPage;
    return builder.limit(perPage).offset(offset) as T;
  };

const sortConventions =
  (sort?: WithSort<GetPaginatedConventionsSortBy>["sort"]) =>
  <T extends ConventionBaseQueryBuilder>(builder: T): T => {
    const sortByKey: Record<
      GetPaginatedConventionsSortBy,
      keyof Database["conventions"]
    > = {
      dateSubmission: "date_submission",
      dateStart: "date_start",
      dateValidation: "date_validation",
      dateEnd: "date_end",
    };

    if (!sort || !sort.by)
      return builder
        .orderBy(sortByKey.dateStart, "desc")
        .orderBy("conventions.id", "asc") as T;

    return builder
      .orderBy(sortByKey[sort.by], sort.direction ?? "desc")
      .orderBy("conventions.id", "asc") as T;
  };

const filterByAgencyIds =
  (agencyIds: AgencyId[] | undefined) =>
  (builder: ConventionBaseQueryBuilder): ConventionBaseQueryBuilder =>
    agencyIds
      ? builder.where(
          sql<boolean>`conventions.agency_id = ANY(${agencyIds}::uuid[])`,
        )
      : builder;

const filterOmitStatusesForAgencies =
  (omitStatusesForAgencies: OmitStatusesForAgenciesFilter | undefined) =>
  (builder: ConventionBaseQueryBuilder): ConventionBaseQueryBuilder => {
    if (
      !omitStatusesForAgencies ||
      omitStatusesForAgencies.agencyIds.length === 0 ||
      omitStatusesForAgencies.statuses.length === 0
    )
      return builder;

    return builder.where((eb) =>
      eb.not(
        eb.and([
          sql<boolean>`conventions.agency_id = ANY(${omitStatusesForAgencies.agencyIds}::uuid[])`,
          eb("conventions.status", "in", omitStatusesForAgencies.statuses),
        ]),
      ),
    );
  };

const filterByAssessmentCompletionStatus =
  (
    assessmentCompletionStatus: AssessmentCompletionStatusFilter[] | undefined,
  ) =>
  (builder: ConventionBaseQueryBuilder): ConventionBaseQueryBuilder => {
    if (!assessmentCompletionStatus || assessmentCompletionStatus.length === 0)
      return builder;

    const hasFinalizedFilter = assessmentCompletionStatus.includes("finalized");
    const hasToSignFilter = assessmentCompletionStatus.includes("to-sign");
    const hasToBeCompletedFilter =
      assessmentCompletionStatus.includes("to-complete");

    if (hasFinalizedFilter && hasToSignFilter && hasToBeCompletedFilter)
      return builder;

    return builder
      .leftJoin(
        "immersion_assessments as ia",
        "ia.convention_id",
        "conventions.id",
      )
      .where("conventions.status", "=", "ACCEPTED_BY_VALIDATOR")
      .where((eb) => {
        const conditions: ReturnType<typeof eb>[] = [];

        if (hasFinalizedFilter && hasToSignFilter)
          conditions.push(
            eb.and([
              eb("ia.convention_id", "is not", null),
              eb(
                "ia.created_at",
                ">",
                addDays(ASSESSEMENT_SIGNATURE_RELEASE_DATE, 1),
              ),
            ]),
          );
        else {
          if (hasFinalizedFilter)
            conditions.push(
              eb.or([
                eb("ia.status", "=", "DID_NOT_SHOW"),
                eb.and([
                  eb(
                    "ia.created_at",
                    ">",
                    addDays(ASSESSEMENT_SIGNATURE_RELEASE_DATE, 1),
                  ),
                  eb("ia.signed_at", "is not", null),
                ]),
                eb.and([
                  eb(
                    "ia.created_at",
                    "<=",
                    addDays(ASSESSEMENT_SIGNATURE_RELEASE_DATE, 1),
                  ),
                  eb("ia.status", "in", assessmentStatuses),
                ]),
              ]),
            );
          if (hasToSignFilter)
            conditions.push(
              eb.and([
                eb(
                  "ia.created_at",
                  ">",
                  addDays(ASSESSEMENT_SIGNATURE_RELEASE_DATE, 1),
                ),
                eb("ia.convention_id", "is not", null),
                eb("ia.signed_at", "is", null),
                eb("ia.status", "!=", "DID_NOT_SHOW"),
              ]),
            );
        }
        if (hasToBeCompletedFilter)
          conditions.push(
            eb.and([
              eb("ia.convention_id", "is", null),
              eb("conventions.date_end", "<=", addDays(new Date(), 1)),
            ]),
          );

        return eb.or(conditions);
      });
  };

const filterDate =
  (
    fieldName: keyof Database["conventions"],
    dateFilter: DateFilter | undefined,
  ) =>
  (builder: ConventionBaseQueryBuilder): ConventionBaseQueryBuilder => {
    if (!dateFilter) return builder;
    if (dateFilter.from && dateFilter.to)
      return builder
        .where(fieldName, ">=", dateFilter.from)
        .where(fieldName, "<=", dateFilter.to);

    if (dateFilter.from) return builder.where(fieldName, ">=", dateFilter.from);
    if (dateFilter.to) return builder.where(fieldName, "<=", dateFilter.to);
    return builder;
  };

const filterInList =
  <T extends string>(
    fieldName: keyof Database["conventions"],
    list: T[] | undefined,
  ) =>
  (builder: ConventionBaseQueryBuilder): ConventionBaseQueryBuilder => {
    if (!list) return builder;
    return builder.where(`conventions.${fieldName}`, "in", list);
  };

const filterBroadcastErrorKind =
  (broadcastErrorKind?: BroadcastErrorKind) =>
  (
    builder: BroadcastFeedbackBaseQueryBuilder,
  ): BroadcastFeedbackBaseQueryBuilder => {
    if (!broadcastErrorKind) return builder;

    if (broadcastErrorKind === "functional") {
      return builder.where((eb) =>
        eb(
          sql`"cf"."subscriberErrorFeedback"->>'message'`,
          "in",
          functionalBroadcastFeedbackErrorMessage,
        ),
      );
    }

    return builder.where((eb) =>
      eb.not(
        eb(
          sql`"cf"."subscriberErrorFeedback"->>'message'`,
          "in",
          functionalBroadcastFeedbackErrorMessage,
        ),
      ),
    );
  };

const filterExcludeUnvalidatedConventionsWithoutPriorSuccessfulBroadcast =
  () =>
  (
    builder: BroadcastFeedbackBaseQueryBuilder,
  ): BroadcastFeedbackBaseQueryBuilder =>
    builder.where((eb) =>
      eb.or([
        eb("cf.status", "not in", [...unvalidatedConventionStatuses]),
        eb.exists(
          eb
            .selectFrom("broadcast_feedbacks as bf_ok")
            .select(sql`1`.as("__"))
            .where("bf_ok.convention_id", "=", eb.ref("cf.conventionId"))
            .where(
              sql<boolean>`(
                (bf_ok.consumer_name = ${broadcastToFtConsumerName} AND bf_ok.response @> '{"httpStatus": 201}'::jsonb)
                OR
                (bf_ok.service_name = ${broadcastToPartnersServiceName} AND bf_ok.subscriber_error_feedback IS NULL)
              )`,
            ),
        ),
      ]),
    );

const filterConventionStatus =
  (conventionStatus?: ConventionStatus[]) =>
  (
    builder: BroadcastFeedbackBaseQueryBuilder,
  ): BroadcastFeedbackBaseQueryBuilder => {
    if (!conventionStatus || conventionStatus.length === 0) return builder;
    return builder.where("cf.status", "in", conventionStatus);
  };

const filterHasErroredFeedback =
  () =>
  (
    builder: BroadcastFeedbackBaseQueryBuilder,
  ): BroadcastFeedbackBaseQueryBuilder => {
    return builder
      .where("cf.subscriberErrorFeedback", "is not", null)
      .where("cf.handledByAgency", "=", false);
  };

const filterSearchForBroadcastFeedback =
  (search: string | undefined) =>
  (
    builder: BroadcastFeedbackBaseQueryBuilder,
  ): BroadcastFeedbackBaseQueryBuilder => {
    if (!search) return builder;
    const pattern = `%${search.toLowerCase()}%`;

    return builder.where((eb) =>
      eb.or([
        sql<any>`CAST(${eb.ref("cf.conventionId")} AS text) LIKE ${pattern}`,
        // Search in beneficiary names
        sql<any>`${eb.ref("cf.bLastName")} ILIKE ${pattern}`,
        sql<any>`${eb.ref("cf.bFirstName")} ILIKE ${pattern}`,
        sql<any>`${eb.ref("cf.bFirstName")} || ' ' || ${eb.ref("cf.bLastName")} ILIKE ${pattern}`,
        sql<any>`${eb.ref("cf.bLastName")} || ' ' || ${eb.ref("cf.bFirstName")} ILIKE ${pattern}`,
        // Search in establishment business name
        sql<any>`${eb.ref("cf.businessName")} ILIKE ${pattern}`,
        // Search in establishment SIRET
        sql<any>`${eb.ref("cf.siret")} LIKE ${pattern}`,
        // Search in actor emails
        sql<any>`${eb.ref("cf.bEmail")} LIKE ${pattern}`,
        sql<any>`${eb.ref("cf.erEmail")} LIKE ${pattern}`,
        sql<any>`${eb.ref("cf.etEmail")} LIKE ${pattern}`,
        sql<any>`${eb.ref("cf.brEmail")} IS NOT NULL AND ${eb.ref("cf.brEmail")} LIKE ${pattern}`,
        sql<any>`${eb.ref("cf.bceEmail")} IS NOT NULL AND ${eb.ref("cf.bceEmail")} LIKE ${pattern}`,
        // Search agency referent names
        sql<any>`${eb.ref("cf.agencyReferentFirstName")} ILIKE ${pattern}`,
        sql<any>`${eb.ref("cf.agencyReferentLastName")} ILIKE ${pattern}`,
        sql<any>`${eb.ref("cf.agencyReferentFirstName")} || ' ' || ${eb.ref("cf.agencyReferentLastName")} ILIKE ${pattern}`,
        sql<any>`${eb.ref("cf.agencyReferentLastName")} || ' ' || ${eb.ref("cf.agencyReferentFirstName")} ILIKE ${pattern}`,
      ]),
    );
  };

const sortConventionsWithBroadcastFeedback =
  () =>
  (
    builder: ConventionsWithErroredBroadcastFeedbackBuilder,
  ): ConventionsWithErroredBroadcastFeedbackBuilder =>
    builder.orderBy("cf.occurredAt", "desc");

const applyPaginationToBroadcastFeedback =
  (pagination: Required<PaginationQueryParams>) =>
  (
    builder: ConventionsWithErroredBroadcastFeedbackBuilder,
  ): ConventionsWithErroredBroadcastFeedbackBuilder => {
    const { page, perPage } = pagination;
    const offset = (page - 1) * perPage;
    return builder.limit(perPage).offset(offset);
  };

const filterSearch =
  (search: string | undefined) =>
  (builder: ConventionBaseQueryBuilder): ConventionBaseQueryBuilder => {
    if (!search) return builder;
    const pattern = `%${search.toLowerCase()}%`;

    return builder.where((eb) =>
      eb.or([
        // Search in convention ID (cast UUID to text for pattern matching)
        sql<any>`CAST(${eb.ref("conventions.id")} AS text) LIKE ${pattern}`,
        // Search in beneficiary names
        sql<any>`${eb.ref("b.first_name")} ILIKE ${pattern}`,
        sql<any>`${eb.ref("b.last_name")} ILIKE ${pattern}`,
        sql<any>`${eb.ref("b.first_name")} || ' ' || ${eb.ref("b.last_name")} ILIKE ${pattern}`,
        sql<any>`${eb.ref("b.last_name")} || ' ' || ${eb.ref("b.first_name")} ILIKE ${pattern}`,
        // Search in establishment business name
        sql<any>`${eb.ref("business_name")} ILIKE ${pattern}`,
        // Search in establishment SIRET
        sql<any>`${eb.ref("conventions.siret")} LIKE ${pattern}`,
        // Search in actor emails
        sql<any>`${eb.ref("b.email")} LIKE ${pattern}`,
        sql<any>`${eb.ref("er.email")} LIKE ${pattern}`,
        sql<any>`${eb.ref("et.email")} LIKE ${pattern}`,
        sql<any>`br.email IS NOT NULL AND br.email LIKE ${pattern}`,
        sql<any>`bce.email IS NOT NULL AND bce.email LIKE ${pattern}`,
        // Search agency referent names
        sql<any>`${eb.ref("agency_referent_first_name")} ILIKE ${pattern}`,
        sql<any>`${eb.ref("agency_referent_last_name")} ILIKE ${pattern}`,
        sql<any>`${eb.ref("agency_referent_first_name")} || ' ' || ${eb.ref("agency_referent_last_name")} ILIKE ${pattern}`,
        sql<any>`${eb.ref("agency_referent_last_name")} || ' ' || ${eb.ref("agency_referent_first_name")} ILIKE ${pattern}`,
      ]),
    );
  };

const addFiltersToBuilder =
  ({
    agencyIds,
    ids,
    startDateGreater,
    startDateLessOrEqual,
    withStatuses,
    dateSubmissionEqual,
    dateSubmissionSince,
    withSirets,
    withBeneficiary,
    endDate,
    updateDate,
  }: GetConventionsFilters) =>
  (builder: ConventionQueryBuilder) =>
    pipeWithValue(
      builder,
      (b) =>
        agencyIds && agencyIds.length > 0
          ? b.where("conventions.agency_id", "in", agencyIds)
          : b,
      (b) => (ids && ids.length > 0 ? b.where("conventions.id", "in", ids) : b),
      (b) =>
        withStatuses && withStatuses.length > 0
          ? b.where("conventions.status", "in", withStatuses)
          : b,
      (b) =>
        startDateLessOrEqual
          ? b.where("conventions.date_start", "<=", startDateLessOrEqual)
          : b,
      (b) =>
        startDateGreater
          ? b.where("conventions.date_start", ">", startDateGreater)
          : b,
      (b) =>
        dateSubmissionEqual
          ? b.where("conventions.date_submission", "=", dateSubmissionEqual)
          : b,
      (b) =>
        dateSubmissionSince
          ? b.where("conventions.date_submission", ">=", dateSubmissionSince)
          : b,
      (b) =>
        withSirets && withSirets.length > 0
          ? b.where((eb) => isInArray(eb, "conventions.siret", withSirets))
          : b,
      (b) =>
        withBeneficiary?.email
          ? b.where("b.email", "=", withBeneficiary.email)
          : b,
      addDateFilters({
        withEndDate: endDate,
        withUpdateDate: updateDate,
      }),
    );

type DateFilterableBuilder<TBuilder> = {
  where: (...args: unknown[]) => TBuilder;
};

const addDateFilters =
  <TBuilder extends DateFilterableBuilder<TBuilder>>({
    withDateStart,
    withDateSubmission,
    withEndDate,
    withUpdateDate,
  }: {
    withDateStart?: {
      from?: Date | string;
      to?: Date | string;
    };
    withDateSubmission?: {
      from?: Date | string;
      to?: Date | string;
    };
    withEndDate?: {
      from?: Date | string;
      to?: Date | string;
    };
    withUpdateDate?: {
      from?: Date | string;
      to?: Date | string;
    };
  }) =>
  (builder: TBuilder): TBuilder =>
    pipeWithValue(
      builder,
      (b) =>
        withDateStart?.to
          ? b.where("conventions.date_start", "<=", withDateStart.to)
          : b,
      (b) =>
        withDateStart?.from
          ? b.where("conventions.date_start", ">=", withDateStart.from)
          : b,
      (b) =>
        withDateSubmission?.from
          ? b.where(
              "conventions.date_submission",
              ">=",
              withDateSubmission.from,
            )
          : b,
      (b) =>
        withDateSubmission?.to
          ? b.where("conventions.date_submission", "<=", withDateSubmission.to)
          : b,
      (b) =>
        withEndDate?.from
          ? b.where("conventions.date_end", ">=", withEndDate.from)
          : b,
      (b) =>
        withEndDate?.to
          ? b.where("conventions.date_end", "<=", withEndDate.to)
          : b,
      (b) =>
        withUpdateDate?.from
          ? b.where("conventions.updated_at", ">=", withUpdateDate.from)
          : b,
      (b) =>
        withUpdateDate?.to
          ? b.where("conventions.updated_at", "<=", withUpdateDate.to)
          : b,
    );

export const validateConventionResults = (
  pgResults: { dto: unknown }[],
): ConventionDto[] =>
  pgResults.map((pgResult) =>
    validateAndParseZodSchema({
      schemaName: "conventionSchema",
      inputSchema: conventionSchema,
      schemaParsingInput: pgResult.dto,
      id:
        pgResult.dto && typeof pgResult.dto === "object" && "id" in pgResult.dto
          ? (pgResult.dto.id as string)
          : undefined,
      logger,
    }),
  );

type UnfinalizedAssessmentQueryDb = Database & {
  beneficiary: Database["actors"];
  ia: Database["immersion_assessments"];
};

const selectUnfinalizedAssessmentFields = (
  builder: SelectQueryBuilder<
    UnfinalizedAssessmentQueryDb,
    keyof UnfinalizedAssessmentQueryDb,
    any
  >,
) =>
  builder.select((eb) => [
    eb.ref("conventions.id").as("id"),
    sql<DateString>`date_to_iso(conventions.date_end)`.as("dateEnd"),
    eb.ref("conventions.date_end").as("dateEndRaw"),
    eb.ref("beneficiary.first_name").as("firstname"),
    eb.ref("beneficiary.last_name").as("lastname"),
    eb.ref("conventions.agency_id").as("agencyId"),
    eb
      .ref("conventions.agency_referent_first_name")
      .as("agencyReferentFirstName"),
    eb
      .ref("conventions.agency_referent_last_name")
      .as("agencyReferentLastName"),
    eb
      .ref("ia.status")
      .$castTo<AssessmentStatus | null>()
      .as("assessmentStatus"),
    eb.ref("ia.ended_with_a_job").as("assessmentEndedWithAJob"),
    sql<DateString | null>`date_to_iso(ia.signed_at)`.as("assessmentSignedAt"),
    sql<DateTimeIsoString | null>`date_to_iso(ia.created_at)`.as(
      "assessmentCreatedAt",
    ),
  ]);
