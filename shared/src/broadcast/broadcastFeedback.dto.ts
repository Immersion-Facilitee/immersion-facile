import type {
  AgencyId,
  ApiConsumerId,
  ApiConsumerName,
  ConventionId,
  ConventionStatus,
  DateTimeIsoString,
} from "..";
import type { AbsoluteUrl } from "../AbsoluteUrl";

export type ConventionBroadcastRequestParams = {
  conventionId: ConventionId;
  callbackUrl?: AbsoluteUrl;
  conventionStatus?: ConventionStatus;
};
export type BroadcastFeedbackResponse = {
  httpStatus: number;
  body?: unknown;
} | null;

export type SubscriberErrorFeedback = {
  message: string;
  error?: unknown;
};

export type BroadcastFeedback = {
  serviceName: string;
  consumerId: ApiConsumerId | null;
  consumerName: ApiConsumerName;
  conventionId: ConventionId;
  agencyId: AgencyId;
  subscriberErrorFeedback?: SubscriberErrorFeedback;
  requestParams: ConventionBroadcastRequestParams;
  response?: BroadcastFeedbackResponse;
  occurredAt: DateTimeIsoString;
  handledByAgency: boolean;
};

export type ConventionLastBroadcastFeedbackResponse =
  | { lastBroadcastFeedback: null }
  | {
      lastBroadcastFeedback: BroadcastFeedback;
      shouldBeHandled: boolean;
    };
