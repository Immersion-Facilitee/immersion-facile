import { subMonths } from "date-fns";
import { splitEvery, sum, uniq } from "ramda";
import {
  executeInSequence,
  immersionFacileNoReplyEmailSender,
  onlyAdminUserRightsWithStatusAccepted,
  type SiretDto,
  type UserId,
} from "shared";
import type {
  NotificationContentAndFollowedIds,
  SaveNotificationsBatchAndRelatedEvent,
} from "../../core/notifications/helpers/Notification";
import type { TimeGateway } from "../../core/time-gateway/ports/TimeGateway";
import type { UnitOfWork } from "../../core/unit-of-work/ports/UnitOfWork";
import type { UnitOfWorkPerformer } from "../../core/unit-of-work/ports/UnitOfWorkPerformer";
import { useCaseBuilder } from "../../core/useCaseBuilder";
import type { EstablishmentAggregate } from "../entities/EstablishmentAggregate";

const monthsWithoutUpdateBeforeSuggestingReengagement = 6;

export type SuggestEstablishmentsReengagementResult = {
  numberOfEstablishmentsNotified: number;
  numberOfNotificationsSent: number;
};

export type SuggestEstablishmentsReengagement = ReturnType<
  typeof makeSuggestEstablishmentsReengagement
>;

export const makeSuggestEstablishmentsReengagement = useCaseBuilder(
  "SuggestEstablishmentsReengagement",
)
  .withOutput<SuggestEstablishmentsReengagementResult>()
  .withDeps<{
    uowPerformer: UnitOfWorkPerformer;
    timeGateway: TimeGateway;
    saveNotificationsBatchAndRelatedEvent: SaveNotificationsBatchAndRelatedEvent;
    batchSize: number;
    maxEstablishmentsToReengage: number;
  }>()
  .notTransactional()
  .build(async ({ deps }) => {
    const notUpdatedNorSuggestedSince = subMonths(
      deps.timeGateway.now(),
      monthsWithoutUpdateBeforeSuggestingReengagement,
    );

    const siretsToSuggestReengagement = await deps.uowPerformer.perform((uow) =>
      uow.establishmentAggregateRepository.getSiretsOfEstablishmentsToSuggestReengagement(
        {
          notUpdatedNorSuggestedSince,
          limit: deps.maxEstablishmentsToReengage,
        },
      ),
    );

    const siretBatches = splitEvery(
      deps.batchSize,
      siretsToSuggestReengagement,
    );

    const numberOfNotificationsSentByBatch = await executeInSequence(
      siretBatches,
      (sirets) =>
        deps.uowPerformer.perform(async (uow) => {
          const notifications = await makeReengagementSuggestionNotifications(
            uow,
            sirets,
          );
          await deps.saveNotificationsBatchAndRelatedEvent(uow, notifications);
          return notifications.length;
        }),
    );

    return {
      numberOfEstablishmentsNotified: siretsToSuggestReengagement.length,
      numberOfNotificationsSent: sum(numberOfNotificationsSentByBatch),
    };
  });

const makeReengagementSuggestionNotifications = async (
  uow: UnitOfWork,
  sirets: SiretDto[],
): Promise<NotificationContentAndFollowedIds[]> => {
  const establishmentAggregates =
    await uow.establishmentAggregateRepository.getEstablishmentAggregatesByFilters(
      { sirets },
    );

  const admins = await uow.userRepository.getByIds(
    uniq(establishmentAggregates.flatMap(getAcceptedAdminIds)),
  );

  return establishmentAggregates.flatMap((establishmentAggregate) => {
    const establishmentAdminIds = getAcceptedAdminIds(establishmentAggregate);
    const { establishment } = establishmentAggregate;

    return admins
      .filter(({ id }) => establishmentAdminIds.includes(id))
      .map(
        (admin): NotificationContentAndFollowedIds => ({
          kind: "email",
          templatedContent: {
            kind: "ESTABLISHMENT_REENGAGEMENT_SUGGESTION",
            sender: immersionFacileNoReplyEmailSender,
            recipients: [admin.email],
            params: {
              businessName: establishment.customizedName ?? establishment.name,
            },
          },
          followedIds: {
            establishmentSiret: establishment.siret,
          },
        }),
      );
  });
};

const getAcceptedAdminIds = ({
  userRights,
}: EstablishmentAggregate): UserId[] =>
  userRights
    .filter(onlyAdminUserRightsWithStatusAccepted)
    .map(({ userId }) => userId);
