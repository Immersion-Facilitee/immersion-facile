import type {
  ArchivedConventionRequestId,
  ArchivedConventionRequestStatus,
  DateString,
} from "shared";
import type { KyselyDb } from "../../../../config/pg/kysely/kyselyUtils";
import {
  type ArchivedConventionRequestEntity,
  validateArchivedConventionRequestEntity,
} from "../../entities/ArchivedConventionRequestEntity";
import type { ArchivedConventionRequestRepository } from "../../ports/ArchivedConventionRequestRepository";

export class PgArchivedConventionRequestRepository
  implements ArchivedConventionRequestRepository
{
  constructor(private readonly transaction: KyselyDb) {}

  public async getById(
    id: ArchivedConventionRequestId,
  ): Promise<ArchivedConventionRequestEntity | undefined> {
    const row = await this.transaction
      .selectFrom("archived_convention_requests")
      .selectAll()
      .where("archived_convention_requests.id", "=", id)
      .executeTakeFirst();

    return row ? toArchivedConventionRequestEntity(row) : undefined;
  }

  public async save(
    archivedConventionRequest: ArchivedConventionRequestEntity,
  ): Promise<void> {
    await this.transaction
      .insertInto("archived_convention_requests")
      .values({
        id: archivedConventionRequest.id,
        user_id: archivedConventionRequest.userId,
        created_at: new Date(archivedConventionRequest.createdAt),
        updated_at: new Date(archivedConventionRequest.updatedAt),
        status: archivedConventionRequest.status,
        reason: archivedConventionRequest.reason,
        other_reason: archivedConventionRequest.otherReason,
        ...(archivedConventionRequest.conventionSearchMethod ===
        "withConventionId"
          ? {
              convention_id: archivedConventionRequest.conventionId,
            }
          : {
              beneficiary_first_name:
                archivedConventionRequest.beneficiaryFirstName,
              beneficiary_last_name:
                archivedConventionRequest.beneficiaryLastName,
              siret: archivedConventionRequest.siret,
              immersion_date: archivedConventionRequest.immersionDate,
              immersion_appellation_code: Number.parseInt(
                archivedConventionRequest.immersionAppellationCode,
                10,
              ),
            }),
      })
      .execute();
  }

  public async update(params: {
    id: ArchivedConventionRequestId;
    status: ArchivedConventionRequestStatus;
    updatedAt: DateString;
  }): Promise<void> {
    await this.transaction
      .updateTable("archived_convention_requests")
      .set({
        status: params.status,
        updated_at: new Date(params.updatedAt),
      })
      .where("id", "=", params.id)
      .execute();
  }
}

type ArchivedConventionRequestRow = {
  id: string;
  user_id: string;
  created_at: Date;
  updated_at: Date;
  status: ArchivedConventionRequestStatus;
  convention_id: string | null;
  beneficiary_first_name: string | null;
  beneficiary_last_name: string | null;
  siret: string | null;
  immersion_date: string | null;
  immersion_appellation_code: number | null;
  reason: string;
  other_reason: string | null;
};

export const toArchivedConventionRequestEntity = (
  row: ArchivedConventionRequestRow,
): ArchivedConventionRequestEntity => {
  const request = {
    id: row.id,
    userId: row.user_id,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    status: row.status,
    reason: row.reason,
    otherReason: row.other_reason ?? undefined,
    ...(row.convention_id
      ? {
          conventionSearchMethod: "withConventionId",
          conventionId: row.convention_id,
        }
      : {
          conventionSearchMethod: "withConventionDetails",
          beneficiaryFirstName: row.beneficiary_first_name,
          beneficiaryLastName: row.beneficiary_last_name,
          siret: row.siret,
          immersionDate: row.immersion_date,
          immersionAppellationCode: row.immersion_appellation_code?.toString(),
        }),
  };
  return validateArchivedConventionRequestEntity(request);
};
