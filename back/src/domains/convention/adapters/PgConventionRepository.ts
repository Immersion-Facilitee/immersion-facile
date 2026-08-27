import { sql } from "kysely";
import {
  type Beneficiary,
  type BeneficiaryCurrentEmployer,
  type BeneficiaryRepresentative,
  type ConventionDto,
  type ConventionId,
  type DateString,
  type EstablishmentRepresentative,
  type EstablishmentTutor,
  errors,
  type InternshipKind,
  isBeneficiaryStudent,
  isEstablishmentTutorIsEstablishmentRepresentative,
} from "shared";
import {
  falsyToNull,
  type KyselyDb,
} from "../../../config/pg/kysely/kyselyUtils";
import { getOrCreatePhoneIds } from "../../core/phone-number/adapters/pgPhoneHelper";
import type { ConventionRepository } from "../ports/ConventionRepository";
import { getConventionDtoById } from "./pgConventionSql";

export class PgConventionRepository implements ConventionRepository {
  constructor(private transaction: KyselyDb) {}

  public async deprecateConventionsWithoutDefinitiveStatusEndedSince(
    endedSince: Date,
    statusJustification: string,
    now?: DateString,
  ) {
    const result = await this.transaction
      .updateTable("conventions")
      .set({
        status: "DEPRECATED",
        status_justification: statusJustification,
        updated_at: now ?? sql`now()`,
      })
      .where("date_end", "<=", endedSince)
      .where("status", "not in", [
        "REJECTED",
        "CANCELLED",
        "DEPRECATED",
        "ACCEPTED_BY_VALIDATOR",
      ])
      .returning("id")
      .execute();

    return result.map(({ id }) => id);
  }

  public async deleteOldConventions(params: { updatedBefore: Date }) {
    const { updatedBefore } = params;
    const result = await this.transaction
      .with("conventionRenewedFrom", (qb) =>
        qb
          .selectFrom("conventions")
          .select("renewed_from")
          .where("renewed_from", "is not", null),
      )
      .deleteFrom("conventions")
      .where("updated_at", "<=", updatedBefore)
      .where("status", "in", ["DEPRECATED", "CANCELLED", "REJECTED"])
      .where("id", "not in", (eb) =>
        eb.selectFrom("conventionRenewedFrom").select("renewed_from"),
      )
      .returning("id")
      .execute();

    return result.map(({ id }) => id);
  }

  public async getById(
    conventionId: ConventionId,
  ): Promise<ConventionDto | undefined> {
    return getConventionDtoById(this.transaction, conventionId);
  }

