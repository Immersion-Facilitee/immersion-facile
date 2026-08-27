import { addDays, subDays, subYears } from "date-fns";
import { type AbsoluteUrl, frontRoutes, makeRouteAbsoluteUrl } from "shared";
import { z } from "zod";
import type {
  NotificationContentAndFollowedIds,
  SaveNotificationsBatchAndRelatedEvent,
} from "../../../notifications/helpers/Notification";
import type { TimeGateway } from "../../../time-gateway/ports/TimeGateway";
import type { UnitOfWorkPerformer } from "../../../unit-of-work/ports/UnitOfWorkPerformer";
import { useCaseBuilder } from "../../../useCaseBuilder";
import { getUserIdsWithoutActiveConvention } from "../entities/user.helper";
import {
  accountInactivityDelayInYears,
  deletionWarningDedupInDays,
  deletionWarningDelayInDays,
  inactiveUserNotificationEventPriority,
} from "./inactiveUserConstants";

export type WarnInactiveUsersResult = {
  numberOfWarningsSent: number;
};

export type WarnInactiveUsers = ReturnType<typeof makeWarnInactiveUsers>;

export const makeWarnInactiveUsers = useCaseBuilder("WarnInactiveUsers")
  .withInput(z.void())
  .withOutput<WarnInactiveUsersResult>()
  .withDeps<{
    uowPerformer: UnitOfWorkPerformer;
    saveNotificationsBatchAndRelatedEvent: SaveNotificationsBatchAndRelatedEvent;
    timeGateway: TimeGateway;
    immersionBaseUrl: AbsoluteUrl;
    batchSize: number;
  }>()
  .notTransactional()
  .build(async ({ deps }) => {
    const featureFlags = await deps.uowPerformer.perform((uow) =>
      uow.featureFlagQueries.getAll(),
    );
    if (!featureFlags.enableInactiveUsersCleanup.isActive)
      return { numberOfWarningsSent: 0 };

    const now = deps.timeGateway.now();
    const twoYearsAgo = subYears(now, accountInactivityDelayInYears);
    const deletionDate = addDays(now, deletionWarningDelayInDays);
    const warningCutoff = subDays(now, deletionWarningDedupInDays);

    let offset = 0;
    let numberOfWarningsSent = 0;

    while (true) {
      const batchResult = await deps.uowPerformer.perform(async (uow) => {
        const userIdsLoggedInAndCreatedLongAgo =
          await uow.userRepository.getUserIdsLoggedInAndCreatedLongAgoAndNotPreventedToDelete(
            {
              since: twoYearsAgo,
              limit: deps.batchSize,
              offset,
            },
          );

        if (userIdsLoggedInAndCreatedLongAgo.length === 0)
          return {
            hasMore: false,
            numberOfWarningsSent: 0,
          };

        const alreadyWarnedUserIds =
          await uow.notificationRepository.filterUserDeletionWarningNotifications(
            {
              userIds: userIdsLoggedInAndCreatedLongAgo,
              excludeWarnedSince: warningCutoff,
            },
          );

        const alreadyWarned = new Set(alreadyWarnedUserIds);
        const notYetWarnedUserIds = userIdsLoggedInAndCreatedLongAgo.filter(
          (id) => !alreadyWarned.has(id),
        );

        const candidateUserIdsWithoutActiveConvention =
          await getUserIdsWithoutActiveConvention({
            uow,
            userIds: notYetWarnedUserIds,
            since: twoYearsAgo,
          });

        const inactiveUserIds =
          await uow.discussionRepository.getUserIdsWithNoRecentExchange({
            userIds: candidateUserIdsWithoutActiveConvention,
            since: twoYearsAgo,
          });

        const inactiveUsers =
          await uow.userRepository.getByIds(inactiveUserIds);

        const deletionDateFormatted = deletionDate.toLocaleDateString("fr-FR", {
          day: "numeric",
          month: "long",
          year: "numeric",
        });

        const loginUrl: AbsoluteUrl = makeRouteAbsoluteUrl({
          route: frontRoutes.myAccount(),
          baseUrl: deps.immersionBaseUrl,
        });

        const notifications: NotificationContentAndFollowedIds[] =
          inactiveUsers.map((user) => ({
            kind: "email",
            templatedContent: {
              kind: "ACCOUNT_DELETION_WARNING",
              recipients: [user.email],
              params: {
                fullName: `${user.firstName} ${user.lastName}`,
                deletionDate: deletionDateFormatted,
                loginUrl,
              },
            },
            followedIds: {
              userId: user.id,
            },
          }));

        if (notifications.length)
          await deps.saveNotificationsBatchAndRelatedEvent(uow, notifications, {
            priority: inactiveUserNotificationEventPriority,
          });

        return {
          hasMore: true,
          numberOfWarningsSent: notifications.length,
        };
      });

      if (!batchResult.hasMore) break;

      offset += deps.batchSize;
      numberOfWarningsSent += batchResult.numberOfWarningsSent;
    }

    return { numberOfWarningsSent };
  });
