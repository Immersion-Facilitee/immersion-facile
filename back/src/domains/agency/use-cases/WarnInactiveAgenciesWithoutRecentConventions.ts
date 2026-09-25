import { startOfDay, subMonths } from "date-fns";
import { toPairs, uniq } from "ramda";
import {
  type AgencyWithUsersRights,
  type Email,
  executeInSequence,
  isTruthy,
  type UserId,
  type UserWithAdminRights,
} from "shared";
import { z } from "zod";
import type {
  NotificationContentAndFollowedIds,
  SaveNotificationsBatchAndRelatedEvent,
} from "../../core/notifications/helpers/Notification";
import type { TimeGateway } from "../../core/time-gateway/ports/TimeGateway";
import type { UnitOfWork } from "../../core/unit-of-work/ports/UnitOfWork";
import type { UnitOfWorkPerformer } from "../../core/unit-of-work/ports/UnitOfWorkPerformer";
import { useCaseBuilder } from "../../core/useCaseBuilder";
import {
  getInactiveAgenciesAmong,
  isAgencyActiveAfterWarning,
  makeInactiveAgenciesFilters,
} from "../helpers/inactiveAgencies.helpers";
import type { GetAgenciesFilters } from "../ports/AgencyRepository";

export type WarnInactiveAgenciesWithoutRecentConventionsInput = {
  numberOfMonthsWithoutConvention: number;
};

export type WarnInactiveAgenciesWithoutRecentConventionsResult = {
  numberOfAgenciesWarned: number;
};

export type WarnInactiveAgenciesWithoutRecentConventions = ReturnType<
  typeof makeWarnInactiveAgenciesWithoutRecentConventions
>;

const warnInactiveAgenciesWithoutRecentConventionsInputSchema = z.object({
  numberOfMonthsWithoutConvention: z.number(),
});

export const makeWarnInactiveAgenciesWithoutRecentConventions = useCaseBuilder(
  "WarnInactiveAgenciesWithoutRecentConventions",
)
  .withInput(warnInactiveAgenciesWithoutRecentConventionsInputSchema)
  .withOutput<WarnInactiveAgenciesWithoutRecentConventionsResult>()
  .withDeps<{
    uowPerformer: UnitOfWorkPerformer;
    timeGateway: TimeGateway;
    saveNotificationsBatchAndRelatedEvent: SaveNotificationsBatchAndRelatedEvent;
    batchSize: number;
  }>()
  .notTransactional()
  .build(async ({ deps, inputParams }) => {
    const { uowPerformer } = deps;
    const { numberOfMonthsWithoutConvention } = inputParams;
    const now = deps.timeGateway.now();
    const agencyNotUpdatedOrNoConventionSince = subMonths(
      now,
      numberOfMonthsWithoutConvention,
    );

    const agencyFilters = makeInactiveAgenciesFilters({
      updatedAtBefore: agencyNotUpdatedOrNoConventionSince,
    });

    const perPage = deps.batchSize;

    const firstPageAgencies = await getAgenciesNeedingWarning({
      page: 1,
      uowPerformer,
      filters: {
        agencyFilters,
        noConventionSince: agencyNotUpdatedOrNoConventionSince,
      },
      perPage,
      now,
      numberOfMonthsWithoutConvention,
    });
    const remainingPagesAgencies = await executeInSequence(
      Array.from(
        { length: Math.max(firstPageAgencies.totalPages - 1, 0) },
        (_, index) => index + 2,
      ),
      (page) =>
        getAgenciesNeedingWarning({
          page,
          uowPerformer,
          filters: {
            agencyFilters,
            noConventionSince: agencyNotUpdatedOrNoConventionSince,
          },
          perPage,
          now,
          numberOfMonthsWithoutConvention,
        }),
    );

    const agenciesToWarn = [
      ...firstPageAgencies.agenciesNeedingWarning,
      ...remainingPagesAgencies.flatMap(
        ({ agenciesNeedingWarning }) => agenciesNeedingWarning,
      ),
    ];

    if (agenciesToWarn.length === 0) {
      return { numberOfAgenciesWarned: 0 };
    }

    const numberOfAgenciesWarned = await uowPerformer.perform(async (uow) => {
      const notifications = await buildWarningNotificationsForAgencies({
        agencies: agenciesToWarn,
        uow,
      });

      await deps.saveNotificationsBatchAndRelatedEvent(uow, notifications, {
        priority: 7,
      });

      return notifications.length;
    });

    return { numberOfAgenciesWarned };
  });

