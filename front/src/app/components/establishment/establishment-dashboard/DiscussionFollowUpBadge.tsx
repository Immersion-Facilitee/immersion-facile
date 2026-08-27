import { Badge, type BadgeProps } from "@codegouvfr/react-dsfr/Badge";
import {
  type DiscussionFollowUpByRole,
  type DiscussionInList,
  type DiscussionReadDto,
  discussionToExchangesData,
  domElementIds,
  type ExchangeRole,
  getDiscussionFollowUp,
  isDiscussionInList,
} from "shared";
import type { DiscussionBadgeData } from "src/app/components/establishment/establishment-dashboard/DiscussionStatusBadge";

export const DiscussionFollowUpBadge = ({
  discussion,
  viewer,
  id = domElementIds.establishmentDashboard.discussion.statusBadge,
  isEstablishmentReachableByPhoneAfter15Days,
  small = false,
  className,
}: {
  discussion: DiscussionReadDto | DiscussionInList;
  viewer: ExchangeRole;
  isEstablishmentReachableByPhoneAfter15Days: boolean;
  className?: string;
  id?: string;
  small?: BadgeProps["small"];
}) => {
  const followUp = getDiscussionFollowUp({
    discussion: {
      createdAt: discussion.createdAt,
      status: discussion.status,
      exchangesData: isDiscussionInList(discussion)
        ? discussion.exchangesData
        : discussionToExchangesData(discussion),
    },
    now: new Date(),
    viewer,
  });
  const followUpBadge = getFollowUpBadgeData(viewer, followUp);

  if (
    !followUpBadge ||
    (followUp === "to-remind" && !isEstablishmentReachableByPhoneAfter15Days)
  )
    return null;

  return (
    <Badge
      id={id}
      severity={followUpBadge.severity}
      className={className}
      small={small}
    >
      {followUpBadge.label}
    </Badge>
  );
};

const getFollowUpBadgeData = <Role extends ExchangeRole>(
  viewer: Role,
  followUp: DiscussionFollowUpByRole[Role] | undefined,
): DiscussionBadgeData | undefined => {
  const badgeDataForRole = followUpBadgeData[viewer];
  if (followUp) return badgeDataForRole[followUp];
  return;
};

const followUpBadgeData: {
  [Role in ExchangeRole]: Record<
    DiscussionFollowUpByRole[Role],
    DiscussionBadgeData
  >;
} = {
  establishment: {
    "needs-answer": {
      label: "À traiter",
      severity: "warning",
    },
  },
  potentialBeneficiary: {
    "needs-answer": {
      label: "À traiter",
      severity: "warning",
    },
    "to-remind": {
      label: "À relancer",
      severity: "warning",
    },
  },
};
