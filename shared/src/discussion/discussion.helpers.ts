import { subDays } from "date-fns";
import { match } from "ts-pattern";
import { emailReplySeparator } from "../email/email.content";
import type { ContactMode } from "../formEstablishment/FormEstablishment.dto";
import type { DateString } from "../utils/date";
import type {
  DiscussionDisplayStatus,
  DiscussionFollowUp,
  DiscussionInList,
  ExchangeRead,
  ExchangeRole,
} from "./discussion.dto";

export const getLastExchange = (
  exchanges: ExchangeRead[],
): ExchangeRead | undefined =>
  [...exchanges].sort(
    (a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime(),
  )[exchanges.length - 1];

export const shouldEstablishmentBeReminded = ({
  lastExchangeSender,
  discussionUpdatedAt,
  contactMode,
  isEstablishmentReachableByPhoneAfter15Days,
}: {
  lastExchangeSender: ExchangeRole | undefined;
  discussionUpdatedAt: DateString;
  contactMode: ContactMode;
  isEstablishmentReachableByPhoneAfter15Days: boolean;
}): boolean => {
  return (
    lastExchangeSender === "potentialBeneficiary" &&
    new Date(discussionUpdatedAt) < subDays(Date.now(), 15) &&
    contactMode === "EMAIL" &&
    isEstablishmentReachableByPhoneAfter15Days
  );
};

export const getDiscussionDisplayStatus = ({
  discussion,
}: {
  discussion: Pick<DiscussionInList, "status" | "exchangesData" | "createdAt">;
}): DiscussionDisplayStatus => {
  const status: DiscussionDisplayStatus = match(discussion.status)
    .with("REJECTED", (): DiscussionDisplayStatus => "rejected")
    .with("ACCEPTED", (): DiscussionDisplayStatus => "accepted")
    .with("PENDING", (): DiscussionDisplayStatus => {
      const { lastExchange, hasEstablishmentAnswered } =
        discussion.exchangesData;
      if (!lastExchange) return "new";
      if (lastExchange && !hasEstablishmentAnswered) return "new";
      return "pending";
    })
    .exhaustive();
  return status;
};

export const getDiscussionFollowUp = <Role extends ExchangeRole>({
  discussion,
  now,
  viewer,
}: {
  discussion: Pick<DiscussionInList, "status" | "exchangesData" | "createdAt">;
  now: Date;
  viewer: Role;
}): DiscussionFollowUp | undefined => {
  if (discussion.status !== "PENDING") return;

  const { exchangesData } = discussion;
  const isLastExchangeOld = exchangesData.lastExchange?.sentAt
    ? new Date(exchangesData.lastExchange?.sentAt) <= subDays(now, 15)
    : false;

  if (
    viewer === "establishment" &&
    exchangesData.lastExchange?.sender === "potentialBeneficiary" &&
    isLastExchangeOld
  )
    return "needs-answer";

  if (
    viewer === "potentialBeneficiary" &&
    exchangesData.lastExchange?.sender === "establishment" &&
    isLastExchangeOld
  )
    return "needs-answer";

  if (
    viewer === "potentialBeneficiary" &&
    exchangesData.lastExchange?.sender === "potentialBeneficiary" &&
    isLastExchangeOld
  )
    return "to-remind";

  return;
};

export const emailExchangeSplitters = [
  /<br>\s*(De(?:&nbsp;|\u00A0|\s)*:|Le(?:&nbsp;|\u00A0|\s).*?,)?\s*Immersion Facilitée\s*(?:<|&lt;)ne-pas-ecrire-a-cet-email@immersion-facile\.beta\.gouv\.fr(?:>|&gt;)[^<]*(?:&nbsp;|\u00A0|\s)*a\s*écrit(?:&nbsp;|\u00A0|\s)*:[^<]*<br>/i,
  emailReplySeparator,
];
