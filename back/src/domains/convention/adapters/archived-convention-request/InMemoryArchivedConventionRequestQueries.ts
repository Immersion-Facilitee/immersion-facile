import type {
  ArchivedConventionRequestQueries,
  ArchivedConventionRequestToReviewListItem,
} from "../../ports/ArchivedConventionRequestQueries";

export class InMemoryArchivedConventionRequestQueries
  implements ArchivedConventionRequestQueries
{
  getFirstOldestArchivedConventionRequestToReviewListNextResponse: ArchivedConventionRequestToReviewListItem[] =
    [];

  public async getFirstOldestArchivedConventionRequestToReviewList(): Promise<ArchivedConventionRequestToReviewListItem[]> {
    return this.getFirstOldestArchivedConventionRequestToReviewListNextResponse;
  }
}
