import { subDays, subYears } from "date-fns";
import type { DateRange } from "shared";
import { z } from "zod";
import type { CreateNewEvent } from "../../../events/ports/EventBus";
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

export type TriggerEventsToDeleteInactiveUsersResult = {
  numberOfDeletionsTriggered: number;
};

export type TriggerEventsToDeleteInactiveUsers = ReturnType<
  typeof makeTriggerEventsToDeleteInactiveUsers
>;

export const makeTriggerEventsToDeleteInactiveUsers = useCaseBuilder(
  "TriggerEventsToDeleteInactiveUsers",
)
  .withInput(z.void())
  .withOutput<TriggerEventsToDeleteInactiveUsersResult>()
  .withDeps<{
    uowPerformer: UnitOfWorkPerformer;
    timeGateway: TimeGateway;
    createNewEvent: CreateNewEvent;
    batchSize: number;
  }>()
  .notTransactional()
  .build(async ({ deps }) => {
    const featureFlags = await deps.uowPerformer.perform((uow) =>
      uow.featureFlagQueries.getAll(),
    );
    if (!featureFlags.enableInactiveUsersCleanup.isActive)
      return { numberOfDeletionsTriggered: 0 };

    const now = deps.timeGateway.now();
    const twoYearsAgo = subYears(now, accountInactivityDelayInYears);

    const warnedRange: DateRange = {
      from: subDays(now, deletionWarningDedupInDays),
      to: subDays(now, deletionWarningDelayInDays),
    };

    const shouldQuarantine =
      !featureFlags.enableInactiveUsersDeletionAutoProcessing.isActive;

    let offset = 0;
    let numberOfDeletionsTriggered = 0;

    while (true) {
      const batchResult = await deps.uowPerformer.perform(async (uow) => {
        const loggedInLongAgoUserIds =
          await uow.userRepository.getUserIdsLoggedInAndCreatedLongAgoAndNotPreventedToDelete(
            {
              since: twoYearsAgo,
              limit: deps.batchSize,
              offset,
            },
          );

        if (loggedInLongAgoUserIds.length === 0)
          return {
            hasMore: false,
            numberOfDeletionsTriggered: 0,
          };

        const candidateUserIds =
          await uow.notificationRepository.filterUserDeletionWarningNotifications(
            {
              userIds: loggedInLongAgoUserIds,
              onlyWarnedBetween: warnedRange,
            },
          );

        const candidateUserIdsWithoutActiveConvention =
          await getUserIdsWithoutActiveConvention({
            uow,
            userIds: candidateUserIds,
            since: twoYearsAgo,
          });

        const userIdsToDelete =
          await uow.discussionRepository.getUserIdsWithNoRecentExchange({
            userIds: candidateUserIdsWithoutActiveConvention,
            since: twoYearsAgo,
          });

        const events = userIdsToDelete.map((userId) =>
          deps.createNewEvent({
            topic: "InactiveUserAccountDeletionTriggered",
            payload: { userId, triggeredBy: { kind: "crawler" } },
            wasQuarantined: shouldQuarantine,
            priority: inactiveUserNotificationEventPriority,
          }),
        );

        await uow.outboxRepository.saveNewEventsBatch(events);

        return {
          hasMore: true,
          numberOfDeletionsTriggered: userIdsToDelete.length,
        };
      });

      if (!batchResult.hasMore) break;

      offset += deps.batchSize;
      numberOfDeletionsTriggered += batchResult.numberOfDeletionsTriggered;
    }

    return { numberOfDeletionsTriggered };
  });
