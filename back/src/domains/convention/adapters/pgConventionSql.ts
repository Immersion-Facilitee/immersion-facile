import type { SelectQueryBuilder } from "kysely";
import { sql } from "kysely";
import {
  type AgencyId,
  type AppellationCode,
  type AppellationLabel,
  type Beneficiary,
  type ConventionDto,
  type ConventionId,
  conventionSchema,
  type DateString,
  type DateTimeIsoString,
  type Email,
  pipeWithValue,
  type RomeCode,
  type RomeLabel,
  type ScheduleDto,
  type SiretDto,
} from "shared";
import { validateAndParseZodSchema } from "../../../config/helpers/validateAndParseZodSchema";
import {
  cast,
  jsonBuildObject,
  jsonStripNulls,
  type KyselyDb,
} from "../../../config/pg/kysely/kyselyUtils";
import type { Database } from "../../../config/pg/kysely/model/database";
import { createLogger } from "../../../utils/logger";

export const hasEmptyArrayFilter = (filters: object): boolean =>
  Object.values(filters).some(
    (value) => Array.isArray(value) && value.length === 0,
  );

// Common type for the query builder with proper return type
type ConventionQueryBuilderDb = Database & {
  b: Database["actors"];
  er: Database["actors"];
  et: Database["actors"];
  br: Database["actors"];
  bce: Database["actors"];
  ftu: Database["ft_connect_users"];
  cftu: Database["conventions__ft_connect_users"];
  vad: Database["view_appellations_dto"];
};

export type ConventionBaseQueryBuilder = SelectQueryBuilder<
  ConventionQueryBuilderDb,
  keyof ConventionQueryBuilderDb,
  any
>;

export type ConventionQueryBuilder = SelectQueryBuilder<
  ConventionQueryBuilderDb,
  keyof ConventionQueryBuilderDb,
  { dto: ConventionDto }
>;

type InferSelectQueryBuilder<T> =
  T extends SelectQueryBuilder<infer DB, infer TB, any>
    ? SelectQueryBuilder<DB, TB, any>
    : never;

export type BroadcastFeedbackBaseQueryBuilder = InferSelectQueryBuilder<
  ReturnType<typeof createBroadcastFeedbackBaseBuilder>
>;

export type ConventionsWithErroredBroadcastFeedbackBuilder = ReturnType<
  typeof createConventionsWithErroredBroadcastFeedbackBuilder
>;

