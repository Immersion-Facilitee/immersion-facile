import type { BroadcastFeedback, ConventionId } from "shared";

export const broadcastToPartnersServiceName =
  "BroadcastToPartnersOnConventionUpdates";

export const broadcastToFtServiceName =
  "FranceTravailGateway.notifyOnConventionUpdatedOrAssessmentCreated";

export const broadcastToFtConsumerName = "France Travail";

export interface BroadcastFeedbacksRepository {
  save: (broadcastFeedback: BroadcastFeedback) => Promise<void>;
  markPartnersErroredConventionAsHandled: (id: ConventionId) => Promise<void>;
  getLastBroadcastFeedback: (
    id: ConventionId,
  ) => Promise<BroadcastFeedback | null>;
}
