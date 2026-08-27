import type { InsertObject } from "kysely";
import { sql } from "kysely";
import { keys } from "ramda";
import {
  type Attachment,
  type CandidateWarnedMethod,
  type CommonDiscussionDto,
  type ContactMode,
  type ConventionId,
  type DataWithPagination,
  type DiscussionDto,
  type DiscussionId,
  type DiscussionInList,
  type DiscussionKind,
  type DiscussionOrderKey,
  type DiscussionStatus,
  type EstablishmentRole,
  type Exchange,
  type ExchangeRole,
  errors,
  type ImmersionObjective,
  type LocationId,
  type PhoneNumber,
  type PotentialBeneficiaryCommonProps,
  pipeWithValue,
  type RejectionKind,
  type SiretDto,
  type UserId,
  type WithBannedEstablishmentInformations,
  type WithDiscussionStatus,
} from "shared";
import { match, P } from "ts-pattern";
import {
  isInArray,
  jsonBuildObject,
  jsonStripNulls,
  type KyselyDb,
} from "../../../config/pg/kysely/kyselyUtils";
import type { Database } from "../../../config/pg/kysely/model/database";
import { getOrCreatePhoneIds } from "../../core/phone-number/adapters/pgPhoneHelper";
import type {
  DiscussionRepository,
  GetDiscussionIdsParams,
  GetDiscussionsParams,
  GetPaginatedDiscussionsForUserParams,
  HasDiscussionMatchingParams,
} from "../ports/DiscussionRepository";

const orderColumnByOrderKey: Record<
  DiscussionOrderKey,
  `discussions.${keyof Database["discussions"]}`
> = {
  createdAt: "discussions.created_at",
};

type GetPaginatedDiscussionsForUserFilters =
  GetPaginatedDiscussionsForUserParams["filters"];
type GetPaginatedDiscussionsForUserSort =
  GetPaginatedDiscussionsForUserParams["sort"];

type DeleteDiscussionResultPayload = {
  deletedDiscussionsValues: {
    created_at: string;
    id: string;
    siret: string;
    kind: DiscussionKind;
    status: DiscussionStatus;
    convention_id: ConventionId | null;
    potential_beneficiary_first_name: string;
    department_code: string;
    immersion_objective: ImmersionObjective | null;
    contact_method: string;
    appellation_code: number;
  }[];
  deletedExchanges: {
    discussion_id: DiscussionId;
    sender: ExchangeRole;
  }[];
};

export class PgDiscussionRepository implements DiscussionRepository {
  constructor(private transaction: KyselyDb) {}

