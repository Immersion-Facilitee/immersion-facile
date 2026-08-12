import type { ArchivedConventionRequestId } from "shared";
import {
  type ArchivedConventionRequestEntity,
  toArchivedConventionRequestEntity,
} from "../../entities/ArchivedConventionRequestEntity";
import type { ArchivedConventionRequestRepository } from "../../ports/ArchivedConventionRequestRepository";

export class InMemoryArchivedConventionRequestRepository
  implements ArchivedConventionRequestRepository
{
  public archivedConventionRequests: Record<
    ArchivedConventionRequestId,
    ArchivedConventionRequestEntity
  > = {};

  public async getById(
    id: ArchivedConventionRequestId,
  ): Promise<ArchivedConventionRequestEntity | undefined> {
    const request = this.archivedConventionRequests[id];
    if (!request) return undefined;

    return toArchivedConventionRequestEntity({
      id: request.id,
      user_id: request.userId,
      created_at: new Date(request.createdAt),
      ...(request.conventionSearchMethod === "withConventionDetails"
        ? {
            convention_id: null,
            beneficiary_first_name: request.beneficiaryFirstName ?? null,
            beneficiary_last_name: request.beneficiaryLastName ?? null,
            siret: request.siret ?? null,
            immersion_date: request.immersionDate ?? null,
            immersion_appellation_code: request.immersionAppellationCode
              ? Number.parseInt(request.immersionAppellationCode, 10)
              : null,
          }
        : {
            convention_id: request.conventionId,
            beneficiary_first_name: null,
            beneficiary_last_name: null,
            siret: null,
            immersion_date: null,
            immersion_appellation_code: null,
          }),
      reason: request.reason,
      other_reason: request.otherReason ?? null,
    });
  }

  public async save(
    archivedConventionRequest: ArchivedConventionRequestEntity,
  ): Promise<void> {
    this.archivedConventionRequests[archivedConventionRequest.id] =
      archivedConventionRequest;
  }
}
