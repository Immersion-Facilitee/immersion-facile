import { sql } from "kysely";
import type { InsertExpression } from "kysely/dist/cjs/parser/insert-values-parser";
import {
  type AgencyKind,
  type ConventionDraftDto,
  type ConventionDraftId,
  type DateString,
  type DepartmentCode,
  type EstablishmentTutor,
  isRemoteWorkMode,
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
    await this.transaction
      .insertInto("convention_drafts")
      .values(mapToEntity(conventionDraft, now))
      .onConflict((oc) =>
        oc.column("id").doUpdateSet(({ ref }) => ({
          agency_id: ref("excluded.agency_id"),
          agency_kind: ref("excluded.agency_kind"),
          agency_department: ref("excluded.agency_department"),
          date_start: ref("excluded.date_start"),
          date_end: ref("excluded.date_end"),
          siret: ref("excluded.siret"),
          business_name: ref("excluded.business_name"),
          business_name_customized: ref("excluded.business_name_customized"),
          schedule: ref("excluded.schedule"),
          individual_protection: ref("excluded.individual_protection"),
          individual_protection_description: ref(
            "excluded.individual_protection_description",
          ),
          sanitary_prevention: ref("excluded.sanitary_prevention"),
          sanitary_prevention_description: ref(
            "excluded.sanitary_prevention_description",
          ),
          remote_work_mode: ref("excluded.remote_work_mode"),
          immersion_address: ref("excluded.immersion_address"),
          immersion_objective: ref("excluded.immersion_objective"),
          immersion_appellation: ref("excluded.immersion_appellation"),
          immersion_activities: ref("excluded.immersion_activities"),
          immersion_skills: ref("excluded.immersion_skills"),
          work_conditions: ref("excluded.work_conditions"),
          internship_kind: ref("excluded.internship_kind"),
          business_advantages: ref("excluded.business_advantages"),
          establishment_number_employees: ref(
            "excluded.establishment_number_employees",
          ),
          agency_referent_first_name: ref(
            "excluded.agency_referent_first_name",
          ),
          agency_referent_last_name: ref("excluded.agency_referent_last_name"),
          ft_connect_id: ref("excluded.ft_connect_id"),
          establishment_tutor: ref("excluded.establishment_tutor"),
          signatories: ref("excluded.signatories"),
          updated_at: ref("excluded.updated_at"),
        })),
      )
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

const mapToEntity = (
  conventionDraft: ConventionDraftDto,
  now: DateString,
): InsertExpression<Database, "convention_drafts"> => {
  return {
    id: conventionDraft.id,
    agency_id: conventionDraft.agencyId,
    agency_kind: conventionDraft.agencyKind,
    agency_department: conventionDraft.agencyDepartment,
    date_start: conventionDraft.dateStart,
    date_end: conventionDraft.dateEnd,
    siret: conventionDraft.siret,
    business_name: conventionDraft.businessName,
    business_name_customized: conventionDraft.businessNameCustomized,
    schedule: conventionDraft.schedule
      ? sql`${JSON.stringify(conventionDraft.schedule)}`
      : null,
    individual_protection: conventionDraft.individualProtection,
    individual_protection_description:
      conventionDraft.individualProtectionDescription,
    sanitary_prevention: conventionDraft.sanitaryPrevention,
    sanitary_prevention_description:
      conventionDraft.sanitaryPreventionDescription,
    remote_work_mode: conventionDraft.remoteWorkMode,
    immersion_address: conventionDraft.immersionAddress,
    immersion_objective: conventionDraft.immersionObjective,
    immersion_appellation: sql`${conventionDraft.immersionAppellation?.appellationCode}`,
    immersion_activities: conventionDraft.immersionActivities,
    immersion_skills: conventionDraft.immersionSkills,
    work_conditions: conventionDraft.workConditions,
    internship_kind: conventionDraft.internshipKind,
    business_advantages: conventionDraft.businessAdvantages,
    acquisition_campaign: conventionDraft.acquisitionCampaign,
    acquisition_keyword: conventionDraft.acquisitionKeyword,
    acquisition_medium: conventionDraft.acquisitionMedium,
    establishment_number_employees:
      conventionDraft.establishmentNumberEmployeesRange,
    agency_referent_first_name: conventionDraft.agencyReferent?.firstname,
    agency_referent_last_name: conventionDraft.agencyReferent?.lastname,
    ft_connect_id:
      conventionDraft.signatories?.beneficiary?.federatedIdentity?.provider ===
      "ftConnect"
        ? conventionDraft.signatories?.beneficiary?.federatedIdentity?.token
        : undefined,
    establishment_tutor: conventionDraft.establishmentTutor
      ? sql`${JSON.stringify(conventionDraft.establishmentTutor)}`
      : null,
    signatories: conventionDraft.signatories
      ? sql`${JSON.stringify(conventionDraft.signatories)}`
      : null,
    updated_at: now,
  };
};