  async getUserIdsWithNoRecentExchange({
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
              .selectFrom("exchanges")
              .select(sql`1`.as("__"))
              .whereRef("exchanges.establishment_email", "=", "users.email")
              .where("exchanges.sender", "=", "establishment")
              .where("exchanges.sent_at", ">=", since),
          ),
        ),
      )
      .execute();

    return inactiveRows.map((r) => r.id);
  }

  async __test_getAllDiscussions(): Promise<DiscussionDto[]> {
    return executeGetDiscussions(this.transaction, {
      filters: {},
      limit: 5000,
    }).then((results) => makeDiscussionDtoFromPgDiscussion(results));
  }

  async __test_setDiscussionsStats(stats: DiscussionsStat[]) {
    await this.transaction
      .insertInto("discussions_archives")
      .values(stats)
      .execute();
  }

  async __test_getDiscussionsStats() {
    return executeGetDiscussionsStats(this.transaction);
  }

  async archiveDiscussions(discussionIds: DiscussionId[]): Promise<void> {
    if (discussionIds.length === 0) return;

    return this.insertOrUpdateDiscussionsStats(
      await this.deleteDiscussions(discussionIds),
    );
  }

  private async deleteDiscussions(
    discussionIds: DiscussionId[],
  ): Promise<DeleteDiscussionResultPayload> {
    const deletedExchanges = await this.transaction
      .deleteFrom("exchanges")
      .where("discussion_id", "in", discussionIds)
      .returning(["discussion_id", "sender"])
      .execute();

    const deletedDiscussionsValues = await this.transaction
      .deleteFrom("discussions")
      .where("id", "in", discussionIds)
      .returning([
        "id",
        "status",
        "appellation_code",
        "potential_beneficiary_first_name",
        "contact_method",
        "department_code",
        "kind",
        "immersion_objective",
        "siret",
        "created_at",
        "convention_id",
      ])
      .execute()
      .then((results) =>
        results.map((result) => ({
          ...result,
          potential_beneficiary_first_name:
            result.potential_beneficiary_first_name.toLocaleLowerCase(),
          created_at: new Date(
            result.created_at.getTime() -
              result.created_at.getTimezoneOffset() * 60 * 1_000,
          )
            .toISOString()
            .split("T")[0],
        })),
      );

    const deletedDiscussionsIds = deletedDiscussionsValues.map(
      (values) => values.id,
    );
    const missingDiscussions = discussionIds.filter(
      (d) => !deletedDiscussionsIds.includes(d),
    );

    if (missingDiscussions.length > 0)
      throw errors.discussion.missingNotDeleted(missingDiscussions);
    return { deletedDiscussionsValues, deletedExchanges };
  }

  private async insertOrUpdateDiscussionsStats({
    deletedDiscussionsValues,
    deletedExchanges,
  }: DeleteDiscussionResultPayload): Promise<void> {
    const statsToAdd = deletedDiscussionsValues.reduce<DiscussionsStat[]>(
      (acc, deletedDiscussionValues) => {
        const existingInAcc = acc.findIndex(
          (value) =>
            value.status === deletedDiscussionValues.status &&
            value.appellation_code ===
              deletedDiscussionValues.appellation_code &&
            value.candidate_firstname ===
              deletedDiscussionValues.potential_beneficiary_first_name &&
            value.contact_method === deletedDiscussionValues.contact_method &&
            value.department_code === deletedDiscussionValues.department_code &&
            value.kind === deletedDiscussionValues.kind &&
            value.immersion_objective ===
              deletedDiscussionValues.immersion_objective &&
            value.siret === deletedDiscussionValues.siret &&
            value.creation_date === deletedDiscussionValues.created_at,
        );
        const isDiscussionHasBeenAnsweredByEstablishment =
          deletedExchanges.some(
            (exchange) =>
              exchange.discussion_id === deletedDiscussionValues.id &&
              exchange.sender === "establishment",
          );
        const isDiscussionWithConvention =
          deletedDiscussionValues.convention_id !== null;

        return existingInAcc >= 0
          ? acc.map((accValue, i) =>
              existingInAcc === i
                ? {
                    ...accValue,
                    discussions_total: accValue.discussions_total + 1,
                    discussions_answered_by_establishment:
                      accValue.discussions_answered_by_establishment +
                      (isDiscussionHasBeenAnsweredByEstablishment ? 1 : 0),
                    discussions_with_convention:
                      accValue.discussions_with_convention +
                      (isDiscussionWithConvention ? 1 : 0),
                  }
                : accValue,
            )
          : [
              ...acc,
              {
                status: deletedDiscussionValues.status,
                appellation_code: deletedDiscussionValues.appellation_code,
                candidate_firstname:
                  deletedDiscussionValues.potential_beneficiary_first_name,
                contact_method: deletedDiscussionValues.contact_method,
                department_code: deletedDiscussionValues.department_code,
                kind: deletedDiscussionValues.kind,
                immersion_objective:
                  deletedDiscussionValues.immersion_objective,
                siret: deletedDiscussionValues.siret,
                creation_date: deletedDiscussionValues.created_at,
                discussions_total: 1,
                discussions_answered_by_establishment:
                  isDiscussionHasBeenAnsweredByEstablishment ? 1 : 0,
                discussions_with_convention: isDiscussionWithConvention ? 1 : 0,
              } satisfies DiscussionsStat,
            ];
      },
      [],
    );

    await this.transaction
      .insertInto("discussions_archives")
      .values(statsToAdd)
      .onConflict((oc) =>
        oc
          .columns([
            "appellation_code",
            "candidate_firstname",
            "contact_method",
            "creation_date",
            "department_code",
            "immersion_objective",
            "kind",
            "siret",
            "status",
          ])
          .doUpdateSet({
            discussions_total: (eb) =>
              eb(
                "discussions_archives.discussions_total",
                "+",
                eb.ref("excluded.discussions_total"),
              ),
            discussions_answered_by_establishment: (eb) =>
              eb(
                "discussions_archives.discussions_answered_by_establishment",
                "+",
                eb.ref("excluded.discussions_answered_by_establishment"),
              ),
            discussions_with_convention: (eb) =>
              eb(
                "discussions_archives.discussions_with_convention",
                "+",
                eb.ref("excluded.discussions_with_convention"),
              ),
          }),
      )
      .execute();
  }

  async getDiscussionIds({
    filters: { statuses, updatedBetween },
    orderBy,
    limit,
  }: GetDiscussionIdsParams): Promise<DiscussionId[]> {
    if (
      updatedBetween?.from &&
      updatedBetween?.to &&
      updatedBetween.from > updatedBetween.to
    )
      throw errors.generic.badDateRange(updatedBetween);
    if (limit <= 0 || limit > 10_000 || !Number.isInteger(limit))
      throw errors.generic.unsupportedLimit(limit);

    const results = await pipeWithValue(
      this.transaction.selectFrom("discussions").select("id").limit(limit),
      (builder) =>
        statuses && statuses.length > 0
          ? builder.where("status", "in", statuses)
          : builder,
      (builder) =>
        updatedBetween?.from
          ? builder.where("updated_at", ">=", updatedBetween.from)
          : builder,
      (builder) =>
        updatedBetween?.to
          ? builder.where("updated_at", "<=", updatedBetween.to)
          : builder,
      (builder) =>
        orderBy === "updatedAt" ? builder.orderBy("updated_at asc") : builder,
    ).execute();
    return results.map(({ id }) => id as DiscussionId);
  }

  public async countDiscussionsForSiretSince(
    siret: SiretDto,
    since: Date,
  ): Promise<number> {
    const result = await this.transaction
      .selectFrom("discussions")
      .select(({ fn }) => [fn.count<string>("id").as("count")])
      .where("siret", "=", siret)
      .where("created_at", ">=", since)
      .executeTakeFirst();

    return result ? Number.parseInt(result.count, 10) : 0;
  }

  public async deleteOldMessages(endedSince: Date) {
    const result = await this.transaction
      .updateTable("exchanges")
      .set({
        message: "Supprimé car trop ancien",
        attachments: sql`CAST(${JSON.stringify([])} AS JSONB)`,
      })
      .where((eb) =>
        eb.and([
          eb("sent_at", "<=", endedSince),
          eb.or([
            eb("message", "!=", "Supprimé car trop ancien"),
            eb(
              "attachments",
              "!=",
              sql<Attachment[]>`CAST(${JSON.stringify([])} AS JSONB)`,
            ),
          ]),
        ]),
      )
      .executeTakeFirst();

    return Number(result.numUpdatedRows);
  }

  public async getById(
    discussionId: DiscussionId,
  ): Promise<DiscussionDto | undefined> {
    const results = await executeGetDiscussions(this.transaction, {
      filters: {},
      limit: 1,
      id: discussionId,
    });

    const discussions = makeDiscussionDtoFromPgDiscussion(results);
    return discussions.at(0);
  }

  public async getDiscussions(
    params: GetDiscussionsParams,
  ): Promise<DiscussionDto[]> {
    return executeGetDiscussions(this.transaction, params).then((results) =>
      makeDiscussionDtoFromPgDiscussion(results),
    );
  }

  public async getPaginatedDiscussionsForUser({
    pagination,
    filters,
    userId,
    sort,
    userRole,
  }: GetPaginatedDiscussionsForUserParams): Promise<
    DataWithPagination<DiscussionInList>
  > {
    const authorizedRoles: EstablishmentRole[] = [
      "establishment-admin",
      "establishment-contact",
    ];
    const page = pagination.page;
    const limit = pagination.perPage;
    const offset = (page - 1) * limit;
    const { data, totalCount } = await match(userRole)
      .with("establishment", () =>
        getPaginatedDiscussionsForEstablishmentUser({
          transaction: this.transaction,
          userId,
          authorizedRoles,
          filters,
          limit,
          offset,
          sort,
        }),
      )
      .with("potentialBeneficiary", () =>
        getPaginatedDiscussionsForPotentialBeneficiaryUser({
          transaction: this.transaction,
          userId,
          filters,
          limit,
          offset,
          sort,
        }),
      )
      .exhaustive();

    const totalPages = Math.ceil(totalCount / limit);

    return {
      data,
      pagination: {
        totalRecords: totalCount,
        currentPage: page,
        totalPages,
        numberPerPage: limit,
      },
    };
  }

  public async hasDiscussionMatching(
    params: Partial<HasDiscussionMatchingParams>,
  ): Promise<boolean> {
    if (keys(params).length === 0)
      throw errors.discussion.hasDiscussionMissingParams();
    const result = await this.transaction
      .selectNoFrom(({ exists, selectFrom, lit }) => [
        exists(
          pipeWithValue(
            selectFrom("discussions").select(lit(1).as("one")),
            (builder) =>
              params.siret
                ? builder.where("siret", "=", params.siret)
                : builder,
            (builder) =>
              params.appellationCode
                ? builder.where(
                    "appellation_code",
                    "=",
                    +params.appellationCode,
                  )
                : builder,
            (builder) =>
              params.since
                ? builder.where("created_at", ">=", params.since)
                : builder,
            (builder) =>
              params.potentialBeneficiaryEmail
                ? builder.where(
                    "potential_beneficiary_email",
                    "=",
                    params.potentialBeneficiaryEmail,
                  )
                : builder,
          ),
        ).as("exists"),
      ])
      .executeTakeFirst();

    return !!result?.exists;
  }

  public async insert(discussion: DiscussionDto) {
    const discussionToInsert = await discussionToPgAndPhoneInsert(
      this.transaction,
      discussion,
    );

    await this.transaction
      .insertInto("discussions")
      .values(discussionToInsert)
      .execute();

    await this.#insertAllExchanges(discussion.id, discussion.exchanges);
  }

  public async update(discussion: DiscussionDto) {
    const discussionToUpdate = await discussionToPgAndPhoneInsert(
      this.transaction,
      discussion,
    );

    await this.transaction
      .updateTable("discussions")
      .set(discussionToUpdate)
      .where("id", "=", discussion.id)
      .execute();
    await this.#clearAllExistingExchanges(discussion);
    await this.#insertAllExchanges(discussion.id, discussion.exchanges);
  }

  async #insertAllExchanges(discussionId: DiscussionId, exchanges: Exchange[]) {
    if (exchanges.length === 0) return;

    await this.transaction
      .insertInto("exchanges")
      .values(
        exchanges.map((exchange) => ({
          subject: exchange.subject,
          discussion_id: discussionId,
          message: exchange.message,
          sender: exchange.sender,
          establishment_first_name:
            exchange.sender === "establishment" ? exchange.firstname : null,
          establishment_last_name:
            exchange.sender === "establishment" ? exchange.lastname : null,
          establishment_email:
            exchange.sender === "establishment" ? exchange.email : null,
          sent_at: exchange.sentAt,
          attachments: sql`CAST(${JSON.stringify(
            exchange.attachments,
          )} AS JSONB)`,
        })),
      )
      .execute();
  }

  async #clearAllExistingExchanges(discussion: DiscussionDto) {
    await this.transaction
      .deleteFrom("exchanges")
      .where("discussion_id", "=", discussion.id)
      .execute();
  }

  public async getObsoleteDiscussions(params: {
    olderThan: Date;
  }): Promise<DiscussionId[]> {
    const obsoleteDiscussions = await this.transaction
      .selectFrom("discussions")
      .select("discussions.id")
      .leftJoin("exchanges", "discussions.id", "exchanges.discussion_id")
      .where("created_at", "<=", params.olderThan)
      .where("status", "=", "PENDING")
      .having((eb) => eb.fn.count("exchanges.id"), "=", 1)
      .orderBy("created_at", "asc")
      .groupBy(["discussions.id", "discussions.created_at"])
      .execute();

    return obsoleteDiscussions.map((d) => d.id);
  }
}