  public async save(
    convention: ConventionDto,
    now?: DateString,
  ): Promise<void> {
    const alreadyExistingConvention = await this.getById(convention.id);
    if (alreadyExistingConvention)
      throw errors.convention.conflict({ conventionId: convention.id });

    const {
      signatories: {
        beneficiary,
        beneficiaryRepresentative,
        establishmentRepresentative,
        beneficiaryCurrentEmployer,
      },
      id: conventionId,
      status,
      agencyId,
      dateSubmission,
      dateStart,
      dateEnd,
      dateValidation,
      siret,
      businessName,
      businessNameCustomized,
      schedule,
      individualProtection,
      individualProtectionDescription,
      sanitaryPrevention,
      sanitaryPreventionDescription,
      immersionAddress,
      immersionObjective,
      immersionAppellation,
      immersionActivities,
      immersionSkills,
      workConditions,
      internshipKind,
      establishmentTutor,
      businessAdvantages,
      statusJustification,
      agencyReferent,
      renewed,
      remoteWorkMode,
      fromConventionDraftId,
    } = convention;

    // Insert signatories and remember their id
    const beneficiaryId = await this.#insertBeneficiary(beneficiary);
    const establishmentTutorId =
      await this.#insertEstablishmentTutor(establishmentTutor);

    const establishmentRepresentativeId =
      isEstablishmentTutorIsEstablishmentRepresentative(convention)
        ? establishmentTutorId
        : await this.#insertSimpleActor(establishmentRepresentative);

    const beneficiaryRepresentativeId =
      beneficiaryRepresentative &&
      (await this.#insertSimpleActor(beneficiaryRepresentative));

    const beneficiaryCurrentEmployerId =
      beneficiaryCurrentEmployer &&
      (await this.#insertBeneficiaryCurrentEmployer(
        beneficiaryCurrentEmployer,
      ));

    await this.transaction
      .insertInto("conventions")
      .values({
        id: conventionId,
        status,
        agency_id: agencyId,
        agency_referent_first_name: agencyReferent?.firstname ?? null,
        agency_referent_last_name: agencyReferent?.lastname ?? null,
        date_submission: dateSubmission,
        date_start: dateStart,
        date_end: dateEnd,
        date_validation: dateValidation,
        siret,
        business_name: businessName,
        business_name_customized: businessNameCustomized ?? null,
        schedule: sql`${JSON.stringify(schedule)}`,
        individual_protection: individualProtection,
        individual_protection_description: individualProtectionDescription,
        sanitary_prevention: sanitaryPrevention,
        sanitary_prevention_description: sanitaryPreventionDescription,
        remote_work_mode: remoteWorkMode,
        immersion_address: immersionAddress,
        immersion_objective: immersionObjective,
        immersion_appellation: sql`${immersionAppellation.appellationCode}`,
        immersion_activities: immersionActivities,
        immersion_skills: immersionSkills,
        work_conditions: workConditions,
        internship_kind: internshipKind,
        business_advantages: businessAdvantages,
        beneficiary_id: beneficiaryId,
        establishment_tutor_id: establishmentTutorId,
        establishment_representative_id: establishmentRepresentativeId,
        beneficiary_representative_id: beneficiaryRepresentativeId,
        beneficiary_current_employer_id: beneficiaryCurrentEmployerId,
        status_justification: statusJustification,
        renewed_from: renewed?.from,
        renewed_justification: renewed?.justification,
        validators: sql`${convention.validators}`,
        acquisition_campaign: convention.acquisitionCampaign,
        acquisition_keyword: convention.acquisitionKeyword,
        establishment_number_employees:
          convention.establishmentNumberEmployeesRange,
        updated_at: now ?? sql`now()`,
        from_convention_draft_id: fromConventionDraftId,
      })
      .execute();
  }

  public async update(
    convention: ConventionDto,
    now?: DateString,
  ): Promise<ConventionId | undefined> {
    const {
      signatories: {
        beneficiary,
        beneficiaryRepresentative,
        beneficiaryCurrentEmployer,
      },
      id,
      establishmentTutor,
    } = convention;

    const establishment_tutor_id = await this.#updateEstablishmentTutor(
      id,
      establishmentTutor,
    );

