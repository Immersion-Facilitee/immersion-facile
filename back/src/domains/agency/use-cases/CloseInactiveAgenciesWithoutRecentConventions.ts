import { startOfDay, subMonths } from "date-fns";
import { toPairs, uniq } from "ramda";
import {
  type AgencyWithUsersRights,
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

export type CloseInactiveAgenciesWithoutRecentConventionsInput = {
  numberOfMonthsWithoutConvention: number;
};

export type CloseInactiveAgenciesWithoutRecentConventionsResult = {
  numberOfAgenciesClosed: number;
};

export type CloseInactiveAgenciesWithoutRecentConventions = ReturnType<
  typeof makeCloseInactiveAgenciesWithoutRecentConventions
>;

const closeInactiveAgenciesWithoutRecentConventionsInputSchema = z.object({
  numberOfMonthsWithoutConvention: z.number(),
});

export const makeCloseInactiveAgenciesWithoutRecentConventions = useCaseBuilder(
  "CloseInactiveAgenciesWithoutRecentConventions",
)
  .withInput(closeInactiveAgenciesWithoutRecentConventionsInputSchema)
  .withOutput<CloseInactiveAgenciesWithoutRecentConventionsResult>()
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

    const filters = makeInactiveAgenciesFilters({
      updatedAtBefore: agencyNotUpdatedOrNoConventionSince,
    });

    const perPage = deps.batchSize;
    let page = 1;
    let totalPages = 1;
    const agenciesToClose: AgencyWithUsersRights[] = [];

    while (page <= totalPages) {
      await uowPerformer.perform(async (uow) => {
        const { data: activeAgencies, pagination } =
          await uow.agencyRepository.getAgencies({
            filters,
            pagination: { page, perPage },
          });
        totalPages = pagination.totalPages;

        const inactiveAgencies = await getInactiveAgenciesAmong({
          agencies: activeAgencies,
          uow,
          noConventionSince: agencyNotUpdatedOrNoConventionSince,
        });

        const agenciesWithValidWarning = (
          await executeInSequence(
            inactiveAgencies,
            async (agency): Promise<AgencyWithUsersRights | null> =>
              (await hasValidWarningOldEnoughToClose({
                agency,
                uow,
                warningMustHaveBeenSentBefore:
                  agencyNotUpdatedOrNoConventionSince,
              }))
                ? agency
                : null,
          )
        ).filter(isTruthy);

        agenciesToClose.push(...agenciesWithValidWarning);
      });
      page += 1;
    }

    let numberOfAgenciesClosed = 0;
    if (agenciesToClose.length > 0) {
      await uowPerformer.perform(async (uow) => {
        const notifications = await getNotificationsForClosedAgencies(
          agenciesToClose,
          uow,
          numberOfMonthsWithoutConvention,
        );

        await executeInSequence(agenciesToClose, (agency) =>
          uow.agencyRepository.update({
            id: agency.id,
            status: "closed",
            statusJustification:
              "Agence fermée automatiquement pour inactivité",
            updatedAt: now.toISOString(),
          }),
        );

        await deps.saveNotificationsBatchAndRelatedEvent(uow, notifications, {
          priority: 7,
        });
        numberOfAgenciesClosed += agenciesToClose.length;
      });
    }

    return { numberOfAgenciesClosed };
  });

const hasValidWarningOldEnoughToClose = async (params: {
  agency: AgencyWithUsersRights;
  uow: UnitOfWork;
  warningMustHaveBeenSentBefore: Date;
}): Promise<boolean> => {
  const { agency, uow, warningMustHaveBeenSentBefore } = params;

  const [lastWarning] = await uow.notificationRepository.getEmailsByFilters({
    agencyId: agency.id,
    emailType: "AGENCY_INACTIVITY_WARNING",
    limit: 1,
  });

  if (!lastWarning) {
    return false;
  }

  const lastWarningDate = new Date(lastWarning.createdAt);
  const isWarningOldEnough =
    startOfDay(lastWarningDate) <= startOfDay(warningMustHaveBeenSentBefore);

  if (!isWarningOldEnough) {
    return false;
  }

  return !(await isAgencyActiveAfterWarning({
    agency,
    warningCreatedAt: lastWarningDate,
    uow,
  }));
};

const getNotificationsForClosedAgencies = async (
  agencies: AgencyWithUsersRights[],
  uow: UnitOfWork,
  numberOfMonthsWithoutConvention: number,
): Promise<NotificationContentAndFollowedIds[]> => {
  const agenciesWithAdmins = agencies
    .map((agency) => {
      const agencyAdminUserIds: UserId[] = toPairs(agency.usersRights)
        .filter(([_, rights]) => rights?.roles.includes("agency-admin"))
        .map(([userId]) => userId)
        .filter(isTruthy);

      return agencyAdminUserIds.length > 0
        ? { agency, adminUserIds: agencyAdminUserIds }
        : null;
    })
    .filter(isTruthy);

  if (agenciesWithAdmins.length === 0) {
    return [];
  }

  const allAdminUserIds = uniq(
    agenciesWithAdmins.flatMap(({ adminUserIds }) => adminUserIds),
  );

  if (allAdminUserIds.length === 0) {
    return [];
  }

  const allAdminUsers = await uow.userRepository.getByIds(allAdminUserIds);
  const adminUsersById = allAdminUsers.reduce<
    Record<UserId, UserWithAdminRights>
  >((acc, user) => {
    acc[user.id] = user;
    return acc;
  }, {});

  return agenciesWithAdmins
    .map(
      ({ agency, adminUserIds }): NotificationContentAndFollowedIds | null => {
        const adminEmails = adminUserIds
          .map((userId) => adminUsersById[userId]?.email)
          .filter(isTruthy);

        return adminEmails.length > 0
          ? {
              kind: "email",
              templatedContent: {
                kind: "AGENCY_CLOSED_FOR_INACTIVITY",
                recipients: adminEmails,
                params: {
                  agencyName: agency.name,
                  numberOfMonthsWithoutConvention:
                    numberOfMonthsWithoutConvention,
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