const discussionToPgAndPhoneInsert = async (
  transaction: KyselyDb,
  discussion: DiscussionDto,
): Promise<InsertObject<Database, "discussions">> => {
  const phoneId = (
    await getOrCreatePhoneIds(transaction, [
      discussion.potentialBeneficiary.phone,
    ])
  )[discussion.potentialBeneficiary.phone];

  return {
    id: discussion.id,
    appellation_code: +discussion.appellationCode,
    business_name: discussion.businessName,
    city: discussion.address.city,
    created_at: discussion.createdAt,
    updated_at: discussion.updatedAt,
    department_code: discussion.address.departmentCode,
    postcode: discussion.address.postcode,
    potential_beneficiary_email: discussion.potentialBeneficiary.email,
    potential_beneficiary_last_name: discussion.potentialBeneficiary.lastName,
    kind: discussion.kind,
    immersion_objective: discussion.potentialBeneficiary.immersionObjective,
    potential_beneficiary_phone_id: phoneId,
    potential_beneficiary_date_preferences:
      discussion.potentialBeneficiary.datePreferences,
    ...(discussion.kind === "IF"
      ? {
          potential_beneficiary_resume_link:
            discussion.potentialBeneficiary.resumeLink,
          potential_beneficiary_experience_additional_information:
            discussion.potentialBeneficiary.experienceAdditionalInformation,
        }
      : {}),
    potential_beneficiary_level_of_education:
      discussion.kind === "1_ELEVE_1_STAGE"
        ? discussion.potentialBeneficiary.levelOfEducation
        : null,
    street_number_and_address: discussion.address.streetNumberAndAddress,
    siret: discussion.siret,
    contact_method: discussion.contactMode,
    potential_beneficiary_first_name: discussion.potentialBeneficiary.firstName,
    acquisition_campaign: discussion.acquisitionCampaign,
    acquisition_keyword: discussion.acquisitionKeyword,
    convention_id: discussion.conventionId,
    location_id: discussion.locationId,
    ...discussionStatusWithRejectionToPg(discussion),
  };
};

