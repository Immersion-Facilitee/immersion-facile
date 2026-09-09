import type { UserEstablishmentRightDetails } from "./establishment.dto";

export type AcceptedUserEstablishmentRightDetails = Extract<
  UserEstablishmentRightDetails,
  { status: "ACCEPTED" }
>;

export type PendingUserEstablishmentRightDetails = Extract<
  UserEstablishmentRightDetails,
  { status: "PENDING" }
>;

export const partitionEstablishmentRightsByStatus = (
  establishments: UserEstablishmentRightDetails[] = [],
): {
  acceptedEstablishmentRights: AcceptedUserEstablishmentRightDetails[];
  pendingEstablishmentRights: PendingUserEstablishmentRightDetails[];
} => ({
  acceptedEstablishmentRights: establishments.filter(
    (establishment): establishment is AcceptedUserEstablishmentRightDetails =>
      establishment.status === "ACCEPTED",
  ),
  pendingEstablishmentRights: establishments.filter(
    (establishment): establishment is PendingUserEstablishmentRightDetails =>
      establishment.status === "PENDING",
  ),
});
