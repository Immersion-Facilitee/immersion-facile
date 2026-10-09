import {
  onlyAdminUserRightsWithStatusAccepted,
  onlyUserRightWithStatusAccepted,
  type UserId,
} from "shared";
import type { EstablishmentAggregate } from "../entities/EstablishmentAggregate";

export const isEstablishmentReachableByPhoneAfter15Days = (
  establishmentAggregate: EstablishmentAggregate,
): boolean =>
  establishmentAggregate.establishment.contactMode === "EMAIL" &&
  !!establishmentAggregate.userRights.find(
    (right) => right.isMainContactByPhone,
  )?.phone;

export const isLastAcceptedAdminWithPendingRightsOnly = (
  { userRights }: EstablishmentAggregate,
  userId: UserId,
): boolean => {
  const acceptedAdmins = userRights.filter(
    onlyAdminUserRightsWithStatusAccepted,
  );
  const [onlyAcceptedAdmin] = acceptedAdmins;
  if (acceptedAdmins.length !== 1 || onlyAcceptedAdmin?.userId !== userId)
    return false;

  const remainingRights = userRights.filter((right) => right.userId !== userId);

  return (
    remainingRights.some(({ status }) => status === "PENDING") &&
    !remainingRights.some(onlyUserRightWithStatusAccepted)
  );
};
