import type { UserEstablishmentRightDetails } from "./establishment.dto";

export type AcceptedUserEstablishmentRightDetails = Extract<
  UserEstablishmentRightDetails,
  { status: "ACCEPTED" }
>;

export type PendingUserEstablishmentRightDetails = Extract<
  UserEstablishmentRightDetails,
  { status: "PENDING" }
>;

export const partitionUserEstablishmentRightsByStatus = (
  establishmentUserRights: UserEstablishmentRightDetails[] = [],
): {
  acceptedUserEstablishmentsRights: AcceptedUserEstablishmentRightDetails[];
  pendingUserEstablishmentsRights: PendingUserEstablishmentRightDetails[];
} => ({
  acceptedUserEstablishmentsRights: establishmentUserRights.filter(
    (establishment): establishment is AcceptedUserEstablishmentRightDetails =>
      establishment.status === "ACCEPTED",
  ),
  pendingUserEstablishmentsRights: establishmentUserRights.filter(
    (establishment): establishment is PendingUserEstablishmentRightDetails =>
      establishment.status === "PENDING",
  ),
});