const getBannedEstablishmentInfoFromPgDiscussion = (
  discussion: GetDiscussionsResults[number]["discussion"],
): WithBannedEstablishmentInformations => {
  if (!discussion.isEstablishmentBanned)
    return { isEstablishmentBanned: false };
  if (!discussion.establishmentBannishmentJustification)
    throw new Error(
      `Missing establishmentBannishmentJustification for banned discussion ${discussion.id}`,
    );
  return {
    isEstablishmentBanned: true,
    establishmentBannishmentJustification:
      discussion.establishmentBannishmentJustification,
  };
};

const getWithDiscussionStatusFromPgDiscussion = (
  discussion: GetDiscussionsResults[number]["discussion"],
): WithDiscussionStatus => {
  return match(discussion)
    .with({ status: "PENDING" }, ({ status }) => ({ status }))
    .with({ status: "REJECTED", rejectionKind: P.nullish }, (discussion) => {
      throw new Error(
        `Missing rejectionKind for rejected discussion ${discussion.id}`,
      );
    })
    .with(
      {
        status: "REJECTED",
        rejectionKind: "CANDIDATE_ALREADY_WARNED",
        candidateWarnedMethod: P.nullish,
      },
      (discussion) => {
        throw new Error(
          `Missing candidateWarnedMethod for CANDIDATE_ALREADY_WARNED rejection in discussion ${discussion.id}`,
        );
      },
    )
    .with(
      {
        status: "REJECTED",
        rejectionKind: "CANDIDATE_ALREADY_WARNED",
        candidateWarnedMethod: P.not(P.nullish),
      },
      ({ candidateWarnedMethod, status, rejectionKind }) => ({
        status,
        rejectionKind,
        candidateWarnedMethod,
      }),
    )
    .with(
      {
        status: "REJECTED",
        rejectionKind: "OTHER",
        rejectionReason: P.nullish,
      },
      (discussion) => {
        throw new Error(
          `Missing rejectionReason for OTHER rejection in discussion ${discussion.id}`,
        );
      },
    )
    .with(
      {
        status: "REJECTED",
        rejectionKind: "OTHER",
        rejectionReason: P.not(P.nullish),
      },
      ({ rejectionReason, status, rejectionKind, candidateWarnedMethod }) => ({
        status,
        rejectionKind,
        rejectionReason,
        candidateWarnedMethod,
      }),
    )
    .with(
      {
        status: "REJECTED",
        rejectionKind: P.union("UNABLE_TO_HELP", "NO_TIME", "DEPRECATED"),
      },
      ({ status, rejectionKind, candidateWarnedMethod }) => ({
        status,
        rejectionKind,
        candidateWarnedMethod,
      }),
    )
    .with({ status: "ACCEPTED" }, (discussion) => ({
      status: discussion.status,
      candidateWarnedMethod: discussion.candidateWarnedMethod ?? null,
    }))
    .exhaustive();
};

