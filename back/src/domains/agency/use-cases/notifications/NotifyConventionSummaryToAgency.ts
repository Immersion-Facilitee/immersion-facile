import { addDays, startOfDay, subDays, subMonths } from "date-fns";
import { toPairs } from "ramda";
import {
  type AgencyId,
  type ConventionId,
  errors,
  executeInSequence,
} from "shared";
import type { AppConfig } from "../../../../config/bootstrap/appConfig";
import type {
  NotificationContentAndFollowedIds,
  SaveNotificationsBatchAndRelatedEvent,
} from "../../../core/notifications/helpers/Notification";
import type { TimeGateway } from "../../../core/time-gateway/ports/TimeGateway";
import type { UnitOfWork } from "../../../core/unit-of-work/ports/UnitOfWork";
import { useCaseBuilder } from "../../../core/useCaseBuilder";

export type NotifyConventionSummaryToAgency = ReturnType<
  typeof makeNotifyConventionSummaryToAgency
>;
export const makeNotifyConventionSummaryToAgency = useCaseBuilder(
  "NotifyConventionSummaryToAgency",
)
  .withDeps<{
    timeGateway: TimeGateway;
    saveNotificationsBatchAndRelatedEvent: SaveNotificationsBatchAndRelatedEvent;
    appConfig: AppConfig;
  }>()
  .withOutput<number>()
  .build(
    async ({
      uow,
      deps: { timeGateway, saveNotificationsBatchAndRelatedEvent, appConfig },
    }) => {
      const now = timeGateway.now();
      const activeAgencyIds = await uow.agencyRepository.getAgencyIdsByFilters({
        statuses: ["active", "from-api-PE"],
      });

      const notificationsByAgency = await executeInSequence(
        activeAgencyIds,
        (agencyId) =>
          makeNotificationsForAgency({ uow, now, agencyId, appConfig }),
      );

      await saveNotificationsBatchAndRelatedEvent(
        uow,
        notificationsByAgency.flat(),
        {
          priority: 1,
        },
      );

      return notificationsByAgency.length;
    },
  );

const makeNotificationsForAgency = async ({
  agencyId,
  now,
  uow,
  appConfig,
}: {
  uow: UnitOfWork;
  now: Date;
  agencyId: AgencyId;
  appConfig: AppConfig;
}): Promise<NotificationContentAndFollowedIds[]> => {
  const agency = await uow.agencyRepository.getById(agencyId);
  if (!agency) throw errors.agency.notFound({ agencyId });

  const notifiedUsers = await uow.userRepository.getByIds(
    toPairs(agency.usersRights)
      .filter(([_, right]) => right?.isNotifiedByEmail)
      .map(([id, _]) => id),
  );

  const conventionsToManage = (await getConventionsToManage(uow, now, agencyId))
    .length;
  const conventionsToReview = (await getConventionsToReview(uow, now, agencyId))
    .length;
  const newConventions = (await getNewConventions(uow, now, agencyId)).length;
  const validatedConventions = (
    await getValidatedConventions(uow, now, agencyId)
  ).length;

  if (
    conventionsToManage +
      conventionsToReview +
      newConventions +
      validatedConventions ===
    0
  )
    return [];

  return notifiedUsers.map((user) => ({
    kind: "email",
    followedIds: {
      agencyId,
    },
    templatedContent: {
      kind: "CONVENTION_SUMMARY_NOTIFICATION_TO_AGENCY",
      recipients: [user.email],
      params: {
        domain: appConfig.immersionFacileDomain,
        agencyName: agency.name,
        conventionsToManage,
        conventionsToReview,
        newConventions,
        validatedConventions,
      },
    },
  }));
};

const getConventionsToManage = async (
  uow: UnitOfWork,
  now: Date,
  agencyId: AgencyId,
): Promise<ConventionId[]> => {
  const oneMonthAgo = subMonths(now, 1);
  const inFiveDays = addDays(now, 5);

  const conventionIds = await uow.conventionQueries.getConventionIdsByFilters({
    filters: {
      withAgencyIds: [agencyId],
      withStatuses: [
        "READY_TO_SIGN",
        "PARTIALLY_SIGNED",
        "IN_REVIEW",
        "ACCEPTED_BY_COUNSELLOR",
      ],
      withDateStart: { from: oneMonthAgo, to: inFiveDays },
    },
  });

  const referedAgencies =
    await uow.agencyRepository.getAgenciesRelatedToAgency(agencyId);

  const referedConventionIds =
    referedAgencies.length > 0
      ? await uow.conventionQueries.getConventionIdsByFilters({
          filters: {
            withAgencyIds: referedAgencies.map(({ id }) => id),
            withStatuses: ["ACCEPTED_BY_COUNSELLOR"],
            withDateStart: { from: oneMonthAgo, to: inFiveDays },
          },
        })
      : [];

  return [...conventionIds, ...referedConventionIds];
};

const getConventionsToReview = async (
  uow: UnitOfWork,
  now: Date,
  agencyId: AgencyId,
): Promise<ConventionId[]> => {
  const oneMonthAgo = subMonths(now, 1);

  const conventionIds = await uow.conventionQueries.getConventionIdsByFilters({
    filters: {
      withAgencyIds: [agencyId],
      withStatuses: ["IN_REVIEW", "ACCEPTED_BY_COUNSELLOR"],
      withDateStart: { from: oneMonthAgo },
    },
  });

  const referedAgencies =
    await uow.agencyRepository.getAgenciesRelatedToAgency(agencyId);

  const referedConventionIds =
    referedAgencies.length > 0
      ? await uow.conventionQueries.getConventionIdsByFilters({
          filters: {
            withAgencyIds: referedAgencies.map(({ id }) => id),
            withStatuses: ["ACCEPTED_BY_COUNSELLOR"],
            withDateStart: { from: oneMonthAgo },
          },
        })
      : [];

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
      withStatuses: ["PARTIALLY_SIGNED", "READY_TO_SIGN"],
      withDateSubmission: { from: startOfDay(subDays(now, 1)) },
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
      withStatuses: ["ACCEPTED_BY_VALIDATOR"],
      withValidationDate: { from: startOfDay(subDays(now, 1)) },
    },
  });
