import type {
  AbsoluteUrl,
  AgencyRefersToInConvention,
  ConventionReadDto,
  PartnerAgencyKind,
  SubscriberErrorFeedback,
  SubscriptionParams,
} from "shared";

export type ConventionUpdatedSubscriptionCallbackBody = {
  payload: {
    convention: Omit<ConventionReadDto, "agencyKind" | "agencyRefersTo"> & {
      agencyKind: PartnerAgencyKind;
      agencyRefersTo?: Omit<AgencyRefersToInConvention, "kind"> & {
        kind: PartnerAgencyKind;
      };
    };
  };
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
