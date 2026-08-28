import type {
  ArchivedConventionRequestId,
  ArchivedConventionRequestStatus,
  DateString,
} from "shared";
import type { ArchivedConventionRequestEntity } from "../entities/ArchivedConventionRequestEntity";

export interface ArchivedConventionRequestRepository {
  save: (
    archivedConventionRequest: ArchivedConventionRequestEntity,
  ) => Promise<void>;
  getById: (
    id: ArchivedConventionRequestId,
  ) => Promise<ArchivedConventionRequestEntity | undefined>;
  update: (params: {
    id: ArchivedConventionRequestId;
    status: ArchivedConventionRequestStatus;
    updatedAt: DateString;
  }) => Promise<void>;
}