const makeDiscussionDtoFromPgDiscussion = (
  results: GetDiscussionsResults,
): DiscussionDto[] =>
  results.map(({ discussion }): DiscussionDto => {
    const common: CommonDiscussionDto = {
      address: discussion.address,
      businessName: discussion.businessName,
      createdAt: new Date(discussion.createdAt).toISOString(),
      updatedAt: new Date(discussion.updatedAt).toISOString(),
      siret: discussion.siret,
      conventionId: discussion.conventionId,
      id: discussion.id,
      locationId: discussion.locationId,
      ...getWithDiscussionStatusFromPgDiscussion(discussion),
      ...getBannedEstablishmentInfoFromPgDiscussion(discussion),
    };

    const commonPotentialBeneficiary: PotentialBeneficiaryCommonProps = {
      firstName: discussion.potentialBeneficiary.firstName,
      lastName: discussion.potentialBeneficiary.lastName,
      email: discussion.potentialBeneficiary.email,
      phone: discussion.potentialBeneficiary.phone,
      datePreferences: discussion.potentialBeneficiary.datePreferences,
    };

    if (discussion.kind === "IF") {
      return {
        ...common,
        appellationCode: discussion.appellationCode,
        acquisitionCampaign: discussion.acquisition_campaign,
        acquisitionKeyword: discussion.acquisition_keyword,
        contactMode: discussion.contactMode,
        kind: discussion.kind,
        exchanges: (discussion.exchanges ?? []).map(({ sentAt, ...rest }) => ({
          ...rest,
          sentAt: new Date(sentAt).toISOString(),
        })),
        potentialBeneficiary: {
          ...commonPotentialBeneficiary,
          immersionObjective: discussion.immersionObjective ?? null,
          resumeLink: discussion.potentialBeneficiary.resumeLink,
          experienceAdditionalInformation:
            discussion.potentialBeneficiary.experienceAdditionalInformation,
        },
      };
    }

    if (
      discussion.immersionObjective !==
      "Découvrir un métier ou un secteur d'activité"
    )
      throw errors.discussion.badImmersionObjective(
        discussion.id,
        discussion.kind,
        discussion.immersionObjective,
      );

    if (!discussion.potentialBeneficiary.levelOfEducation)
      throw errors.discussion.missingLevelOfEducation({
        id: discussion.id,
        kind: discussion.kind,
      });

    return {
      ...common,
      appellationCode: discussion.appellationCode,
      acquisitionCampaign: discussion.acquisition_campaign,
      acquisitionKeyword: discussion.acquisition_keyword,
      contactMode: discussion.contactMode,
      exchanges: (discussion.exchanges ?? []).map(({ sentAt, ...rest }) => ({
        ...rest,
        sentAt: new Date(sentAt).toISOString(),
      })),
      kind: discussion.kind,
      potentialBeneficiary: {
        ...commonPotentialBeneficiary,
        immersionObjective: discussion.immersionObjective,
        levelOfEducation: discussion.potentialBeneficiary.levelOfEducation,
      },
    };
  });

const discussionStatusWithRejectionToPg = (
  discussionStatusWithRejection: WithDiscussionStatus,
): {
  status: DiscussionStatus;
  rejection_kind: RejectionKind | null;
  rejection_reason: string | null;
  candidate_warned_method: CandidateWarnedMethod | null;
} => {
  const { status } = discussionStatusWithRejection;
  if (status === "REJECTED") {
    return {
      status: status,
      rejection_kind: discussionStatusWithRejection.rejectionKind,
      rejection_reason:
        discussionStatusWithRejection.rejectionKind === "OTHER"
          ? discussionStatusWithRejection.rejectionReason
          : null,
      candidate_warned_method:
        discussionStatusWithRejection.rejectionKind ===
        "CANDIDATE_ALREADY_WARNED"
          ? discussionStatusWithRejection.candidateWarnedMethod
          : null,
    };
  }

  return {
    status: status,
    rejection_kind: null,
    rejection_reason: null,
    candidate_warned_method:
      status === "PENDING"
        ? null
        : discussionStatusWithRejection.candidateWarnedMethod,
  };
};