// Function to create the common selection part with proper return type
const createConventionSelection = (
  builder: SelectQueryBuilder<
    ConventionQueryBuilderDb,
    keyof ConventionQueryBuilderDb,
    any
  >,
): ConventionQueryBuilder => {
  return builder.select(({ ref, ...eb }) =>
    jsonStripNulls(
      jsonBuildObject({
        id: ref("conventions.id"),
        status: ref("conventions.status"),
        dateValidation: sql<DateString>`date_to_iso(conventions.date_validation)`,
        dateApproval: sql<DateString>`date_to_iso(conventions.date_approval)`,
        dateSubmission: sql<DateString>`date_to_iso(conventions.date_submission)`,
        dateStart: sql<DateString>`date_to_iso(conventions.date_start)`,
        dateEnd: sql<DateString>`date_to_iso(conventions.date_end)`,
        updatedAt: sql<DateString>`date_to_iso(conventions.updated_at)`,
        signatories: jsonBuildObject({
          beneficiary: jsonBuildObject({
            role: sql`'beneficiary'`,
            firstName: ref("b.first_name"),
            lastName: ref("b.last_name"),
            email: ref("b.email"),
            phone: ref("phone_numbers.phone_number"),
            signedAt: sql`date_to_iso(b.signed_at)`,
            isRqth: eb
              .case()
              .when(sql`b.extra_fields ->> 'isRqth'`, "is not", null)
              .then(sql`(b.extra_fields ->> 'isRqth')::boolean`)
              .else(null)
              .end(),
            emergencyContact: sql`b.extra_fields ->> 'emergencyContact'`,
            emergencyContactPhone: sql`phone_numbers_b_emergency_phone.phone_number`,
            emergencyContactEmail: sql`b.extra_fields ->> 'emergencyContactEmail'`,
            federatedIdentity: eb
              .case()
              .when("ftu.ft_connect_id", "is not", null)
              .then(
                jsonBuildObject({
                  provider: sql`'ftConnect'`,
                  token: ref("ftu.ft_connect_id"),
                  payload: eb
                    .case()
                    .when("ftu.advisor_email", "is not", null)
                    .then(
                      jsonBuildObject({
                        advisor: jsonBuildObject({
                          email: ref("ftu.advisor_email"),
                          firstName: ref("ftu.advisor_firstname"),
                          lastName: ref("ftu.advisor_lastname"),
                          type: ref("ftu.advisor_kind"),
                        }),
                      }),
                    )
                    .else(null)
                    .end(),
                }),
              )
              .else(null)
              .end(),
            levelOfEducation: eb
              .case()
              .when(sql`b.extra_fields ->> 'levelOfEducation'`, "is not", null)
              .then(sql`b.extra_fields ->> 'levelOfEducation'`)
              .else(null)
              .end(),
            financiaryHelp: eb
              .case()
              .when(sql`b.extra_fields ->> 'financiaryHelp'`, "is not", null)
              .then(sql`b.extra_fields ->> 'financiaryHelp'`)
              .else(null)
              .end(),
            address: eb
              .case()
              .when(sql`b.extra_fields ->> 'address'`, "is not", null)
              .then(
                jsonBuildObject({
                  city: sql`b.extra_fields -> 'address' ->> 'city'`,
                  departmentCode: sql`b.extra_fields -> 'address' ->> 'departmentCode'`,
                  postcode: sql`b.extra_fields -> 'address' ->> 'postcode'`,
                  streetNumberAndAddress: sql`b.extra_fields -> 'address' ->> 'streetNumberAndAddress'`,
                }),
              )
              .else(null)
              .end(),
            birthdate: eb
              .case()
              .when(sql`b.extra_fields ->> 'birthdate'`, "is not", null)
              .then(sql`b.extra_fields ->> 'birthdate'`)
              .else(sql`'1970-01-01T12:00:00.000Z'`)
              .end(),
            schoolName: eb
              .case()
              .when(sql`b.extra_fields ->> 'schoolName'`, "is not", null)
              .then(sql`b.extra_fields ->> 'schoolName'`)
              .else(null)
              .end(),
            schoolPostcode: eb
              .case()
              .when(sql`b.extra_fields ->> 'schoolPostcode'`, "is not", null)
              .then(sql`b.extra_fields ->> 'schoolPostcode'`)
              .else(null)
              .end(),
          }).$castTo<Beneficiary<"immersion">>(),
          beneficiaryCurrentEmployer: eb
            .case()
            .when("bce.id", "is", null)
            .then(null)
            .else(
              jsonBuildObject({
                role: sql`'beneficiary-current-employer'`,
                firstName: ref("bce.first_name"),
                lastName: ref("bce.last_name"),
                email: ref("bce.email"),
                phone: sql`phone_numbers_bce.phone_number`,
                job: sql`bce.extra_fields ->> 'job'`.$castTo<string>(),
                businessSiret: sql`bce.extra_fields ->> 'businessSiret'`,
                businessName: sql`bce.extra_fields ->> 'businessName'`,
                signedAt: sql`date_to_iso(bce.signed_at)`,
                businessAddress: sql`bce.extra_fields ->> 'businessAddress'`,
              }),
            )
            .end(),
          establishmentRepresentative: jsonBuildObject({
            role: sql`'establishment-representative'`,
            firstName: ref("er.first_name"),
            lastName: ref("er.last_name"),
            email: ref("er.email"),
            phone: sql`phone_numbers_er.phone_number`,
            signedAt: sql`date_to_iso(er.signed_at)`,
          }),
          beneficiaryRepresentative: eb
            .case()
            .when("br.id", "is", null)
            .then(null)
            .else(
              jsonBuildObject({
                role: sql`'beneficiary-representative'`,
                firstName: ref("br.first_name"),
                lastName: ref("br.last_name"),
                email: ref("br.email"),
                phone: sql`phone_numbers_br.phone_number`,
                signedAt: sql`date_to_iso(br.signed_at)`,
              }),
            )
            .end(),
        }),
        siret: ref("conventions.siret"),
        schedule: cast<ScheduleDto>(ref("conventions.schedule")),
        businessName: ref("conventions.business_name"),
        businessNameCustomized: ref("conventions.business_name_customized"),
        workConditions: ref("conventions.work_conditions"),
        agencyId: ref("conventions.agency_id"),
        agencyReferent: eb
          .case()
          .when(
            sql`conventions.agency_referent_first_name IS NULL AND conventions.agency_referent_last_name IS NULL`,
            "is",
            true,
          )
          .then(null)
          .else(
            jsonBuildObject({
              firstname: ref("conventions.agency_referent_first_name"),
              lastname: ref("conventions.agency_referent_last_name"),
            }),
          )
          .end(),
        individualProtection: ref("conventions.individual_protection"),
        individualProtectionDescription: ref(
          "conventions.individual_protection_description",
        ),
        sanitaryPrevention: ref("conventions.sanitary_prevention"),
        sanitaryPreventionDescription: ref(
          "conventions.sanitary_prevention_description",
        ),
        remoteWorkMode: ref("conventions.remote_work_mode"),
        immersionAddress: ref("conventions.immersion_address"),
        immersionObjective: ref("conventions.immersion_objective"),
        immersionAppellation: jsonBuildObject({
          appellationCode: sql<AppellationCode>`vad.appellation_code::text`,
          appellationLabel: cast<AppellationLabel>(
            ref("vad.appellation_label"),
          ),
          romeCode: cast<RomeCode>(ref("vad.rome_code")),
          romeLabel: cast<RomeLabel>(ref("vad.rome_label")),
        }),
        immersionActivities: ref("conventions.immersion_activities"),
        immersionSkills: ref("conventions.immersion_skills"),
        internshipKind: ref("conventions.internship_kind"),
        businessAdvantages: ref("conventions.business_advantages"),
        statusJustification: ref("conventions.status_justification"),
        establishmentNumberEmployeesRange: ref(
          "conventions.establishment_number_employees",
        ),
        establishmentTutor: jsonBuildObject({
          role: sql<"establishment-tutor">`'establishment-tutor'`,
          firstName: ref("et.first_name"),
          lastName: ref("et.last_name"),
          email: cast<Email>(ref("et.email")),
          phone: sql`phone_numbers_et.phone_number`,
          job: sql`et.extra_fields ->> 'job'`.$castTo<string>(),
        }),
        validators: ref("conventions.validators"),
        isEstablishmentBanned: eb
          .case()
          .when("banned_establishments.siret", "is not", null)
          .then(sql`true`)
          .else(sql`false`)
          .end(),
        establishmentBannishmentJustification: eb
          .case()
          .when("banned_establishments.siret", "is not", null)
          .then(ref("banned_establishments.bannishment_justification"))
          .else(null)
          .end(),
        fromConventionDraftId: ref("from_convention_draft_id"),
        renewed: eb
          .case()
          .when("renewed_from", "is not", null)
          .then(
            jsonStripNulls(
              jsonBuildObject({
                from: ref("renewed_from").$castTo<string>(),
                justification: ref("renewed_justification").$castTo<string>(),
              }),
            ),
          )
          .else(null)
          .end(),
      }),
    ).as("dto"),
  );
};

