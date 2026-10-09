import {
  errors,
  type FormEstablishmentDto,
  noContactPerMonth,
  populatePropIfDefined,
  type WithBannedEstablishmentInformations,
} from "shared";
import { rawAddressToLocation } from "../../../utils/address";
import type { NafAndNumberOfEmpolyee } from "../../../utils/siret";
import type { AddressGateway } from "../../core/address/ports/AddressGateway";
import { createOrGetUserIdByEmail } from "../../core/authentication/connected-user/entities/user.helper";
import type { TimeGateway } from "../../core/time-gateway/ports/TimeGateway";
import type { UnitOfWork } from "../../core/unit-of-work/ports/UnitOfWork";
import type { UuidGenerator } from "../../core/uuid-generator/ports/UuidGenerator";
import type {
  EstablishmentAggregate,
  EstablishmentUserRight,
} from "../entities/EstablishmentAggregate";
import type { EstablishmentEntity } from "../entities/EstablishmentEntity";

export const makeEstablishmentAggregate = async ({
  uow,
  timeGateway,
  uuidGenerator,
  addressGateway,
  formEstablishment,
  nafAndNumberOfEmployee,
  score,
  existingEntity,
  withBannedEstablishmentInformations,
}: {
  uow: UnitOfWork;
  timeGateway: TimeGateway;
  addressGateway: AddressGateway;
  uuidGenerator: UuidGenerator;
  formEstablishment: FormEstablishmentDto;
  nafAndNumberOfEmployee: NafAndNumberOfEmpolyee;
  score: number;
  existingEntity?: EstablishmentEntity;
  withBannedEstablishmentInformations: WithBannedEstablishmentInformations;
}): Promise<EstablishmentAggregate> => {
  const establishmentUsersIds = await Promise.all(
    formEstablishment.userRights.map(({ email }) =>
      createOrGetUserIdByEmail(uow, timeGateway, uuidGenerator, {
        email,
      }),
    ),
  );

  const establishmentUsers = await uow.userRepository.getByIds(
    establishmentUsersIds,
  );

  const updatedUserRights: EstablishmentUserRight[] =
    formEstablishment.userRights.map(
      ({
        email,
        role,
        status,
        job,
        phone,
        shouldReceiveDiscussionNotifications,
        isMainContactByPhone,
        isMainContactInPerson,
      }) => {
        const user = establishmentUsers.find((user) => user.email === email);

        if (!user) throw errors.user.notFoundByEmail({ email });
        return role === "establishment-admin"
          ? {
              role,
              status,
              userId: user.id,
              job,
              phone,
              shouldReceiveDiscussionNotifications,
              isMainContactByPhone,
              ...populatePropIfDefined(
                "isMainContactInPerson",
                isMainContactInPerson,
              ),
            }
          : {
              role,
              status,
              userId: user.id,
              shouldReceiveDiscussionNotifications,
              ...populatePropIfDefined(
                "isMainContactByPhone",
                isMainContactByPhone,
              ),
              ...populatePropIfDefined("job", job),
              ...populatePropIfDefined("phone", phone),
              ...populatePropIfDefined(
                "isMainContactInPerson",
                isMainContactInPerson,
              ),
            };
      },
    );

  const locations = await Promise.all(
    formEstablishment.businessAddresses.map(async (address) =>
      rawAddressToLocation(addressGateway, formEstablishment.siret, address),
    ),
  );

  return {
    establishment: {
      acquisitionCampaign: formEstablishment.acquisitionCampaign,
      acquisitionKeyword: formEstablishment.acquisitionKeyword,
      locations,
      additionalInformation: formEstablishment.additionalInformation,
      createdAt: existingEntity ? existingEntity.createdAt : timeGateway.now(),
      customizedName: formEstablishment.businessNameCustomized,
      fitForDisabledWorkers: formEstablishment.fitForDisabledWorkers,
      isOpen: true,
      isMaxDiscussionsForPeriodReached:
        formEstablishment.maxContactsPerMonth <= noContactPerMonth,
      maxContactsPerMonth: formEstablishment.maxContactsPerMonth,
      ...nafAndNumberOfEmployee,
      name: formEstablishment.businessName,
      siret: formEstablishment.siret,
      sourceProvider: formEstablishment.source,
      updatedAt: timeGateway.now(),
      voluntaryToImmersion: true,
      website: formEstablishment.website,
      nextAvailabilityDate: formEstablishment.nextAvailabilityDate,
      searchableBy: formEstablishment.searchableBy,
      score,
      contactMode: formEstablishment.contactMode,
      ...(formEstablishment.contactMode === "IN_PERSON" && {
        potentialBeneficiaryWelcomeAddress:
          formEstablishment.potentialBeneficiaryWelcomeAddress,
      }),
      ...withBannedEstablishmentInformations,
    },
    userRights: updatedUserRights,
    offers: formEstablishment.offers.map((offer) => ({
      ...offer,
      createdAt: timeGateway.now(),
    })),
  };
};
