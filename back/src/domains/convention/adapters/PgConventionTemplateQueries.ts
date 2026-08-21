import { sql } from "kysely";
import type { InsertExpression } from "kysely/dist/cjs/parser/insert-values-parser";
import {
  type ConventionTemplate,
  type ConventionTemplateId,
  type DateTimeIsoString,
  type EstablishmentTutor,
  type ImmersionObjective,
  isRemoteWorkMode,
  type NumberEmployeesRange,
  pipeWithValue,
  type ScheduleDto,
  type Signatories,
} from "shared";
import type { KyselyDb } from "../../../config/pg/kysely/kyselyUtils";
import type { Database } from "../../../config/pg/kysely/model/database";
import type {
  ConventionTemplateQueries,
  GetConventionTemplatesParams,
} from "../ports/ConventionTemplateQueries";

export class PgConventionTemplateQueries implements ConventionTemplateQueries {
  constructor(private transaction: KyselyDb) {}

  public async get(
    params: GetConventionTemplatesParams,
  ): Promise<ConventionTemplate[]> {
    const query = pipeWithValue(
      this.transaction
        .selectFrom("convention_templates")
        .leftJoin(
          "public_appellations_data",
          "public_appellations_data.ogr_appellation",
          "convention_templates.immersion_appellation",
        )
        .leftJoin(
          "public_romes_data",
          "public_romes_data.code_rome",
          "public_appellations_data.code_rome",
        )
        .selectAll("convention_templates")
        .select([
          "public_appellations_data.ogr_appellation",
          "public_appellations_data.libelle_appellation_long",
          "public_appellations_data.code_rome",
          "public_romes_data.libelle_rome",
        ])
        .where("convention_templates.siret", "not in", (eb) =>
          eb.selectFrom("banned_establishments").select("siret"),
        ),
      (qb) =>
        params.ids?.length
          ? qb.where("convention_templates.id", "in", params.ids)
          : qb,
      (qb) =>
        params.userIds?.length
          ? qb.where("convention_templates.user_id", "in", params.userIds)
          : qb,
    );

    return query.execute().then((rows) =>
      rows.map((row) => ({
        id: row.id,
        userId: row.user_id,
        name: row.name,
        updatedAt: (row.updated_at as Date).toISOString(),
        agencyId: row.agency_id ?? undefined,
        agencyKind: row.agency_kind ?? undefined,
        agencyDepartment: row.agency_department ?? undefined,
        dateStart: row.date_start?.toISOString() ?? undefined,
        dateEnd: row.date_end?.toISOString() ?? undefined,
        siret: row.siret ?? undefined,
        businessName: row.business_name ?? undefined,
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
        immersionObjective: (row.immersion_objective ?? undefined) as
          | ImmersionObjective
          | undefined,
        immersionAppellation: row.ogr_appellation
          ? {
              appellationCode: row.ogr_appellation.toString(),
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
        establishmentNumberEmployeesRange:
          (row.establishment_number_employees ?? undefined) as
            | NumberEmployeesRange
            | undefined,
        agencyReferent:
          row.agency_referent_first_name || row.agency_referent_last_name
            ? {
                firstname: row.agency_referent_first_name ?? undefined,
                lastname: row.agency_referent_last_name ?? undefined,
              }
            : undefined,
        establishmentTutor:
          (row.establishment_tutor as EstablishmentTutor) ?? undefined,
        signatories: (row.signatories as Signatories) ?? undefined,
      })),
    );
  }

  public async upsert(
    conventionTemplate: ConventionTemplate,
    now: DateTimeIsoString,
  ): Promise<void> {
    const values = mapConventionTemplateToEntity(conventionTemplate, now);
    const { id: _id, ...valuesForUpdate } = values as Omit<
      typeof values,
      "id"
    > & { id: ConventionTemplateId };

    await this.transaction
      .insertInto("convention_templates")
      .values(values)
      .onConflict((oc) => oc.column("id").doUpdateSet(valuesForUpdate))
      .execute();
  }

  public async delete(
    conventionTemplateId: ConventionTemplateId,
  ): Promise<ConventionTemplateId | null> {
    const response = await this.transaction
      .deleteFrom("convention_templates")
      .where("id", "=", conventionTemplateId)
      .returning("id")
      .executeTakeFirst();

    return response?.id ?? null;
  }
}

const mapConventionTemplateToEntity = (
  template: ConventionTemplate,
  now: DateTimeIsoString,
): InsertExpression<Database, "convention_templates"> => ({
  id: template.id,
  user_id: template.userId,
  name: template.name,
  updated_at: now,
  agency_id: template.agencyId,
  agency_kind: template.agencyKind,
  agency_department: template.agencyDepartment,
  date_start: template.dateStart,
  date_end: template.dateEnd,
  siret: template.siret,
  business_name: template.businessName,
  schedule: template.schedule
    ? sql`${JSON.stringify(template.schedule)}`
    : null,
  individual_protection: template.individualProtection,
  individual_protection_description: template.individualProtectionDescription,
  sanitary_prevention: template.sanitaryPrevention,
  sanitary_prevention_description: template.sanitaryPreventionDescription,
  remote_work_mode: template.remoteWorkMode,
  immersion_address: template.immersionAddress,
  immersion_objective: template.immersionObjective,
  immersion_appellation: sql`${template.immersionAppellation?.appellationCode}`,
  immersion_activities: template.immersionActivities,
  immersion_skills: template.immersionSkills,
  work_conditions: template.workConditions ?? null,
  internship_kind: template.internshipKind,
  business_advantages: template.businessAdvantages ?? null,
  establishment_number_employees:
    template.establishmentNumberEmployeesRange ?? null,
  agency_referent_first_name: template.agencyReferent?.firstname ?? null,
  agency_referent_last_name: template.agencyReferent?.lastname ?? null,
  establishment_tutor: template.establishmentTutor
    ? sql`${JSON.stringify(template.establishmentTutor)}`
    : null,
  signatories: template.signatories
    ? sql`${JSON.stringify(template.signatories)}`
    : null,
});
