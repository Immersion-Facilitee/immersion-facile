import { subMonths } from "date-fns";
import { toPairs, uniq } from "ramda";
import {
  type AgencyKind,
  type AgencyStatus,
  type AgencyWithUsersRights,
  type ConventionStatus,
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
    const noConventionSince = subMonths(now, numberOfMonthsWithoutConvention);

    const filters = {
      status: ["active", "from-api-PE"] satisfies AgencyStatus[],
      kinds: [
        "mission-locale",
        "operateur-cep",
        "cap-emploi",
        "conseil-departemental",
        "structure-IAE",
        "fonction-publique",
        "cci",
        "cma",
        "chambre-agriculture",
        "autre",
      ] satisfies AgencyKind[],
      createdAtBefore: noConventionSince,
    };

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
        agenciesToClose.push(
          ...(await getAgenciesToClose(activeAgencies, uow, noConventionSince)),
        );
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

const validConventionStatuses: ConventionStatus[] = [
  "ACCEPTED_BY_VALIDATOR",
  "IN_REVIEW",
  "PARTIALLY_SIGNED",
  "ACCEPTED_BY_COUNSELLOR",
  "READY_TO_SIGN",
];

const getAgenciesToClose = async (
  agencies: AgencyWithUsersRights[],
  uow: UnitOfWork,
  noConventionSince: Date,
): Promise<AgencyWithUsersRights[]> => {
  const agenciesToCloseResults = await executeInSequence(
    agencies,
    async (agency): Promise<AgencyWithUsersRights | null> => {
      const agencyConventionIds =
        await uow.conventionQueries.getConventionIdsByFilters({
          filters: {
            withAgencyIds: [agency.id],
            withStatuses: [...validConventionStatuses],
            withDateSubmission: { from: noConventionSince },
          },
          limit: 1,
        });

      if (agencyConventionIds.length === 0) {
        const referringAgencies =
          await uow.agencyRepository.getAgenciesRelatedToAgency(agency.id);

        if (referringAgencies.length === 0) return agency;

        const referringAgenciesConventionIds =
          await uow.conventionQueries.getConventionIdsByFilters({
            filters: {
              withAgencyIds: referringAgencies.map(
                (referringAgency) => referringAgency.id,
              ),
              withStatuses: [...validConventionStatuses],
              withDateSubmission: { from: noConventionSince },
            },
            limit: 1,
          });

        if (referringAgenciesConventionIds.length === 0) return agency;
      }

      return null;
    },
  );

  return agenciesToCloseResults.filter(isTruthy);
};