type GetDiscussionsResults = Awaited<ReturnType<typeof executeGetDiscussions>>;
const executeGetDiscussions = (
  transaction: KyselyDb,
  {
    filters: {
      createdSince,
      answeredByEstablishment,
      createdBetween,
      sirets,
      status,
      contactMode,
    },
    id,
    limit,
  }: GetDiscussionsParams & { id?: DiscussionId },
) =>
  transaction
    .selectFrom("discussions as d")
    .innerJoin(
      (qb) =>
        pipeWithValue(
          qb.selectFrom("discussions").select("discussions.id"),
          (qb) =>
            contactMode
              ? qb.where("discussions.contact_method", "=", contactMode)
              : qb,
          (qb) => (status ? qb.where("discussions.status", "=", status) : qb),
          (qb) => (id ? qb.where("discussions.id", "=", id) : qb),
          (qb) => {
            if (!sirets) return qb;
            if (sirets.length === 0) throw errors.discussion.badSiretFilter();
            return qb.where((eb) => isInArray(eb, "discussions.siret", sirets));
          },
          (qb) =>
            createdSince
              ? qb.where("discussions.created_at", ">=", createdSince)
              : qb,
          (qb) =>
            createdBetween
              ? qb.where((qb) =>
                  qb.between(
                    qb.ref("discussions.created_at"),
                    createdBetween.from,
                    createdBetween.to,
                  ),
                )
              : qb,
          (qb) =>
            answeredByEstablishment !== undefined
              ? qb.where(({ not, exists, selectFrom, lit }) => {
                  const existSubQuery = exists(
                    selectFrom("exchanges")
                      .select(lit(1).as("one"))
                      .whereRef(
                        "exchanges.discussion_id",
                        "=",
                        "discussions.id",
                      )
                      .where("exchanges.sender", "=", "establishment"),
                  );
                  return answeredByEstablishment
                    ? existSubQuery
                    : not(existSubQuery);
                })
              : qb,
        )
          .limit(limit)
          .as("filtered_discussions"),
      (join) => join.onRef("d.id", "=", "filtered_discussions.id"),
    )
    .leftJoin("exchanges as e", "d.id", "e.discussion_id")
    .leftJoin(
      "phone_numbers as pn",
      "d.potential_beneficiary_phone_id",
      "pn.id",
    )
    .leftJoin("banned_establishments as be", "be.siret", "d.siret")
    .groupBy([
      "d.id",
      "d.created_at",
      "d.siret",
      "pn.phone_number",
      "be.siret",
      "be.bannishment_justification",
    ])
    .orderBy("d.created_at", "desc")
    .orderBy("d.siret", "asc")
    .orderBy("d.updated_at", "desc")
    .select(({ ref, fn }) =>
      jsonStripNulls(
        jsonBuildObject({
          id: ref("d.id"),
          createdAt: ref("d.created_at"),
          updatedAt: ref("d.updated_at"),
          siret: ref("d.siret"),
          businessName: ref("d.business_name"),
          appellationCode: sql<string>`CAST(${ref(
            "appellation_code",
          )} AS text)`,
          immersionObjective: ref("d.immersion_objective"),
          contactMode: sql<ContactMode>`${ref("d.contact_method")}`,
          potentialBeneficiary: jsonBuildObject({
            firstName: ref("d.potential_beneficiary_first_name"),
            lastName: ref("d.potential_beneficiary_last_name"),
            email: ref("d.potential_beneficiary_email"),
            phone: ref("pn.phone_number").$castTo<PhoneNumber>(),
            resumeLink: ref("d.potential_beneficiary_resume_link"),
            experienceAdditionalInformation: ref(
              "potential_beneficiary_experience_additional_information",
            ),
            datePreferences: ref("d.potential_beneficiary_date_preferences"),
            levelOfEducation: ref("d.potential_beneficiary_level_of_education"),
          }),
          address: jsonBuildObject({
            streetNumberAndAddress: ref("d.street_number_and_address"),
            postcode: ref("d.postcode"),
            departmentCode: ref("d.department_code"),
            city: ref("d.city"),
          }),
          exchanges: fn
            .jsonAgg(
              sql`
                JSON_BUILD_OBJECT(
                  'subject', e.subject,
                  'message', e.message,
                  'firstname',e.establishment_first_name,
                  'lastname',e.establishment_last_name,
                  'email',e.establishment_email,
                  'sender', e.sender,
                  'sentAt', e.sent_at,
                  'attachments', e.attachments
                )
                ORDER BY e.sent_at
              `.$castTo<Exchange>(),
            )
            .filterWhere("e.id", "is not", null)
            // TODO: le cast ne change pas le typage - trouver un moyen d'avoir l'optional[] dans le typage kysely naturel
            .$castTo<Exchange[] | undefined>(),
          conventionId: ref("d.convention_id"),
          status: sql<DiscussionStatus>`${ref("d.status")}`,
          rejectionKind: sql<RejectionKind | null>`${ref("d.rejection_kind")}`,
          rejectionReason: ref("d.rejection_reason"),
          acquisition_campaign: ref("d.acquisition_campaign"),
          acquisition_keyword: ref("d.acquisition_keyword"),
          candidateWarnedMethod: ref("d.candidate_warned_method"),
          kind: ref("d.kind"),
          locationId: sql<LocationId>`${ref("d.location_id")}`,
          isEstablishmentBanned: sql<boolean>`${ref("be.siret")} IS NOT NULL`,
          establishmentBannishmentJustification: ref(
            "be.bannishment_justification",
          ),
        }),
      ).as("discussion"),
    )
    .execute();

export type DiscussionsStat = {
  siret: string;
  kind: DiscussionKind;
  status: DiscussionStatus;
  contact_method: string;
  immersion_objective: ImmersionObjective | null;
  department_code: string;
  candidate_firstname: string;
  creation_date: string;
  appellation_code: number;
  discussions_total: number;
  discussions_answered_by_establishment: number;
  discussions_with_convention: number;
};

const executeGetDiscussionsStats = (
  transaction: KyselyDb,
): Promise<DiscussionsStat[]> =>
  transaction
    .selectFrom("discussions_archives")
    .select(({ ref }) => [
      ref("siret").as("siret"),
      ref("kind").as("kind"),
      ref("status").as("status"),
      ref("contact_method").as("contact_method"),
      ref("immersion_objective").as("immersion_objective"),
      ref("department_code").as("department_code"),
      ref("candidate_firstname").as("candidate_firstname"),
      sql<string>`TO_CHAR(${ref("creation_date")}, 'YYYY-MM-DD')`.as(
        "creation_date",
      ),
      ref("appellation_code").as("appellation_code"),
      ref("discussions_total").as("discussions_total"),
      ref("discussions_answered_by_establishment").as(
        "discussions_answered_by_establishment",
      ),
      ref("discussions_with_convention").as("discussions_with_convention"),
    ])
    .execute()
    .then((results) =>
      results.map((r) => ({ ...r, creation_date: r.creation_date })),
    );

