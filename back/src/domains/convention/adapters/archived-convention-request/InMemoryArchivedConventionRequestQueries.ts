import type {
  ArchivedConventionRequestQueries,
  FirstOldestArchivedConventionRequestToReviewList,
} from "../../ports/ArchivedConventionRequestQueries";

export class InMemoryArchivedConventionRequestQueries
  implements ArchivedConventionRequestQueries
{
  getFirstOldestArchivedConventionRequestToReviewListNextResponse: FirstOldestArchivedConventionRequestToReviewList =
    [];

  public async getFirstOldestArchivedConventionRequestToReviewList(): Promise<FirstOldestArchivedConventionRequestToReviewList> {
    return this.getFirstOldestArchivedConventionRequestToReviewListNextResponse;
  }
}
