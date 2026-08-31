import type { KyselyDb } from "../../../../config/pg/kysely/kyselyUtils";
import { toArchivedConventionRequestToReviewListItem } from "../../entities/ArchivedConventionRequestEntity";
import type {
  ArchivedConventionRequestQueries,
  ArchivedConventionRequestToReviewListItem,
} from "../../ports/ArchivedConventionRequestQueries";

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
        results.map(toArchivedConventionRequestToReviewListItem),
      );
  }
}
