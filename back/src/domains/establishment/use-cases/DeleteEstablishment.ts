import {
  addressDtoToString,
  type ConnectedUser,
  type Email,
  type EstablishmentRole,
  errors,
  executeInSequence,
  getDisplayedBusinessName,
  type WithSiretDto,
  withSiretSchema,
} from "shared";
import { throwIfNotAdmin } from "../../connected-users/helpers/authorization.helper";
import {
  type WithTriggeredBy,
  withTriggeredBySchema,
} from "../../core/events/events";
import type { CreateNewEvent } from "../../core/events/ports/EventBus";
import type { SaveNotificationAndRelatedEvent } from "../../core/notifications/helpers/Notification";
import type { TimeGateway } from "../../core/time-gateway/ports/TimeGateway";
import type { UnitOfWork } from "../../core/unit-of-work/ports/UnitOfWork";
import { useCaseBuilder } from "../../core/useCaseBuilder";
import type { EstablishmentAggregate } from "../entities/EstablishmentAggregate";

export type DeleteEstablishment = ReturnType<typeof makeDeleteEstablishment>;
type Deps = {
  timeGateway: TimeGateway;
  createNewEvent: CreateNewEvent;
  saveNotificationAndRelatedEvent: SaveNotificationAndRelatedEvent;
};

export const makeDeleteEstablishment = useCaseBuilder("DeleteEstablishment")
  .withInput(withSiretSchema.and(withTriggeredBySchema))
  .withCurrentUser<ConnectedUser | void>()
  .withDeps<Deps>()
  .build(async ({ currentUser, deps, inputParams, uow }) => {
    if (inputParams.triggeredBy?.kind === "connected-user" && currentUser) {
      throwIfNotAdmin(currentUser);
      return onValidRights(uow, deps, inputParams);
    }
    if (inputParams.triggeredBy?.kind === "crawler") {
      return onValidRights(uow, deps, inputParams);
    }
    throw errors.user.unauthorized();
  });

const onValidRights = async (
  uow: UnitOfWork,
  deps: Deps,
  { siret, triggeredBy }: WithSiretDto & WithTriggeredBy,
) =>
  uow.establishmentAggregateRepository
    .getEstablishmentAggregateBySiret(siret)
    .then((establishment) => {
      if (!establishment) throw errors.establishment.notFound({ siret });
      return onEstablishment(uow, deps, { siret, triggeredBy }, establishment);
    });

const onEstablishment = (
  uow: UnitOfWork,
  deps: Deps,
  params: WithSiretDto & WithTriggeredBy,
  establishment: EstablishmentAggregate,
): Promise<void> =>
  uow.establishmentAggregateRepository
    .delete(params.siret)
    .then(() => uow.groupRepository.groupsWithSiret(params.siret))
    .then((groups) =>
      executeInSequence(
        groups.map((group) => ({
          ...group,
          sirets: group.sirets.filter(
            (groupSiret) => groupSiret !== params.siret,
          ),
        })),
        (group) => uow.groupRepository.save(group),
      ),
    )
    .then(() =>
      uow.deletedEstablishmentRepository.save({
        siret: params.siret,
        createdAt: establishment.establishment.createdAt,
        deletedAt: deps.timeGateway.now(),
      }),
    )
    .then(() =>
      uow.outboxRepository.save(
        deps.createNewEvent({
          topic: "EstablishmentDeleted",
          payload: params,
        }),
      ),
    )
    .then(async () => {
      if (establishment.userRights.length)
        await deps.saveNotificationAndRelatedEvent(uow, {
          kind: "email",
          templatedContent: {
            kind: "ESTABLISHMENT_DELETED",
            recipients: await getUserEmailsByEstablishmentUserRole(
              uow,
              establishment,
              "establishment-admin",
            ),
            cc: await getUserEmailsByEstablishmentUserRole(
              uow,
              establishment,
              "establishment-contact",
            ),
            params: {
              businessAddresses: establishment.establishment.locations.map(
                (addressAndPosition) =>
                  addressDtoToString(addressAndPosition.address),
              ),
              businessName: getDisplayedBusinessName({
                businessName: establishment.establishment.name,
                businessNameCustomized:
                  establishment.establishment.customizedName,
              }),
              siret: establishment.establishment.siret,
            },
          },
          followedIds: {
            establishmentSiret: establishment.establishment.siret,
          },
        });
    });

const getUserEmailsByEstablishmentUserRole = (
  uow: UnitOfWork,
  establishmentAggregate: EstablishmentAggregate,
  role: EstablishmentRole,
): Promise<Email[]> =>
  uow.userRepository
    .getByIds(
      establishmentAggregate.userRights
        .filter((userRight) => userRight.role === role)
        .map(({ userId }) => userId),
    )
    .then((users) => users.map(({ email }) => email));