const getNotifiableUserIds = (agency: AgencyWithUsersRights): UserId[] =>
  toPairs(agency.usersRights)
    .filter(([_, rights]) => rights && !rights.roles.includes("to-review"))
    .map(([userId]) => userId);

const buildWarningNotificationsForAgencies = async ({
  agencies,
  uow,
}: {
  agencies: AgencyWithUsersRights[];
  uow: UnitOfWork;
}): Promise<NotificationContentAndFollowedIds[]> => {
  const agenciesWithNotifiableUsers = agencies
    .map((agency) => {
      const notifiableUserIds = getNotifiableUserIds(agency);
      return notifiableUserIds.length > 0
        ? { agency, notifiableUserIds }
        : null;
    })
    .filter(isTruthy);

  if (agenciesWithNotifiableUsers.length === 0) {
    return [];
  }

  const allNotifiableUserIds: UserId[] = uniq(
    agenciesWithNotifiableUsers.flatMap(
      ({ notifiableUserIds }) => notifiableUserIds,
    ),
  );

  const allNotifiableUsers: UserWithAdminRights[] =
    await uow.userRepository.getByIds(allNotifiableUserIds);
  const emailsByUserId: Record<UserId, Email> = allNotifiableUsers.reduce<
    Record<UserId, Email>
  >((acc, user) => {
    acc[user.id] = user.email;
    return acc;
  }, {});

  return agenciesWithNotifiableUsers
    .map(
      ({
        agency,
        notifiableUserIds,
      }): NotificationContentAndFollowedIds | null => {
        const emails = uniq(
          notifiableUserIds
            .map((userId) => emailsByUserId[userId])
            .filter(isTruthy),
        );

        return emails.length > 0
          ? {
              kind: "email",
              templatedContent: {
                kind: "AGENCY_INACTIVITY_WARNING",
                bcc: emails,
                params: {
                  agencyName: agency.name,
                },
              },
              followedIds: {
                agencyId: agency.id,
              },
            }
          : null;
      },
    )
    .filter(isTruthy);
};

const isWarningNeeded = async (params: {
  agency: AgencyWithUsersRights;
  uow: UnitOfWork;
  now: Date;
  numberOfMonthsWithoutConvention: number;
}): Promise<boolean> => {
  const { agency, uow, now, numberOfMonthsWithoutConvention } = params;

  const [lastWarning] = await uow.notificationRepository.getEmailsByFilters({
    agencyId: agency.id,
    emailType: "AGENCY_INACTIVITY_WARNING",
    limit: 1,
  });

  if (!lastWarning) return true;

  const lastWarningDate = new Date(lastWarning.createdAt);
  const isWarnedRecently =
    startOfDay(lastWarningDate) >=
    startOfDay(subMonths(now, numberOfMonthsWithoutConvention));

  if (isWarnedRecently) return false;

  return !(await isAgencyActiveAfterWarning({
    agency,
    warningCreatedAt: lastWarningDate,
    uow,
  }));
};

const getAgenciesNeedingWarning = async ({
  page,
  uowPerformer,
  filters,
  perPage,
  now,
  numberOfMonthsWithoutConvention,
}: {
  page: number;
  uowPerformer: UnitOfWorkPerformer;
  filters: { agencyFilters: GetAgenciesFilters; noConventionSince: Date };
  perPage: number;
  now: Date;
  numberOfMonthsWithoutConvention: number;
}): Promise<{
  agenciesNeedingWarning: AgencyWithUsersRights[];
  totalPages: number;
}> =>
  uowPerformer.perform(async (uow) => {
    const { data: activeAgencies, pagination } =
      await uow.agencyRepository.getAgencies({
        filters: filters.agencyFilters,
        pagination: { page, perPage },
      });

    const inactiveAgencies = await getInactiveAgenciesAmong({
      agencies: activeAgencies,
      uow,
      noConventionSince: filters.noConventionSince,
    });

    const agenciesNeedingWarning = (
      await executeInSequence(
        inactiveAgencies,
        async (agency): Promise<AgencyWithUsersRights | null> =>
          (await isWarningNeeded({
            agency,
            uow,
            now,
            numberOfMonthsWithoutConvention,
          }))
            ? agency
            : null,
      )
    ).filter(isTruthy);

    return {
      agenciesNeedingWarning,
      totalPages: pagination.totalPages,
    };
  });