const withActorJoins = <QB extends SelectQueryBuilder<Database, any, any>>(
  builder: QB,
): QB =>
  builder
    .innerJoin("actors as b", "b.id", "conventions.beneficiary_id")
    .innerJoin(
      "actors as er",
      "er.id",
      "conventions.establishment_representative_id",
    )
    .innerJoin("actors as et", "et.id", "conventions.establishment_tutor_id")
    .leftJoin(
      "actors as br",
      "br.id",
      "conventions.beneficiary_representative_id",
    )
    .leftJoin(
      "actors as bce",
      "bce.id",
      "conventions.beneficiary_current_employer_id",
    ) as QB;

const withAppellationsAndPartnerPeJoinAndPhoneNumber = <
  QB extends SelectQueryBuilder<Database, any, any>,
>(
  builder: QB,
): QB =>
  builder
    .leftJoin(
      "conventions__ft_connect_users as cftu",
      "cftu.convention_id",
      "conventions.id",
    )
    .leftJoin(
      "ft_connect_users as ftu",
      "ftu.ft_connect_id",
      "cftu.ft_connect_id",
    )
    .leftJoin(
      "view_appellations_dto as vad",
      "vad.appellation_code",
      "conventions.immersion_appellation",
    )
    .leftJoin("phone_numbers", "phone_numbers.id", "b.phone_id")
    .leftJoin(
      "phone_numbers as phone_numbers_b_emergency_phone",
      "phone_numbers_b_emergency_phone.id",
      "b.emergency_contact_phone_id",
    )
    .leftJoin(
      "phone_numbers as phone_numbers_er",
      "phone_numbers_er.id",
      "er.phone_id",
    )
    .leftJoin(
      "phone_numbers as phone_numbers_et",
      "phone_numbers_et.id",
      "et.phone_id",
    )
    .leftJoin(
      "phone_numbers as phone_numbers_br",
      "phone_numbers_br.id",
      "br.phone_id",
    )
    .leftJoin(
      "phone_numbers as phone_numbers_bce",
      "phone_numbers_bce.id",
      "bce.phone_id",
    )
    .leftJoin(
      "banned_establishments",
      "banned_establishments.siret",
      "conventions.siret",
    ) as QB;

