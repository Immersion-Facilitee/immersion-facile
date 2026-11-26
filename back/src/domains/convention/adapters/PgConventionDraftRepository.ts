import { type InsertObject, sql } from "kysely";
import {
  type AgencyKind,
  type ConventionDraftDto,
  type ConventionDraftId,
  type DateString,
  type DepartmentCode,
  type EstablishmentTutor,
  isRemoteWorkMode,
  type OmitFromExistingKeys,
  pipeWithValue,
  type ScheduleDto,
  type Signatories,
} from "shared";
import type { KyselyDb } from "../../../config/pg/kysely/kyselyUtils";
import type { Database } from "../../../config/pg/kysely/model/database";
import type {
  ConventionDraftRepository,
  GetConventionDraftFilters,
} from "../ports/ConventionDraftRepository";

export class PgConventionDraftRepository implements ConventionDraftRepository {
  constructor(private transaction: KyselyDb) {}

  public async getById(
    id: ConventionDraftId,
  ): Promise<ConventionDraftDto | undefined> {
    const row = await this.transaction
      .selectFrom("convention_drafts")
      .leftJoin(
        "public_appellations_data",
        "public_appellations_data.ogr_appellation",
        "convention_drafts.immersion_appellation",
      )
      .leftJoin(
        "public_romes_data",
        "public_romes_data.code_rome",
        "public_appellations_data.code_rome",
      )
      .selectAll("convention_drafts")
      .select([
        "public_appellations_data.ogr_appellation",
        "public_appellations_data.libelle_appellation_long",
        "public_appellations_data.code_rome",
        "public_romes_data.libelle_rome",
      ])
      .where("convention_drafts.id", "=", id)
      .executeTakeFirst();

    if (!row) return undefined;

    return {
      id: row.id,
      updatedAt: row.updated_at
        ? (row.updated_at as Date).toISOString()
        : undefined,
      agencyId: row.agency_id ?? undefined,
      agencyKind: (row.agency_kind as AgencyKind) ?? undefined,
      agencyDepartment: (row.agency_department as DepartmentCode) ?? undefined,
      dateStart: row.date_start?.toISOString() ?? undefined,
      dateEnd: row.date_end?.toISOString() ?? undefined,
      siret: row.siret ?? undefined,
      businessName: row.business_name ?? undefined,
      businessNameCustomized: row.business_name_customized ?? undefined,
      schedule: (row.schedule as ScheduleDto) ?? undefined,
      individualProtection: row.individual_protection ?? undefined,
      individualProtectionDescription:
        row.individual_protection_description ?? undefined,
      sanitaryPrevention: row.sanitary_prevention ?? undefined,
      sanitaryPreventionDescription:
        row.sanitary_prevention_description ?? undefined,
      remoteWorkMode:
        row.remote_work_mode && isRemoteWorkMode(row.remote_work_mode)
          ? row.remote_work_mode
          : undefined,
      immersionAddress: row.immersion_address ?? undefined,
      immersionObjective: row.immersion_objective ?? undefined,
      immersionAppellation: row.ogr_appellation
        ? {
            appellationCode: String(row.ogr_appellation),
            appellationLabel: row.libelle_appellation_long ?? "",
            romeCode: row.code_rome ?? "",
            romeLabel: row.libelle_rome ?? "",
          }
        : undefined,
      immersionActivities: row.immersion_activities ?? undefined,
      immersionSkills: row.immersion_skills ?? undefined,
      workConditions: row.work_conditions ?? undefined,
      internshipKind: row.internship_kind,
      businessAdvantages: row.business_advantages ?? undefined,
      acquisitionCampaign: row.acquisition_campaign ?? undefined,
      acquisitionKeyword: row.acquisition_keyword ?? undefined,
      acquisitionMedium: row.acquisition_medium ?? undefined,
      establishmentNumberEmployeesRange:
        row.establishment_number_employees ?? undefined,
      agencyReferent:
        row.agency_referent_first_name || row.agency_referent_last_name
          ? {
              firstname: row.agency_referent_first_name ?? undefined,
              lastname: row.agency_referent_last_name ?? undefined,
            }
          : undefined,
      fromFtConnectedUser: row.ft_connect_id ? true : undefined,
      establishmentTutor:
        (row.establishment_tutor as EstablishmentTutor) ?? undefined,
      signatories: (row.signatories as Signatories) ?? undefined,
    };
  }

