import { addDays, subMonths } from "date-fns";
import { toPairs, uniq } from "ramda";
import {
  type AgencyId,
  type ConventionId,
  errors,
  executeInSequence,
  type UserId,
} from "shared";
import type {
  NotificationContentAndFollowedIds,
  SaveNotificationsBatchAndRelatedEvent,
} from "../../../core/notifications/helpers/Notification";
import type { TimeGateway } from "../../../core/time-gateway/ports/TimeGateway";
import type { UnitOfWork } from "../../../core/unit-of-work/ports/UnitOfWork";
import { useCaseBuilder } from "../../../core/useCaseBuilder";

export type ConventionSummaryNotifications = ReturnType<
  typeof makeConventionSummaryNotifications
>;
export const makeConventionSummaryNotifications = useCaseBuilder(
  "ConventionSummaryNotifications",
)
  .withDeps<{
    timeGateway: TimeGateway;
    saveNotificationsBatchAndRelatedEvent: SaveNotificationsBatchAndRelatedEvent;
  }>()
  .withOutput<number>()
  .build(
    async ({
      uow,
      deps: { timeGateway, saveNotificationsBatchAndRelatedEvent },
    }) => {
      const now = timeGateway.now();
      const activeAgencyIds = await uow.agencyRepository.getAgencyIdsByFilters({
        statuses: ["active", "from-api-PE"],
      });

      const reportsAndNotifiedUsersPerAgency = await executeInSequence(
        activeAgencyIds,
        (agencyId) => makeReportAndNotifiedUsers(uow, now, agencyId),
      );

      const userIdReports = reportsAndNotifiedUsersPerAgency.reduce<
        Record<
          UserId,
          {
            conventionsToManage: ConventionId[];
            newConventions: ConventionId[];
            validatedConventions: ConventionId[];
          }
        >
      >((acc, current) => {
        const userIds = current.notifiedUserIds;
        for (const userId of userIds) {
          acc[userId] = {
            conventionsToManage: uniq([
              ...acc[userId].conventionsToManage,
              ...current.conventionsToManage,
            ]),
            newConventions: uniq([
              ...acc[userId].newConventions,
              ...current.newConventions,
            ]),
            validatedConventions: uniq([
              ...acc[userId].validatedConventions,
              ...current.validatedConventions,
            ]),
          };
        }
        return acc;
      }, {});

      const userNotifications = await executeInSequence(
        toPairs(userIdReports),
        async ([
          userId,
          { conventionsToManage, newConventions, validatedConventions },
        ]) => {
          const user = await uow.userRepository.getById(userId);
          if (!user) throw errors.user.notFound({ userId });
          return {
            kind: "email",
            followedIds: { userId },
            templatedContent: {
              kind: "CONVENTION_SUMMARY",
              params: {
                conventionsToManage: conventionsToManage.length,
                newConventions: newConventions.length,
                validatedConventions: validatedConventions.length,
              },
              recipients: [user.email],
            },
          } satisfies NotificationContentAndFollowedIds;
        },
      );

      await saveNotificationsBatchAndRelatedEvent(uow, userNotifications, {
        priority: 1,
      });

      return userNotifications.length;
    },
  );

const makeReportAndNotifiedUsers = async (
  uow: UnitOfWork,
  now: Date,
  agencyId: AgencyId,
): Promise<{
  agencyId: AgencyId;
  notifiedUserIds: UserId[];
  conventionsToManage: ConventionId[];
  newConventions: ConventionId[];
  validatedConventions: ConventionId[];
}> => {
  const agency = await uow.agencyRepository.getById(agencyId);
  if (!agency) throw errors.agency.notFound({ agencyId });

  return {
    agencyId,
    notifiedUserIds: toPairs(agency.usersRights)
      .filter(([_, right]) => right?.isNotifiedByEmail)
      .map(([id, _]) => id),
    conventionsToManage: await getConventionsToManage(uow, now, agencyId),
    newConventions: await getNewConventions(uow, now, agencyId),
    validatedConventions: await getValidatedConventions(uow, now, agencyId),
  };
};

const getConventionsToManage = async (
  uow: UnitOfWork,
  now: Date,
  agencyId: AgencyId,
): Promise<ConventionId[]> => {
  const oneMonthAgo = subMonths(now, 1);
  const inFiveDays = addDays(now, 5);

  const referedAgencies =
    await uow.agencyRepository.getAgenciesRelatedToAgency(agencyId);

  const conventionIds = await uow.conventionQueries.getConventionIdsByFilters({
    filters: {
      withAgencyIds: [agencyId],
      withStatuses: ["IN_REVIEW", "ACCEPTED_BY_COUNSELLOR"],
      withDateStart: { from: oneMonthAgo, to: inFiveDays },
    },
  });

  const referedConventionIds =
    await uow.conventionQueries.getConventionIdsByFilters({
      filters: {
        withAgencyIds: referedAgencies.map(({ id }) => id),
        withStatuses: ["ACCEPTED_BY_COUNSELLOR"],
        withDateStart: { from: oneMonthAgo, to: inFiveDays },
      },
    });

  return [...conventionIds, ...referedConventionIds];
};

const getNewConventions = (
  uow: UnitOfWork,
  now: Date,
  agencyId: AgencyId,
): Promise<ConventionId[]> =>
  uow.conventionQueries.getConventionIdsByFilters({
    filters: {
      withAgencyIds: [agencyId],
    },
  });

const getValidatedConventions = (
  uow: UnitOfWork,
  now: Date,
  agencyId: AgencyId,
): Promise<ConventionId[]> =>
  uow.conventionQueries.getConventionIdsByFilters({
    filters: {
      withAgencyIds: [agencyId],
    },
  });