const getPaginatedDiscussionsForEstablishmentUser = async ({
  transaction,
  userId,
  authorizedRoles,
  filters,
  limit,
  offset,
  sort,
}: {
  transaction: KyselyDb;
  userId: GetPaginatedDiscussionsForUserParams["userId"];
  authorizedRoles: EstablishmentRole[];
  filters: GetPaginatedDiscussionsForUserFilters;
  limit: number;
  offset: number;
  sort: GetPaginatedDiscussionsForUserSort;
}): Promise<{ data: DiscussionInList[]; totalCount: number }> => {
  const builder = pipeWithValue(
    transaction
      .selectFrom("establishments__users as eu")
      .innerJoin("discussions", "eu.siret", "discussions.siret")
      .where("eu.user_id", "=", userId)
      .where("eu.role", "in", authorizedRoles)
      .where("eu.status", "=", "ACCEPTED")
      .leftJoin(
        "phone_numbers",
        "discussions.potential_beneficiary_phone_id",
        "phone_numbers.id",
      )
      .innerJoin(
        "public_appellations_data as pad",
        "discussions.appellation_code",
        "pad.ogr_appellation",
      )
      .innerJoin("public_romes_data as prd", "pad.code_rome", "prd.code_rome")
      .innerJoin("establishments", "establishments.siret", "discussions.siret")
      .leftJoin(
        "banned_establishments",
        "banned_establishments.siret",
        "discussions.siret",
      ),
    (b) => {
      if (!filters?.statuses || filters.statuses.length === 0) return b;
      return b.where("discussions.status", "in", filters.statuses);
    },
    (b) => {
      if (!filters?.search) return b;
      return b.where((eb) =>
        eb.or([
          eb("discussions.siret", "ilike", `%${filters.search}%`),
          eb("discussions.business_name", "ilike", `%${filters.search}%`),
          eb(
            "discussions.potential_beneficiary_first_name",
            "ilike",
            `%${filters.search}%`,
          ),
          eb(
            "discussions.potential_beneficiary_last_name",
            "ilike",
            `%${filters.search}%`,
          ),
          eb("pad.libelle_appellation_long", "ilike", `%${filters.search}%`),
          eb(
            sql`CAST(discussions.immersion_objective AS text)`, // immersion objective is ImmersionObjectives, not a string
            "ilike",
            `%${filters.search}%`,
          ),
        ]),
      );
    },
  );

  const [data, totalCount] = await Promise.all([
    builder
      .limit(limit)
      .offset(offset)
      .orderBy(orderColumnByOrderKey[sort.by], sort.direction)
      .select(({ ref }) => [
        ref("discussions.id").as("id"),
        jsonBuildObject({
          romeCode: ref("prd.code_rome"),
          romeLabel: ref("prd.libelle_rome"),
          appellationCode: sql<string>`CAST(${ref("pad.ogr_appellation")} AS text)`,
          appellationLabel: ref("pad.libelle_appellation_long"),
        }).as("appellation"),
        ref("discussions.business_name").as("businessName"),
        sql<string>`TO_CHAR(${ref("discussions.created_at")}, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`.as(
          "createdAt",
        ),
        sql<string>`TO_CHAR(${ref("discussions.updated_at")}, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`.as(
          "updatedAt",
        ),
        ref("discussions.city").as("city"),
        ref("discussions.siret").as("siret"),
        ref("discussions.kind").as("kind"),
        ref("discussions.status").as("status"),
        sql<ContactMode>`${ref("discussions.contact_method")}`.as(
          "contactMode",
        ),
        ref("discussions.immersion_objective").as("immersionObjective"),
        sql<boolean>`${ref("banned_establishments.siret")} IS NOT NULL`.as(
          "isEstablishmentBanned",
        ),
        sql<boolean>`
                ${ref("establishments.contact_mode")} = 'EMAIL' AND EXISTS (
                  SELECT 1 FROM establishments__users
                  WHERE establishments__users.siret = ${ref("discussions.siret")}
                  AND establishments__users.is_main_contact_by_phone = true
                )
              `.as("isEstablishmentReachableByPhoneAfter15Days"),
        jsonBuildObject({
          firstName: ref("potential_beneficiary_first_name"),
          lastName: ref("potential_beneficiary_last_name"),
          phone: ref("phone_numbers.phone_number"),
        }).as("potentialBeneficiary"),
        jsonBuildObject({
          count: sql<number>`(
                  SELECT CAST(COUNT(*) AS INT)
                  FROM exchanges e
                  WHERE e.discussion_id = ${ref("discussions.id")}
                )`,
          lastExchange: sql<DiscussionInList["exchangesData"]["lastExchange"]>`(
                  SELECT json_build_object(
                    'sender', e.sender,
                    'sentAt', TO_CHAR(e.sent_at, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
                  )
                  FROM exchanges e
                  WHERE e.discussion_id = ${ref("discussions.id")}
                  ORDER BY e.sent_at DESC
                  LIMIT 1
                )`,
          hasEstablishmentAnswered: sql<boolean>`(
            SELECT EXISTS (
              SELECT 1
              FROM exchanges e
              WHERE e.discussion_id = ${ref("discussions.id")}
                AND e.sender = 'establishment'
            )
          )`,
        }).as("exchangesData"),
      ])
      .execute(),
    builder
      .select(({ fn }) => [fn.count("discussions.id").distinct().as("count")])
      .executeTakeFirstOrThrow()
      .then((result) => Number(result.count)),
  ]);

  return { data, totalCount };
};

