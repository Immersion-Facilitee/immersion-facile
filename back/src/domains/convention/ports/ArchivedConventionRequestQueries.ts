import type { ArchivedConventionRequestToReviewFields, UserId } from "shared";

export type ArchivedConventionRequestToReviewListItem =
  ArchivedConventionRequestToReviewFields & {
    userId: UserId;
  };

export interface ArchivedConventionRequestQueries {
  getFirstOldestArchivedConventionRequestToReviewList: () => Promise<
    ArchivedConventionRequestToReviewListItem[]
  >;
}
