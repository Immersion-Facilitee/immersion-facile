import type {
  ArchivedConventionRequestId,
  ArchivedConventionRequestStatus,
  DateString,
} from "shared";
import {
  type ArchivedConventionRequestEntity,
  validateArchivedConventionRequestEntity,
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

    return validateArchivedConventionRequestEntity(request);
  }

  public async save(
    archivedConventionRequest: ArchivedConventionRequestEntity,
  ): Promise<void> {
    this.archivedConventionRequests[archivedConventionRequest.id] =
      archivedConventionRequest;
  }

  public async update(params: {
    id: ArchivedConventionRequestId;
    status: ArchivedConventionRequestStatus;
    updatedAt: DateString;
  }): Promise<void> {
    const existing = this.archivedConventionRequests[params.id];
    if (!existing) return;

    this.archivedConventionRequests[params.id] = {
      ...existing,
      status: params.status,
      updatedAt: params.updatedAt,
    };
  }
}
