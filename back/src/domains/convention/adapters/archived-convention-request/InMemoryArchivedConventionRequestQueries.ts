import type {
  ArchivedConventionRequestQueries,
  ArchivedConventionRequestToReviewList,
} from "../../ports/ArchivedConventionRequestQueries";

export class InMemoryArchivedConventionRequestQueries
  implements ArchivedConventionRequestQueries
{
  getFirstOldestArchivedConventionRequestToReviewListNextResponse: ArchivedConventionRequestToReviewList =
    [];

  public async getFirstOldestArchivedConventionRequestToReviewList(): Promise<ArchivedConventionRequestToReviewList> {
    return this.getFirstOldestArchivedConventionRequestToReviewListNextResponse;
  }
}
