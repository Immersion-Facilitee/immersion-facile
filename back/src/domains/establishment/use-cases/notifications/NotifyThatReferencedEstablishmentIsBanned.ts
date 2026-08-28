import {
  type AbsoluteUrl,
  errors,
  executeInSequence,
  onlyAdminUserRightsWithStatusAccepted,
  onlyContactUserRightsWithStatusAccepted,
  type WithSiretDto,
  withSiretSchema,
} from "shared";
import type { SaveNotificationAndRelatedEvent } from "../../../core/notifications/helpers/Notification";
import type { TimeGateway } from "../../../core/time-gateway/ports/TimeGateway";
import type { UnitOfWork } from "../../../core/unit-of-work/ports/UnitOfWork";
import { useCaseBuilder } from "../../../core/useCaseBuilder";
import type { EstablishmentAggregate } from "../../entities/EstablishmentAggregate";
import { notifyValidatorAndCounsellor } from "./notifications.utils";

export type NotifyThatReferencedEstablishmentIsBanned = ReturnType<
  typeof makeNotifyThatReferencedEstablishmentIsBanned
>;

export const makeNotifyThatReferencedEstablishmentIsBanned = useCaseBuilder(
  "NotifyThatReferencedEstablishmentIsBanned",
)
  .withInput<WithSiretDto>(withSiretSchema)
  .withDeps<{
    saveNotificationAndRelatedEvent: SaveNotificationAndRelatedEvent;
    immersionBaseUrl: AbsoluteUrl;
    timeGateway: TimeGateway;
  }>()
  .build(async ({ uow, inputParams, deps }) => {
    const { siret } = inputParams;

    const establishment =
      await uow.establishmentAggregateRepository.getEstablishmentAggregateBySiret(
        siret,
      );

    if (!establishment) return;
    if (!establishment.establishment.isEstablishmentBanned)
      throw errors.establishment.establishmentNotBanned({ siret });

    await notifyEstablishmentUsers(
      uow,
      deps.saveNotificationAndRelatedEvent,
      establishment,
    );

    await notifyBeneficiaries(
      uow,
      deps.saveNotificationAndRelatedEvent,
      deps.immersionBaseUrl,
      establishment,
    );

    await notifyValidatorsAndCounsellors(
      uow,
      deps.timeGateway,
      deps.saveNotificationAndRelatedEvent,
      deps.immersionBaseUrl,
      establishment,
    );
  });

const notifyEstablishmentUsers = async (
  uow: UnitOfWork,
  saveNotificationAndRelatedEvent: SaveNotificationAndRelatedEvent,
  bannedEstablishment: EstablishmentAggregate,
) => {
  const userRightIds = bannedEstablishment.userRights
    .filter(
      (right) =>
        onlyAdminUserRightsWithStatusAccepted(right) ||
        onlyContactUserRightsWithStatusAccepted(right),
    )
    .map((right) => right.userId);

  const users = await uow.userRepository.getByIds(userRightIds);

  await executeInSequence(users, (user) =>
    saveNotificationAndRelatedEvent(uow, {
      kind: "email",
      templatedContent: {
        kind: "ESTABLISHMENT_BANNED_NOTIFICATION_TO_ESTABLISHMENT_USERS",
        recipients: [user.email],
        params: {
          businessName: bannedEstablishment.establishment.name,
          siret: bannedEstablishment.establishment.siret,
        },
      },
      followedIds: {
        establishmentSiret: bannedEstablishment.establishment.siret,
      },
    }),
  );
};

const notifyBeneficiaries = async (
  uow: UnitOfWork,
  saveNotificationAndRelatedEvent: SaveNotificationAndRelatedEvent,
  immersionBaseUrl: AbsoluteUrl,
  bannedEstablishment: EstablishmentAggregate,
) => {
  const discussions = await uow.discussionRepository.getDiscussions({
    filters: { sirets: [bannedEstablishment.establishment.siret] },
    limit: 1000,
  });

  const pendingDiscussions = discussions.filter((d) => d.status === "PENDING");

  await executeInSequence(pendingDiscussions, (discussion) =>
    saveNotificationAndRelatedEvent(uow, {
      kind: "email",
      templatedContent: {
        kind: "ESTABLISHMENT_BANNED_NOTIFICATION_TO_BENEFICIARY",
        recipients: [discussion.potentialBeneficiary.email],
        params: {
          businessName: bannedEstablishment.establishment.name,
          beneficiaryFirstName: discussion.potentialBeneficiary.firstName,
          beneficiaryLastName: discussion.potentialBeneficiary.lastName,
          immersionBaseUrl: immersionBaseUrl,
        },
      },
      followedIds: {
        establishmentSiret: bannedEstablishment.establishment.siret,
      },
    }),
  );
};

const notifyValidatorsAndCounsellors = async (
  uow: UnitOfWork,
  timeGateway: TimeGateway,
  saveNotificationAndRelatedEvent: SaveNotificationAndRelatedEvent,
  immersionBaseUrl: AbsoluteUrl,
  bannedEstablishment: EstablishmentAggregate,
) => {
  const validatedConventions = await uow.conventionQueries.getConventions({
    filters: {
      withSirets: [bannedEstablishment.establishment.siret],
      withStatuses: ["ACCEPTED_BY_VALIDATOR"],
      endDate: { from: timeGateway.now() },
    },
    sortBy: "dateStart",
  });

  await executeInSequence(validatedConventions, (convention) =>
    notifyValidatorAndCounsellor(
      uow,
      saveNotificationAndRelatedEvent,
      immersionBaseUrl,
      convention,
      bannedEstablishment.establishment.name,
    ),
  );
};