  public async getConventionDraftIdsByFilters(
    filters: GetConventionDraftFilters,
  ): Promise<ConventionDraftId[]> {
    const { ids, lastUpdatedAt } = filters;

    const conventionDraftIds: {
      id: string;
    }[] = await pipeWithValue(
      this.transaction
        .selectFrom("convention_drafts")
        .select("convention_drafts.id"),
      (qb) => (ids ? qb.where("convention_drafts.id", "in", ids) : qb),
      (qb) =>
        lastUpdatedAt
          ? qb.where("convention_drafts.updated_at", "<=", lastUpdatedAt)
          : qb,
    ).execute();

    return conventionDraftIds.map(({ id }) => id);
  }

  public async save(
    conventionDraft: ConventionDraftDto,
    now: DateString,
  ): Promise<void> {
    const values = mapConventionDraftToEntity(conventionDraft, now);
    const {
      id: _id,
      acquisition_campaign: _acquisitionCampaign,
      acquisition_keyword: _acquisitionKeyword,
      acquisition_medium: _acquisitionMedium,
      ...valuesForUpdate
    } = values;

    await this.transaction
      .insertInto("convention_drafts")
      .values(values)
      .onConflict((oc) => oc.column("id").doUpdateSet(valuesForUpdate))
      .execute();
  }

  public async delete(ids: ConventionDraftId[]): Promise<void> {
    if (ids.length === 0) return;
    await this.transaction
      .deleteFrom("convention_drafts")
      .where("id", "in", ids)
      .execute();
  }
}

type ConventionDraftKeysNotPersisted =
  | "updatedAt"
  | "fromFtConnectedUser"
  | "agencyContactEmail"
  | "agencyRefersTo"
  | "assessment"
  | "dateApproval"
  | "dateSubmission"
  | "dateValidation"
  | "fromConventionDraftId"
  | "isEstablishmentBanned"
  | "lastReminders"
  | "renewed"
  | "sourceConventionDraftId"
  | "status"
  | "statusJustification"
  | "validators";

type ConventionDraftFieldsToPersist = OmitFromExistingKeys<
  ConventionDraftDto,
  ConventionDraftKeysNotPersisted
>;

const mapConventionDraftToEntity = (
  conventionDraft: ConventionDraftFieldsToPersist,
  now: DateString,
) => {
  const {
    id,
    agencyId,
    agencyKind,
    agencyDepartment,
    dateStart,
    dateEnd,
    siret,
    businessName,
    businessNameCustomized,
    schedule,
    individualProtection,
    individualProtectionDescription,
    sanitaryPrevention,
    sanitaryPreventionDescription,
    remoteWorkMode,
    immersionAddress,
    immersionObjective,
    immersionAppellation,
    immersionActivities,
    immersionSkills,
    workConditions,
    internshipKind,
    businessAdvantages,
    acquisitionCampaign,
    acquisitionKeyword,
    acquisitionMedium,
    establishmentNumberEmployeesRange,
    agencyReferent,
    establishmentTutor,
    signatories,
    ...rest
  } = conventionDraft;
  rest satisfies Record<string, never>;

  return {
    id,
    agency_id: agencyId,
    agency_kind: agencyKind,
    agency_department: agencyDepartment,
    date_start: dateStart,
    date_end: dateEnd,
    siret,
    business_name: businessName,
    business_name_customized: businessNameCustomized,
    schedule: schedule ? sql`${JSON.stringify(schedule)}` : null,
    individual_protection: individualProtection,
    individual_protection_description: individualProtectionDescription,
    sanitary_prevention: sanitaryPrevention,
    sanitary_prevention_description: sanitaryPreventionDescription,
    remote_work_mode: remoteWorkMode,
    immersion_address: immersionAddress,
    immersion_objective: immersionObjective,
    immersion_appellation: sql`${immersionAppellation?.appellationCode}`,
    immersion_activities: immersionActivities,
    immersion_skills: immersionSkills,
    work_conditions: workConditions,
    internship_kind: internshipKind,
    business_advantages: businessAdvantages,
    acquisition_campaign: acquisitionCampaign,
    acquisition_keyword: acquisitionKeyword,
    acquisition_medium: acquisitionMedium,
    establishment_number_employees: establishmentNumberEmployeesRange,
    agency_referent_first_name: agencyReferent?.firstname,
    agency_referent_last_name: agencyReferent?.lastname,
    ft_connect_id:
      signatories?.beneficiary?.federatedIdentity?.provider === "ftConnect"
        ? signatories?.beneficiary?.federatedIdentity?.token
        : undefined,
    establishment_tutor: establishmentTutor
      ? sql`${JSON.stringify(establishmentTutor)}`
      : null,
    signatories: signatories ? sql`${JSON.stringify(signatories)}` : null,
    updated_at: now,
  } satisfies InsertObject<Database, "convention_drafts">;
};