export const createConventionQueryBuilder = (
  transaction: KyselyDb,
  withAgencyJoin: boolean,
): ConventionQueryBuilder =>
  createConventionSelection(
    withAppellationsAndPartnerPeJoinAndPhoneNumber(
      withActorJoins(transaction.selectFrom("conventions")),
    ),
  ).$if(withAgencyJoin, (qb) =>
    qb.leftJoin("agencies", "agencies.id", "conventions.agency_id"),
  );

export const createPaginatedConventionsBaseBuilder = ({
  transaction,
}: {
  transaction: KyselyDb;
}): ConventionBaseQueryBuilder =>
  withActorJoins(transaction.selectFrom("conventions"));

export const wrapInMaterializedCteWithEnrichment = ({
  transaction,
  filteredBuilder,
}: {
  transaction: KyselyDb;
  filteredBuilder: SelectQueryBuilder<any, any, any>;
}): ConventionQueryBuilder =>
  pipeWithValue(
    transaction
      .with(
        (cte) => cte("user_conventions").materialized(),
        () => filteredBuilder.selectAll("conventions"),
      )
      .selectFrom("user_conventions as conventions"),
    withActorJoins,
    withAppellationsAndPartnerPeJoinAndPhoneNumber,
    createConventionSelection,
  );

const createBroadcastFeedbackBaseBuilder = ({
  transaction,
  userAgencyIds,
  conventionSubmittedAfter,
}: {
  transaction: KyselyDb;
  userAgencyIds: AgencyId[];
  conventionSubmittedAfter?: Date;
}) => {
  const cteBuilder = transaction.with(
    "conventions_with_latest_feedback",
    (qb) => {
      let query = qb
        .selectFrom("conventions as c")
        .innerJoin(
          "actors as beneficiary",
          "beneficiary.id",
          "c.beneficiary_id",
        )
        .innerJoin("actors as er", "er.id", "c.establishment_representative_id")
        .leftJoin("actors as br", "br.id", "c.beneficiary_representative_id")
        .innerJoin("actors as et", "et.id", "c.establishment_tutor_id")
        .leftJoin(
          "actors as bce",
          "bce.id",
          "c.beneficiary_current_employer_id",
        )
        .innerJoin("broadcast_feedbacks as bf", "bf.convention_id", "c.id")
        .select((eb) => [
          eb.ref("c.id").as("conventionId"),
          eb.ref("c.agency_id").as("agencyId"),
          eb.ref("c.status").as("status"),
          eb.ref("c.business_name").as("businessName"),
          eb.ref("c.siret").as("siret"),
          eb.ref("c.agency_referent_first_name").as("agencyReferentFirstName"),
          eb.ref("c.agency_referent_last_name").as("agencyReferentLastName"),
          eb.ref("beneficiary.first_name").as("bFirstName"),
          eb.ref("beneficiary.last_name").as("bLastName"),
          eb.ref("beneficiary.email").as("bEmail"),
          eb.ref("er.email").as("erEmail"),
          eb.ref("et.email").as("etEmail"),
          eb.ref("br.email").as("brEmail"),
          eb.ref("bce.email").as("bceEmail"),
          eb.ref("bf.consumer_id").as("consumerId"),
          eb.ref("bf.consumer_name").as("consumerName"),
          eb.ref("bf.service_name").as("serviceName"),
          eb.ref("bf.subscriber_error_feedback").as("subscriberErrorFeedback"),
          eb.ref("bf.request_params").as("requestParams"),
          sql<DateTimeIsoString>`date_to_iso(bf.occurred_at)`.as("occurredAt"),
          eb.ref("bf.handled_by_agency").as("handledByAgency"),
          eb.ref("bf.response").as("response"),
          eb.ref("c.date_submission").as("dateSubmission"),
        ])
        .where("c.agency_id", "in", userAgencyIds)
        .distinctOn("c.id")
        .orderBy("c.id")
        .orderBy("bf.occurred_at", "desc");

      if (conventionSubmittedAfter)
        query = query.where(
          "c.date_submission",
          ">=",
          conventionSubmittedAfter,
        );

      return query;
    },
  );

  return cteBuilder.selectFrom("conventions_with_latest_feedback as cf");
};

