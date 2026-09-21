import type { EstablishmentAggregate } from "../entities/EstablishmentAggregate";

export const isEstablishmentReachableByPhoneAfter15Days = (
  establishmentAggregate: EstablishmentAggregate,
): boolean =>
  establishmentAggregate.establishment.contactMode === "EMAIL" &&
  !!establishmentAggregate.userRights.find(
    (right) => right.isMainContactByPhone,
  )?.phone;
