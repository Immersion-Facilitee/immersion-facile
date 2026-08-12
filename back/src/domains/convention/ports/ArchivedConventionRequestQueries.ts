import type { ArchivedConventionRequestEntity } from "../entities/ArchivedConventionRequestEntity";

export type FirstOldestArchivedConventionRequestToReviewList = Pick<
  ArchivedConventionRequestEntity,
  "id" | "reason" | "userId" | "createdAt"
>[];

export interface ArchivedConventionRequestQueries {
  getFirstOldestArchivedConventionRequestToReviewList: () => Promise<FirstOldestArchivedConventionRequestToReviewList>;
}