export const createConventionsWithErroredBroadcastFeedbackBuilder = ({
  transaction,
  userAgencyIds,
  conventionSubmittedAfter,
}: {
  transaction: KyselyDb;
  userAgencyIds: AgencyId[];
  conventionSubmittedAfter?: Date;
}) =>
  createBroadcastFeedbackBaseBuilder({
    transaction,
    userAgencyIds,
    conventionSubmittedAfter,
  }).selectAll();

export const createBroadcastFeedbackCountBuilder = ({
  transaction,
  userAgencyIds,
  conventionSubmittedAfter,
}: {
  transaction: KyselyDb;
  userAgencyIds: AgencyId[];
  conventionSubmittedAfter?: Date;
}) =>
  createBroadcastFeedbackBaseBuilder({
    transaction,
    userAgencyIds,
    conventionSubmittedAfter,
  }).select((eb) => sql<number>`CAST(${eb.fn.countAll()} AS INT)`.as("count"));

export const getConventionDtoById = async (
  transaction: KyselyDb,
  conventionId: ConventionId,
): Promise<ConventionDto | undefined> => {
  const pgConvention = await createConventionQueryBuilder(transaction, false)
    .where("conventions.id", "=", conventionId)
    .executeTakeFirst();

  if (!pgConvention) return;

  return validateAndParseZodSchema({
    schemaName: "conventionSchema",
    inputSchema: conventionSchema,
    schemaParsingInput: pgConvention.dto,
    id: pgConvention.dto.id,
    logger: createLogger(__filename),
  });
};

export const makeGetLastConventionWithSiretInList =
  (sirets: [SiretDto, ...SiretDto[]]) =>
  (builder: Awaited<ReturnType<typeof createConventionQueryBuilder>>) =>
    builder
      .select(
        sql<string>`row_number() OVER (PARTITION BY conventions.siret ORDER BY conventions.date_validation DESC)`.as(
          "rn",
        ),
      )
      .where("conventions.status", "=", "ACCEPTED_BY_VALIDATOR")
      .where("conventions.siret", "in", sirets);
