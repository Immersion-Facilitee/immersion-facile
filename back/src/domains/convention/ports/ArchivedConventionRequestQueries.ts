import type { ArchivedConventionRequestEntity } from "../entities/ArchivedConventionRequestEntity";

export type ArchivedConventionRequestToReviewList = Pick<
  ArchivedConventionRequestEntity,
  "id" | "reason" | "userId" | "createdAt"
>[];

export interface ArchivedConventionRequestQueries {
  getFirstOldestArchivedConventionRequestToReviewList: () => Promise<ArchivedConventionRequestToReviewList>;
}