    const beneficiaryCurrentEmployerId =
      await this.#insertOrUpdateBeneficiaryCurrentEmployerIfExists(
        beneficiaryCurrentEmployer,
        id,
      );

    await this.#updateBeneficiary(id, beneficiary);

    const beneficiaryRepresentativeId =
      await this.#insertOrUpdateBeneficiaryRepresentativeIfExists(
        beneficiaryRepresentative,
        id,
      );

    await this.#updateConvention({
      convention,
      establishment_tutor_id,
      establishment_representative_id:
        await this.#getEstablishmentRepresentativeId({
          convention,
          establishment_tutor_id,
        }),
      beneficiary_current_employer_id: beneficiaryCurrentEmployerId,
      beneficiary_representative_id: beneficiaryRepresentativeId,
      now,
    });

    return convention.id;
  }

  async #establishmentTutorAndRepresentativeHaveSameId(
    id: ConventionId,
  ): Promise<boolean> {
    const result = await this.transaction
      .selectFrom("conventions")
      .select(["establishment_representative_id", "establishment_tutor_id"])
      .where("id", "=", id)
      .executeTakeFirst();

    if (!result) throw errors.convention.notFound({ conventionId: id });

    return (
      result.establishment_tutor_id === result.establishment_representative_id
    );
  }

  async #getBeneficiaryCurrentEmployerId(
    conventionId: ConventionId,
  ): Promise<number | null> {
    const result = await this.transaction
      .selectFrom("conventions")
      .select("beneficiary_current_employer_id")
      .where("id", "=", conventionId)
      .executeTakeFirst();

    if (!result) throw missingReturningRowError();
    return result.beneficiary_current_employer_id;
  }

  async #getBeneficiaryRepresentativeId(conventionId: ConventionId) {
    const result = await this.transaction
      .selectFrom("conventions")
      .select("beneficiary_representative_id")
      .where("id", "=", conventionId)
      .executeTakeFirst();

    if (!result) throw missingReturningRowError();
    return result.beneficiary_representative_id;
  }

  async #getEstablishmentRepresentativeId({
    convention,
    establishment_tutor_id,
  }: {
    convention: ConventionDto;
    establishment_tutor_id: number;
  }) {
    const {
      id,
      signatories: { establishmentRepresentative },
      establishmentTutor,
    } = convention;

    if (
      // Tutor and establishment representative are same person (but may have different IDs)
      isEstablishmentTutorIsEstablishmentRepresentative(convention)
    )
      return establishmentRepresentative.signedAt
        ? this.#updateEstablishmentTutor(
            id,
            establishmentTutor,
            establishmentRepresentative.signedAt,
          )
        : establishment_tutor_id;

    if (await this.#establishmentTutorAndRepresentativeHaveSameId(id)) {
      return this.#insertSimpleActor(establishmentRepresentative);
    }

    return this.#updateEstablishmentRepresentative(
      id,
      establishmentRepresentative,
    );
  }

  async #insertBeneficiary(
    beneficiary: Beneficiary<InternshipKind>,
  ): Promise<number> {
    const studentFields = getStudentFields(beneficiary);
    const phonesToResolve = [
      beneficiary.phone,
      ...(beneficiary.emergencyContactPhone
        ? [beneficiary.emergencyContactPhone]
        : []),
    ];
    const phoneIds = await getOrCreatePhoneIds(
      this.transaction,
      phonesToResolve,
    );

    const result = await this.transaction
      .insertInto("actors")
      .values({
        first_name: beneficiary.firstName,
        last_name: beneficiary.lastName,
        email: beneficiary.email,
        phone_id: phoneIds[beneficiary.phone],
        signed_at: falsyToNull(beneficiary.signedAt),
        emergency_contact_phone_id: beneficiary.emergencyContactPhone
          ? phoneIds[beneficiary.emergencyContactPhone]
          : null,
        extra_fields: sql`JSON_STRIP_NULLS(JSON_BUILD_OBJECT(
          'birthdate', ${beneficiary.birthdate}::text,
          'emergencyContact', ${beneficiary.emergencyContact}::text,
          'emergencyContactEmail', ${beneficiary.emergencyContactEmail}::text,
          'financiaryHelp', ${beneficiary.financiaryHelp}::text,
          'isRqth', ${beneficiary.isRqth}::boolean,
          'levelOfEducation', ${studentFields.levelOfEducation}::text,
          'schoolName', ${studentFields.schoolName}::text,
          'schoolPostcode', ${studentFields.schoolPostcode}::text,
          'address', ${studentFields.address}::jsonb
          ))`,
      })
      .returning("actors.id")
      .executeTakeFirst();

    if (!result) throw missingReturningRowError();
    return result.id;
  }

  async #insertBeneficiaryCurrentEmployer(
    beneficiaryCurrentEmployer: BeneficiaryCurrentEmployer,
  ) {
    const phoneId = (
      await getOrCreatePhoneIds(this.transaction, [
        beneficiaryCurrentEmployer.phone,
      ])
    )[beneficiaryCurrentEmployer.phone];

    const result = await this.transaction
      .insertInto("actors")
      .values({
        first_name: beneficiaryCurrentEmployer.firstName,
        last_name: beneficiaryCurrentEmployer.lastName,
        email: beneficiaryCurrentEmployer.email,
        phone_id: phoneId,
        signed_at: falsyToNull(beneficiaryCurrentEmployer.signedAt),
        extra_fields: sql`JSON_STRIP_NULLS(JSON_BUILD_OBJECT(
          'businessName', ${beneficiaryCurrentEmployer.businessName}::text,
          'businessSiret', ${beneficiaryCurrentEmployer.businessSiret}::text,
          'businessAddress', ${beneficiaryCurrentEmployer.businessAddress}::text,
          'job', ${beneficiaryCurrentEmployer.job}::text
          ))`,
      })
      .returning("id")
      .executeTakeFirst();

    if (!result) throw missingReturningRowError();
    return result.id;
  }

  async #insertSimpleActor(
    actor: EstablishmentRepresentative | BeneficiaryRepresentative,
  ) {
    const phoneId = (
      await getOrCreatePhoneIds(this.transaction, [actor.phone])
    )[actor.phone];

    const result = await this.transaction
      .insertInto("actors")
      .values({
        first_name: actor.firstName,
        last_name: actor.lastName,
        email: actor.email,
        phone_id: phoneId,
        signed_at: falsyToNull(actor.signedAt),
      })
      .returning("id")
      .executeTakeFirst();

    if (!result) throw missingReturningRowError();
    return result.id;
  }

  async #insertEstablishmentTutor(
    establishmentTutor: EstablishmentTutor,
  ): Promise<number> {
    const phoneId = (
      await getOrCreatePhoneIds(this.transaction, [establishmentTutor.phone])
    )[establishmentTutor.phone];

    const result = await this.transaction
      .insertInto("actors")
      .values({
        first_name: establishmentTutor.firstName,
        last_name: establishmentTutor.lastName,
        email: establishmentTutor.email,
        phone_id: phoneId,
        extra_fields: sql`JSON_STRIP_NULLS(JSON_BUILD_OBJECT('job', ${establishmentTutor.job}::text))`,
      })
      .returning("id")
      .executeTakeFirst();

    if (!result) throw missingReturningRowError();
    return result.id;
  }

  async #insertOrUpdateBeneficiaryCurrentEmployerIfExists(
    beneficiaryCurrentEmployer: BeneficiaryCurrentEmployer | undefined,
    conventionId: ConventionId,
  ): Promise<number | null> {
    if (!beneficiaryCurrentEmployer) return null;

    const beneficiaryCurrentEmployerIdInDb =
      await this.#getBeneficiaryCurrentEmployerId(conventionId);

    return beneficiaryCurrentEmployerIdInDb === null
      ? this.#insertBeneficiaryCurrentEmployer(beneficiaryCurrentEmployer)
      : this.#updateBeneficiaryCurrentEmployer(
          conventionId,
          beneficiaryCurrentEmployer,
        );
  }

  async #insertOrUpdateBeneficiaryRepresentativeIfExists(
    beneficiaryRepresentative: BeneficiaryRepresentative | undefined,
    conventionId: ConventionId,
  ): Promise<number | null> {
    if (!beneficiaryRepresentative) return null;

    const beneficiaryRepresentativeId =
      await this.#getBeneficiaryRepresentativeId(conventionId);

    return beneficiaryRepresentativeId === null
      ? this.#insertSimpleActor(beneficiaryRepresentative)
      : this.#updateBeneficiaryRepresentative(
          conventionId,
          beneficiaryRepresentative,
        );
  }

  async #updateBeneficiary(
    conventionId: ConventionId,
    beneficiary: Beneficiary<InternshipKind>,
  ) {
    const studentFields = getStudentFields(beneficiary);
    const phonesToResolve = [
      beneficiary.phone,
      ...(beneficiary.emergencyContactPhone
        ? [beneficiary.emergencyContactPhone]
        : []),
    ];
    const phoneIds = await getOrCreatePhoneIds(
      this.transaction,
      phonesToResolve,
    );

    await this.transaction
      .updateTable("actors")
      .set({
        first_name: beneficiary.firstName,
        last_name: beneficiary.lastName,
        email: beneficiary.email,
        phone_id: phoneIds[beneficiary.phone],
        signed_at: falsyToNull(beneficiary.signedAt),
        emergency_contact_phone_id: beneficiary.emergencyContactPhone
          ? phoneIds[beneficiary.emergencyContactPhone]
          : null,
        extra_fields: sql`JSON_STRIP_NULLS(JSON_BUILD_OBJECT(
          'emergencyContact', ${beneficiary.emergencyContact}::text,
          'birthdate',  ${beneficiary.birthdate}::text,
          'emergencyContactEmail',  ${beneficiary.emergencyContactEmail}::text,
          'levelOfEducation',  ${studentFields.levelOfEducation}::text,
          'financiaryHelp',  ${beneficiary.financiaryHelp}::text,
          'isRqth',  ${beneficiary.isRqth}::boolean,
          'schoolName',  ${studentFields.schoolName}::text,
          'schoolPostcode',  ${studentFields.schoolPostcode}::text,
          'address', ${studentFields.address}::jsonb
      ))`,
      })
      .from("conventions")
      .where("conventions.id", "=", conventionId)
      .where("actors.id", "=", ({ ref }) => ref("conventions.beneficiary_id"))
      .execute();
  }

  async #updateBeneficiaryCurrentEmployer(
    id: ConventionId,
    beneficiaryCurrentEmployer: BeneficiaryCurrentEmployer,
  ): Promise<number> {
    const phoneId = (
      await getOrCreatePhoneIds(this.transaction, [
        beneficiaryCurrentEmployer.phone,
      ])
    )[beneficiaryCurrentEmployer.phone];

    const result = await this.transaction
      .updateTable("actors")
      .set({
        first_name: beneficiaryCurrentEmployer.firstName,
        last_name: beneficiaryCurrentEmployer.lastName,
        email: beneficiaryCurrentEmployer.email,
        phone_id: phoneId,
        signed_at: falsyToNull(beneficiaryCurrentEmployer.signedAt),
        extra_fields: sql`JSON_STRIP_NULLS(JSON_BUILD_OBJECT(
        'businessName', ${beneficiaryCurrentEmployer.businessName}::text,
        'businessSiret', ${beneficiaryCurrentEmployer.businessSiret}::text,
        'job', ${beneficiaryCurrentEmployer.job}::text,
        'businessAddress', ${beneficiaryCurrentEmployer.businessAddress}::text
        ))`,
      })
      .from("conventions")
      .where("conventions.id", "=", id)
      .where("actors.id", "=", ({ ref }) =>
        ref("conventions.beneficiary_current_employer_id"),
      )
      .returning("actors.id")
      .executeTakeFirst();

    if (!result) throw missingReturningRowError();
    return result.id;
  }

  async #updateBeneficiaryRepresentative(
    id: ConventionId,
    beneficiaryRepresentative: BeneficiaryRepresentative,
  ) {
    const phoneId = (
      await getOrCreatePhoneIds(this.transaction, [
        beneficiaryRepresentative.phone,
      ])
    )[beneficiaryRepresentative.phone];

    const result = await this.transaction
      .updateTable("actors")
      .set({
        first_name: beneficiaryRepresentative.firstName,
        last_name: beneficiaryRepresentative.lastName,
        email: beneficiaryRepresentative.email,
        phone_id: phoneId,
        signed_at: falsyToNull(beneficiaryRepresentative.signedAt),
      })
      .from("conventions")
      .where("conventions.id", "=", id)
      .where("actors.id", "=", ({ ref }) =>
        ref("conventions.beneficiary_representative_id"),
      )
      .returning("actors.id")
      .executeTakeFirst();

    if (!result) throw missingReturningRowError();
    return result.id;
  }

  async #updateConvention({
    convention,
    establishment_tutor_id,
    establishment_representative_id,
    beneficiary_current_employer_id,
    beneficiary_representative_id,
    now,
  }: {
    convention: ConventionDto;
    establishment_tutor_id: number;
    establishment_representative_id: number;
    beneficiary_current_employer_id: number | null;
    beneficiary_representative_id: number | null;
    now?: DateString;
  }) {
    await this.transaction
      .updateTable("conventions")
      .set({
        status: convention.status,
        agency_id: convention.agencyId,
        agency_referent_first_name:
          convention.agencyReferent?.firstname ?? null,
        agency_referent_last_name: convention.agencyReferent?.lastname ?? null,
        date_submission: convention.dateSubmission,
        date_start: convention.dateStart,
        date_end: convention.dateEnd,
        date_validation: convention.dateValidation,
        date_approval: convention.dateApproval ?? null,
        siret: convention.siret,
        business_name: convention.businessName,
        business_name_customized: convention.businessNameCustomized ?? null,
        schedule: sql`${JSON.stringify(convention.schedule)}`,
        individual_protection: convention.individualProtection,
        individual_protection_description:
          convention.individualProtectionDescription,
        sanitary_prevention: convention.sanitaryPrevention,
        sanitary_prevention_description:
          convention.sanitaryPreventionDescription,
        remote_work_mode: convention.remoteWorkMode,
        immersion_address: convention.immersionAddress,
        immersion_objective: convention.immersionObjective,
        immersion_appellation: sql`${convention.immersionAppellation.appellationCode}`,
        immersion_activities: convention.immersionActivities,
        immersion_skills: convention.immersionSkills,
        work_conditions: convention.workConditions,
        status_justification: convention.statusJustification,
        updated_at: now ?? sql`now()`,
        establishment_tutor_id,
        establishment_representative_id,
        beneficiary_current_employer_id,
        beneficiary_representative_id,
        business_advantages: convention.businessAdvantages,
        validators: sql`${convention.validators}`,
        establishment_number_employees:
          convention.establishmentNumberEmployeesRange,
        from_convention_draft_id: convention.fromConventionDraftId,
      })
      .where("id", "=", convention.id)
      .execute();
  }

  async #updateEstablishmentRepresentative(
    conventionId: ConventionId,
    establishmentRepresentative: EstablishmentRepresentative,
  ): Promise<number> {
    const phoneId = (
      await getOrCreatePhoneIds(this.transaction, [
        establishmentRepresentative.phone,
      ])
    )[establishmentRepresentative.phone];

    const result = await this.transaction
      .updateTable("actors")
      .set({
        first_name: establishmentRepresentative.firstName,
        last_name: establishmentRepresentative.lastName,
        email: establishmentRepresentative.email,
        phone_id: phoneId,
        signed_at: falsyToNull(establishmentRepresentative.signedAt),
      })
      .from("conventions")
      .where("conventions.id", "=", conventionId)
      .where("actors.id", "=", ({ ref }) =>
        ref("conventions.establishment_representative_id"),
      )
      .returning("actors.id")
      .executeTakeFirst();

    if (!result) throw missingReturningRowError();
    return result.id;
  }

  async #updateEstablishmentTutor(
    conventionId: ConventionId,
    establishmentTutor: EstablishmentTutor,
    signedAt?: string, // in case establishment tutor is also establishment representative
  ): Promise<number> {
    const phoneId = (
      await getOrCreatePhoneIds(this.transaction, [establishmentTutor.phone])
    )[establishmentTutor.phone];

    const result = await this.transaction
      .updateTable("actors")
      .set({
        first_name: establishmentTutor.firstName,
        last_name: establishmentTutor.lastName,
        email: establishmentTutor.email,
        phone_id: phoneId,
        extra_fields: sql`JSON_STRIP_NULLS(JSON_BUILD_OBJECT('job', ${establishmentTutor.job}::text))`,
        signed_at: falsyToNull(signedAt),
      })
      .from("conventions")
      .where("conventions.id", "=", conventionId)
      .where("actors.id", "=", ({ ref }) =>
        ref("conventions.establishment_tutor_id"),
      )
      .returning("actors.id")
      .executeTakeFirst();

    if (result) return result.id;
    throw missingReturningRowError();
  }
}
const missingReturningRowError = (): Error =>
  new Error("Missing rows on update return");

const getStudentFields = (
  beneficiary: Beneficiary<InternshipKind>,
):
  | Pick<
      Beneficiary<"mini-stage-cci">,
      "levelOfEducation" | "schoolName" | "schoolPostcode" | "address"
    >
  | Record<string, never> =>
  isBeneficiaryStudent(beneficiary)
    ? {
        levelOfEducation: beneficiary.levelOfEducation,
        schoolPostcode: beneficiary.schoolPostcode,
        schoolName: beneficiary.schoolName,
        address: beneficiary.address,
      }
    : {};
