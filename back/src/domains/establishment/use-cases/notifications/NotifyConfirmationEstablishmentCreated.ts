import {
  errors,
  getDisplayedBusinessName,
  onlyContactUserRightsWithStatusAccepted,
  type UserWithAdminRights,
  type WithSiretDto,
  withSiretSchema,
} from "shared";
import { locationToRawAddress } from "../../../../utils/address";
import type { SaveNotificationAndRelatedEvent } from "../../../core/notifications/helpers/Notification";
import type { UnitOfWork } from "../../../core/unit-of-work/ports/UnitOfWork";
import { useCaseBuilder } from "../../../core/useCaseBuilder";
import type { EstablishmentAggregate } from "../../entities/EstablishmentAggregate";

export type NotifyConfirmationEstablishmentCreated = ReturnType<
  typeof makeNotifyConfirmationEstablishmentCreated
>;

export const makeNotifyConfirmationEstablishmentCreated = useCaseBuilder(
  "NotifyConfirmationEstablishmentCreated",
)
  .withInput<WithSiretDto>(withSiretSchema)
  .withDeps<{
    saveNotificationAndRelatedEvent: SaveNotificationAndRelatedEvent;
  }>()
  .build(async ({ deps, inputParams, uow }) => {
    const establishment =
      await uow.establishmentAggregateRepository.getEstablishmentAggregateBySiret(
        inputParams.siret,
      );

    if (!establishment)
      throw errors.establishment.notFound({ siret: inputParams.siret });

    const firstAdminUser = await getFirstAdminUser(uow, establishment);
    const establishmentContactUsers = await getEstablishmentContactUsers(
      uow,
      establishment,
    );

    await deps.saveNotificationAndRelatedEvent(uow, {
      kind: "email",
      templatedContent: {
        kind: "NEW_ESTABLISHMENT_CREATED_CONTACT_CONFIRMATION",
        recipients: [firstAdminUser.email],
        cc: establishmentContactUsers.map((user) => user.email),
        params: {
          businessName: getDisplayedBusinessName({
            businessName: establishment.establishment.name,
            businessNameCustomized: establishment.establishment.customizedName,
          }),
          businessAddresses: establishment.establishment.locations.map(
            ({ address, id }) => locationToRawAddress(id, address).rawAddress,
          ),
          appelationLabels: establishment.offers.map(
            (offer) => offer.appellationLabel,
          ),
        },
      },
      followedIds: {
        establishmentSiret: establishment.establishment.siret,
      },
    });
  });

const getFirstAdminUser = async (
  uow: UnitOfWork,
  establishment: EstablishmentAggregate,
): Promise<UserWithAdminRights> => {
  const firstAdmin = establishment.userRights.find(
    (user) => user.role === "establishment-admin",
  );

  if (!firstAdmin)
    throw errors.establishment.adminNotFound({
      siret: establishment.establishment.siret,
    });

  const firstAdminUser = await uow.userRepository.getById(firstAdmin.userId);

  if (!firstAdminUser)
    throw errors.user.notFound({ userId: firstAdmin.userId });
  return firstAdminUser;
};

const getEstablishmentContactUsers = async (
  uow: UnitOfWork,
  establishment: EstablishmentAggregate,
): Promise<UserWithAdminRights[]> => {
  const contactUserRights = establishment.userRights.filter(
    onlyContactUserRightsWithStatusAccepted,
  );

  return uow.userRepository.getByIds(
    contactUserRights.map((userRight) => userRight.userId),
  );
};
