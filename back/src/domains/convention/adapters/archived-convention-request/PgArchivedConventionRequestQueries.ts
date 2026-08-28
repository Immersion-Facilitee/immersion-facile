import { archivedConventionRequestReasonSchema } from "shared";
import type { KyselyDb } from "../../../../config/pg/kysely/kyselyUtils";
import type {
  ArchivedConventionRequestQueries,
  ArchivedConventionRequestToReviewList,
} from "../../ports/ArchivedConventionRequestQueries";

export class PgArchivedConventionRequestQueries
  implements ArchivedConventionRequestQueries
{
  constructor(private readonly transaction: KyselyDb) {}

  public async getFirstOldestArchivedConventionRequestToReviewList(): Promise<ArchivedConventionRequestToReviewList> {
    return this.transaction
      .selectFrom("archived_convention_requests")
      .select(["id", "reason", "user_id", "created_at"])
      .where("status", "=", "PENDING")
      .orderBy("created_at", "asc")
      .limit(100)
      .execute()
      .then((results) =>
        results.map(({ id, reason, created_at, user_id: userId }) => ({
          id,
          reason: archivedConventionRequestReasonSchema.parse(reason),
          userId,
          createdAt: created_at.toISOString(),
        })),
      );
  }
}
