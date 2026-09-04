import type { ConventionLastBroadcastFeedbackResponse } from "shared";

export const shouldShowPartnersBroadcastError = ({
  isBackofficeAdmin,
  lastBroadcastFeedback,
}: {
  isBackofficeAdmin: boolean;
  lastBroadcastFeedback: ConventionLastBroadcastFeedbackResponse;
}): boolean => {
  const hasSubscriberErrorFeedback =
    !!lastBroadcastFeedback.broadcastFeedback?.subscriberErrorFeedback;
  const shouldBeHandled =
    lastBroadcastFeedback.broadcastFeedback === null
      ? false
      : lastBroadcastFeedback.shouldBeHandled;

  return hasSubscriberErrorFeedback && (isBackofficeAdmin || shouldBeHandled);
};
