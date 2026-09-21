import { Badge, type BadgeProps } from "@codegouvfr/react-dsfr/Badge";
import {
  type DiscussionDisplayStatusByRole,
  type DiscussionInList,
  type DiscussionReadDto,
  discussionToExchangesData,
  domElementIds,
  type ExchangeRole,
  getDiscussionDisplayStatus,
  isDiscussionInList,
} from "shared";

export const DiscussionStatusBadge = ({
  discussion,
  viewer,
  id = domElementIds.establishmentDashboard.discussion.statusBadge,
  small = false,
}: {
  discussion: DiscussionReadDto | DiscussionInList;
  viewer: ExchangeRole;
  id?: string;
  small?: BadgeProps["small"];
}) => {
  const statusBadge = getStatusBadgeData(
    viewer,
    getDiscussionDisplayStatus({
      discussion: {
        createdAt: discussion.createdAt,
        status: discussion.status,
        exchangesData: isDiscussionInList(discussion)
          ? discussion.exchangesData
          : discussionToExchangesData(discussion),
      },
    }),
  );

  return (
    <Badge id={id} severity={statusBadge.severity} small={small}>
      {statusBadge.label}
    </Badge>
  );
};

export type DiscussionBadgeData = {
  severity: BadgeProps["severity"];
  label: string;
};

const getStatusBadgeData = <Role extends ExchangeRole>(
  viewer: Role,
  status: DiscussionDisplayStatusByRole[Role],
): DiscussionBadgeData => {
  const badgeDataForRole = statusBadgeData[viewer];
  return badgeDataForRole[status];
};

const statusBadgeData: {
  [Role in ExchangeRole]: Record<
    DiscussionDisplayStatusByRole[Role],
    DiscussionBadgeData
  >;
} = {
  establishment: {
    new: {
      severity: "info",
      label: "Nouveau",
    },
    pending: {
      severity: "new",
      label: "En cours",
    },
    accepted: {
      severity: "success",
      label: "Acceptée",
    },
    rejected: {
      severity: undefined,
      label: "Refusée",
    },
  },
  potentialBeneficiary: {
    new: {
      severity: "info",
      label: "Envoyée",
    },
    pending: {
      severity: "new",
      label: "En cours",
    },
    accepted: {
      severity: "success",
      label: "Acceptée",
    },
    rejected: {
      severity: undefined,
      label: "Refusée",
    },
  },
};
