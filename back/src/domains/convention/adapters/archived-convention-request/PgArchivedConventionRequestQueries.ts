import type { KyselyDb } from "../../../../config/pg/kysely/kyselyUtils";
import type { ArchivedConventionRequestEntity } from "../../entities/ArchivedConventionRequestEntity";
import type {
  ArchivedConventionRequestQueries,
  ArchivedConventionRequestToReviewListItem,
} from "../../ports/ArchivedConventionRequestQueries";
import { toArchivedConventionRequestEntity } from "./PgArchivedConventionRequestRepository";

export class PgArchivedConventionRequestQueries
  implements ArchivedConventionRequestQueries
{
  constructor(private readonly transaction: KyselyDb) {}

  public async getFirstOldestArchivedConventionRequestToReviewList(): Promise<
    ArchivedConventionRequestToReviewListItem[]
  > {
    return this.transaction
      .selectFrom("archived_convention_requests")
      .selectAll()
      .where("status", "=", "PENDING")
      .orderBy("created_at", "asc")
      .limit(100)
      .execute()
      .then((results) =>
        results
          .map(toArchivedConventionRequestEntity)
          .map(toArchivedConventionRequestToReviewListItem),
      );
  }
}

const toArchivedConventionRequestToReviewListItem = (
  request: ArchivedConventionRequestEntity,
): ArchivedConventionRequestToReviewListItem => {
  const common = {
    id: request.id,
    userId: request.userId,
    createdAt: request.createdAt,
    ...(request.reason === "other"
      ? { reason: request.reason, otherReason: request.otherReason ?? "" }
      : { reason: request.reason }),
  };

  return request.conventionSearchMethod === "withConventionId"
    ? {
        ...common,
        conventionSearchMethod: request.conventionSearchMethod,
        conventionId: request.conventionId,
      }
    : {
        ...common,
        conventionSearchMethod: request.conventionSearchMethod,
        beneficiaryFirstName: request.beneficiaryFirstName,
        beneficiaryLastName: request.beneficiaryLastName,
        siret: request.siret,
        immersionDate: request.immersionDate,
      };
};
