import type { ArchivedConventionRequestId } from "shared";
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
    const commonValues = {
      id: archivedConventionRequest.id,
      user_id: archivedConventionRequest.userId,
      created_at: new Date(archivedConventionRequest.createdAt),
      reason: archivedConventionRequest.reason,
      other_reason: archivedConventionRequest.otherReason,
    };

    if (
      archivedConventionRequest.conventionSearchMethod === "withConventionId"
    ) {
      await this.transaction
        .insertInto("archived_convention_requests")
        .values({
          ...commonValues,
          convention_id: archivedConventionRequest.conventionId,
        })
        .execute();
      return;
    }

    await this.transaction
      .insertInto("archived_convention_requests")
      .values({
        ...commonValues,
        beneficiary_first_name: archivedConventionRequest.beneficiaryFirstName,
        beneficiary_last_name: archivedConventionRequest.beneficiaryLastName,
        siret: archivedConventionRequest.siret,
        immersion_date: archivedConventionRequest.immersionDate,
        immersion_appellation_code: Number.parseInt(
          archivedConventionRequest.immersionAppellationCode,
          10,
        ),
      })
      .execute();
  }
}