const getPaginatedDiscussionsForPotentialBeneficiaryUser = async ({
  transaction,
  userId,
  filters,
  limit,
  offset,
  sort,
}: {
  transaction: KyselyDb;
  userId: GetPaginatedDiscussionsForUserParams["userId"];
  filters: GetPaginatedDiscussionsForUserFilters;
  limit: number;
  offset: number;
  sort: GetPaginatedDiscussionsForUserSort;
}): Promise<{ data: DiscussionInList[]; totalCount: number }> => {
  const builder = pipeWithValue(
    transaction
      .selectFrom("users")
      .innerJoin(
        "discussions",
        "users.email",
        "discussions.potential_beneficiary_email",
      )
      .where("users.id", "=", userId)
      .leftJoin(
        "phone_numbers",
        "discussions.potential_beneficiary_phone_id",
        "phone_numbers.id",
      )
      .innerJoin(
        "public_appellations_data as pad",
        "discussions.appellation_code",
        "pad.ogr_appellation",
      )
      .innerJoin("public_romes_data as prd", "pad.code_rome", "prd.code_rome")
      .innerJoin("establishments", "establishments.siret", "discussions.siret")
      .leftJoin(
        "banned_establishments",
        "banned_establishments.siret",
        "discussions.siret",
      ),
    (b) => {
      if (!filters?.statuses || filters.statuses.length === 0) return b;
      return b.where("discussions.status", "in", filters.statuses);
    },
    (b) => {
      if (!filters?.search) return b;
      return b.where((eb) =>
        eb.or([
          eb("discussions.siret", "ilike", `%${filters.search}%`),
          eb("discussions.business_name", "ilike", `%${filters.search}%`),
          eb(
            "discussions.potential_beneficiary_first_name",
            "ilike",
            `%${filters.search}%`,
          ),
          eb(
            "discussions.potential_beneficiary_last_name",
            "ilike",
            `%${filters.search}%`,
          ),
          eb("pad.libelle_appellation_long", "ilike", `%${filters.search}%`),
          eb(
            sql`CAST(discussions.immersion_objective AS text)`, // immersion objective is ImmersionObjectives, not a string
            "ilike",
            `%${filters.search}%`,
          ),
        ]),
      );
    },
  );

  const [data, totalCount] = await Promise.all([
    builder
      .limit(limit)
      .offset(offset)
      .orderBy(orderColumnByOrderKey[sort.by], sort.direction)
      .select(({ ref }) => [
        ref("discussions.id").as("id"),
        jsonBuildObject({
          romeCode: ref("prd.code_rome"),
          romeLabel: ref("prd.libelle_rome"),
          appellationCode: sql<string>`CAST(${ref("pad.ogr_appellation")} AS text)`,
          appellationLabel: ref("pad.libelle_appellation_long"),
        }).as("appellation"),
        ref("discussions.business_name").as("businessName"),
        sql<string>`TO_CHAR(${ref("discussions.created_at")}, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`.as(
          "createdAt",
        ),
        sql<string>`TO_CHAR(${ref("discussions.updated_at")}, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`.as(
          "updatedAt",
        ),
        ref("discussions.city").as("city"),
        ref("discussions.siret").as("siret"),
        ref("discussions.kind").as("kind"),
        ref("discussions.status").as("status"),
        sql<ContactMode>`${ref("discussions.contact_method")}`.as(
          "contactMode",
        ),
        ref("discussions.immersion_objective").as("immersionObjective"),
        sql<boolean>`${ref("banned_establishments.siret")} IS NOT NULL`.as(
          "isEstablishmentBanned",
        ),
        sql<boolean>`
                ${ref("establishments.contact_mode")} = 'EMAIL' AND EXISTS (
                  SELECT 1 FROM establishments__users
                  WHERE establishments__users.siret = ${ref("discussions.siret")}
                  AND establishments__users.is_main_contact_by_phone = true
                )
              `.as("isEstablishmentReachableByPhoneAfter15Days"),
        jsonBuildObject({
          firstName: ref("potential_beneficiary_first_name"),
          lastName: ref("potential_beneficiary_last_name"),
          phone: ref("phone_numbers.phone_number"),
        }).as("potentialBeneficiary"),
        jsonBuildObject({
          count: sql<number>`(
                  SELECT CAST(COUNT(*) AS INT)
                  FROM exchanges e
                  WHERE e.discussion_id = ${ref("discussions.id")}
                )`,
          lastExchange: sql<DiscussionInList["exchangesData"]["lastExchange"]>`(
                  SELECT json_build_object(
                    'sender', e.sender,
                    'sentAt', TO_CHAR(e.sent_at, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
                  )
                  FROM exchanges e
                  WHERE e.discussion_id = ${ref("discussions.id")}
                  ORDER BY e.sent_at DESC
                  LIMIT 1
                )`,
          hasEstablishmentAnswered: sql<boolean>`(
            SELECT EXISTS (
              SELECT 1
              FROM exchanges e
              WHERE e.discussion_id = ${ref("discussions.id")}
                AND e.sender = 'establishment'
            )
          )`,
        }).as("exchangesData"),
      ])
      .execute(),
    builder
      .select(({ fn }) => [fn.count("discussions.id").distinct().as("count")])
      .executeTakeFirstOrThrow()
      .then((result) => Number(result.count)),
  ]);

  return { data, totalCount };
};
