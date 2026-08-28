import type {
  ArchivedConventionRequestId,
  ArchivedConventionRequestStatus,
  DateString,
} from "shared";
import type { KyselyDb } from "../../../../config/pg/kysely/kyselyUtils";
import {
  type ArchivedConventionRequestEntity,
  toArchivedConventionRequestEntity,
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
