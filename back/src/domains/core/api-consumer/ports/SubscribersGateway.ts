import type {
  AbsoluteUrl,
  SubscriberErrorFeedback,
  SubscriptionParams,
} from "shared";
import type { BroadcastPayload } from "../../../convention/use-cases/broadcast/broadcastConvention.dto";

export type ConventionUpdatedSubscriptionCallbackBody = {
  payload: BroadcastPayload;
  subscribedEvent: "convention.updated";
};

type NotifyResponseCommon = {
  callbackUrl: AbsoluteUrl;
  status: number | undefined;
  body: unknown;
};

type NotifyResponseError = NotifyResponseCommon & {
  title: "Partner subscription errored";
  subscriberErrorFeedback: SubscriberErrorFeedback;
};

type NotifyResponseSuccess = NotifyResponseCommon & {
  title: "Partner subscription notified successfully";
};

export type SubscriberResponse = NotifyResponseError | NotifyResponseSuccess;

export interface SubscribersGateway {
  notify: (
    body: ConventionUpdatedSubscriptionCallbackBody,
    subscriptionParams: SubscriptionParams,
  ) => Promise<SubscriberResponse>;
}
