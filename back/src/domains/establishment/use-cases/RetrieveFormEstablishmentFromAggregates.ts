import {
  addressDtoToString,
  type ConnectedUserDomainJwtPayload,
  errors,
  type FormEstablishmentDto,
  type FormEstablishmentUserRight,
  populatePropIfDefined,
  siretSchema,
} from "shared";
import type { UnitOfWork } from "../../core/unit-of-work/ports/UnitOfWork";
import { useCaseBuilder } from "../../core/useCaseBuilder";
import type {
  EstablishmentAggregate,
  EstablishmentUserRight,
} from "../entities/EstablishmentAggregate";

export type RetrieveFormEstablishmentFromAggregates = ReturnType<
  typeof makeRetrieveFormEstablishmentFromAggregates
>;

export const makeRetrieveFormEstablishmentFromAggregates = useCaseBuilder(
  "RetrieveFormEstablishmentFromAggregates",
)
  .withInput(siretSchema)
  .withOutput<FormEstablishmentDto>()
  .withCurrentUser<ConnectedUserDomainJwtPayload>()
  .build(async ({ inputParams, uow, currentUser: jwtPayload }) => {
    const currentUser = await uow.userRepository.getById(jwtPayload.userId);
    if (!currentUser) throw errors.user.notFound({ userId: jwtPayload.userId });

    const establishmentAggregate =
      await uow.establishmentAggregateRepository.getEstablishmentAggregateBySiret(
        inputParams,
      );

    if (!establishmentAggregate)
      throw errors.establishment.notFound({ siret: inputParams });

    if (
      establishmentAggregate.userRights.some(
        (right) =>
          right.userId === currentUser.id && right.status === "ACCEPTED",
      ) ||
      currentUser.isBackofficeAdmin
    )
      return makeFormEstablishement(uow, establishmentAggregate);

    throw errors.user.unauthorized();
  });

const makeFormEstablishement = async (
  uow: UnitOfWork,
  establishmentAggregate: EstablishmentAggregate,
): Promise<FormEstablishmentDto> =>
  makeFormUserRights(uow, establishmentAggregate.userRights).then(
    (userRights) => ({
      siret: establishmentAggregate.establishment.siret,
      source: "immersion-facile",
      website: establishmentAggregate.establishment.website,
      additionalInformation:
        establishmentAggregate.establishment.additionalInformation,
      businessName: establishmentAggregate.establishment.name,
      businessNameCustomized:
        establishmentAggregate.establishment.customizedName,
      businessAddresses: establishmentAggregate.establishment.locations.map(
        (location) => ({
          id: location.id,
          rawAddress: addressDtoToString(location.address),
        }),
      ),
      fitForDisabledWorkers:
        establishmentAggregate.establishment.fitForDisabledWorkers,
      naf: establishmentAggregate.establishment?.nafDto,
      offers: establishmentAggregate.offers.map(
        ({ createdAt, ...offer }) => offer,
      ),
      userRights,
      contactMode: establishmentAggregate.establishment.contactMode,
      maxContactsPerMonth:
        establishmentAggregate.establishment.maxContactsPerMonth,
      nextAvailabilityDate:
        establishmentAggregate.establishment.nextAvailabilityDate,
      searchableBy: establishmentAggregate.establishment.searchableBy,
      ...(establishmentAggregate.establishment.isEstablishmentBanned
        ? {
            isEstablishmentBanned: true,
            establishmentBannishmentJustification:
              establishmentAggregate.establishment
                .establishmentBannishmentJustification,
          }
        : {
            isEstablishmentBanned: false,
          }),
      ...(establishmentAggregate.establishment.contactMode === "IN_PERSON"
        ? {
            potentialBeneficiaryWelcomeAddress:
              establishmentAggregate.establishment
                .potentialBeneficiaryWelcomeAddress,
          }
        : {}),
    }),
  );

const makeFormUserRights = async (
  uow: UnitOfWork,
  userRights: EstablishmentUserRight[],
): Promise<FormEstablishmentUserRight[]> =>
  uow.userRepository
    .getByIds(userRights.map(({ userId }) => userId))
    .then((users) =>
      userRights.map(
        ({
          role,
          status,
          userId,
          job,
          phone,
          shouldReceiveDiscussionNotifications,
          isMainContactByPhone,
          isMainContactInPerson,
        }) => {
          const user = users.find(({ id }) => id === userId);
          if (!user) throw errors.user.notFound({ userId });

          const nameProps = {
            ...populatePropIfDefined("firstName", user.firstName || undefined),
            ...populatePropIfDefined("lastName", user.lastName || undefined),
          };

          if (role === "establishment-admin") {
            return {
              role,
              status,
              email: user.email,
              ...nameProps,
              job,
              phone,
              shouldReceiveDiscussionNotifications,
              isMainContactByPhone,
              isMainContactInPerson,
            };
          }

          const baseContact = {
            role,
            status,
            email: user.email,
            ...nameProps,
            job,
            phone,
            shouldReceiveDiscussionNotifications,
            isMainContactInPerson,
          };

          return phone && isMainContactByPhone !== undefined
            ? {
                ...baseContact,
                isMainContactByPhone,
                isMainContactInPerson,
              }
            : baseContact;
        },
      ),
    );
