import { keys, toPairs, uniq, values } from "ramda";
import {
  type AbsoluteUrl,
  type AgencyDashboards,
  type AgencyId,
  type AgencyRight,
  type AgencyWithUsersRights,
  agencyRoleIsNotToReview,
  type ConnectedUser,
  type Email,
  type EstablishmentDashboards,
  type User,
  type UserId,
  type UserWithAdminRights,
  type UserWithRights,
  type WithDashboards,
} from "shared";
import type { AgencyRightOfUser } from "../../agency/ports/AgencyRepository";
import { emptyName } from "../../core/authentication/connected-user/entities/user.helper";
import type { UserRepository } from "../../core/authentication/connected-user/port/UserRepository";
import type { DashboardGateway } from "../../core/dashboard/port/DashboardGateway";
import type { TimeGateway } from "../../core/time-gateway/ports/TimeGateway";
import type { UnitOfWork } from "../../core/unit-of-work/ports/UnitOfWork";
import { getUserWithRights } from "./userRights.helper";

export const getConnectedUserByUserId = async ({
  uow,
  userId,
  dashboardGateway,
  timeGateway,
}: {
  uow: UnitOfWork;
  userId: UserId;
  dashboardGateway: DashboardGateway;
  timeGateway: TimeGateway;
}): Promise<ConnectedUser> => {
  const user = await getUserWithRights(uow, userId);

  return {
    ...user,
    ...(await withDashboards({ uow, dashboardGateway, timeGateway, user })),
  };
};

export const getConnectedUsersByUserIds = async (
  uow: UnitOfWork,
  userIds: UserId[],
  agencyIds: AgencyId[],
): Promise<ConnectedUser[]> => {
  const users = await uow.userRepository.getByIds(userIds);

  const userRightsByUser = (
    await Promise.all(
      userIds.map(async (userId) => ({
        userId,
        rights: await uow.agencyRepository.getAgenciesRightsByUserId(userId),
      })),
    )
  ).reduce<Record<UserId, AgencyRightOfUser[]>>(
    (acc, current) => ({ ...acc, [current.userId]: current.rights }),
    {},
  );

  const agenciesRelatedToUsersByAgencyId = (
    await uow.agencyRepository.getByIds(
      uniq(
        values(userRightsByUser)
          .flatMap((rights) => rights.map(({ agencyId }) => agencyId))
          .filter(
            (userAgencyId) =>
              agencyIds.length === 0 || agencyIds.includes(userAgencyId),
          ),
      ),
    )
  ).reduce<Record<AgencyId, AgencyWithUsersRights>>(
    (acc, current) => ({ ...acc, [current.id]: current }),
    {},
  );

  return Promise.all(
    users.map<Promise<ConnectedUser>>(async (user) => ({
      ...user,
      agencyRights: await makeAgencyRights(
        userRightsByUser[user.id],
        agenciesRelatedToUsersByAgencyId,
        uow,
      ),
      dashboards: {
        agencies: {
          agencyDashboardUrl: null,
          agencyManagement: null,
          erroredConventionsDashboardUrl: null,
          establishmentManagement: null,
          statsEstablishmentDetailsUrl: null,
        },
        establishments: {
          conventions: null,
          discussions: null,
        },
      },
    })),
  );
};

const makeAgencyRights = (
  userRights: AgencyRightOfUser[],
  agenciesRelatedToUsersByAgencyId: Record<AgencyId, AgencyWithUsersRights>,
  uow: UnitOfWork,
): Promise<AgencyRight[]> => {
  const agencyIds = keys(agenciesRelatedToUsersByAgencyId);
  return Promise.all(
    userRights
      .filter((userRight) => agencyIds.includes(userRight.agencyId))
      .map<Promise<AgencyRight>>(async ({ agencyId, ...rights }) => {
        const { usersRights, ...agency } =
          agenciesRelatedToUsersByAgencyId[agencyId];

        const adminUsers = await uow.userRepository.getByIds(
          toPairs(usersRights)
            .filter(([_, userRight]) =>
              userRight?.roles.includes("agency-admin"),
            )
            .map(([id]) => id),
        );

        return {
          ...rights,
          agency: {
            ...agency,
            admins: adminUsers.map((user) => user.email),
          },
        };
      }),
  );
};

async function makeAgencyDashboards({
  uow,
  dashboardGateway,
  timeGateway,
  user,
}: {
  uow: UnitOfWork;
  dashboardGateway: DashboardGateway;
  timeGateway: TimeGateway;
  user: UserWithRights;
}): Promise<AgencyDashboards> {
  const agencyIdsWithEnoughPrivileges = user.agencyRights
    .filter(({ roles }) => agencyRoleIsNotToReview(roles))
    .map(({ agency }) => agency.id);

  const agencyKinds = uniq(
    user.agencyRights
      .filter(({ roles }) => agencyRoleIsNotToReview(roles))
      .map(({ agency }) => agency.kind),
  );
  const agencyIds = uniq(
    user.agencyRights
      .filter(({ roles }) => agencyRoleIsNotToReview(roles))
      .map(({ agency }) => agency.id),
  );

  const isSynchronisationEnableForAgency =
    agencyKinds.includes("france-travail") ||
    (
      await uow.apiConsumerRepository.getByFilters({
        agencyIds,
        agencyKinds,
      })
    ).length > 0;

  return {
    ...(agencyIdsWithEnoughPrivileges.length > 0
      ? dashboardGateway.getAgencyUserUrls(
          user.id,
          user.agencyRights.map((right) => right.agency.name),
          timeGateway.now(),
        )
      : {
          agencyDashboardUrl: null,
          agencyManagement: null,
          establishmentManagement: null,
          statsEstablishmentDetailsUrl: null,
        }),
    erroredConventionsDashboardUrl:
      agencyIdsWithEnoughPrivileges.length > 0 &&
      isSynchronisationEnableForAgency
        ? dashboardGateway.getErroredConventionsDashboardUrl(
            user.id,
            timeGateway.now(),
          )
        : null,
  };
}

const withDashboards = async ({
  uow,
  dashboardGateway,
  timeGateway,
  user,
}: {
  uow: UnitOfWork;
  dashboardGateway: DashboardGateway;
  timeGateway: TimeGateway;
  user: UserWithRights;
}): Promise<WithDashboards> => ({
  dashboards: {
    agencies: await makeAgencyDashboards({
      uow,
      dashboardGateway,
      timeGateway,
      user,
    }),
    establishments: await makeEstablishmentDashboard(
      uow,
      dashboardGateway,
      timeGateway,
      user,
    ),
  },
});

const makeEstablishmentDashboard = async (
  uow: UnitOfWork,
  dashboardGateway: DashboardGateway,
  timeGateway: TimeGateway,
  user: User,
): Promise<EstablishmentDashboards> => {
  const establishmentAggregates =
    await uow.establishmentAggregateRepository.getEstablishmentAggregatesByFilters(
      {
        userId: user.id,
      },
    );

  const userHasEstablishmentRights =
    establishmentAggregates.filter((establishmentAggregate) =>
      establishmentAggregate.userRights.some(
        ({ status, userId }) => status === "ACCEPTED" && userId === user.id,
      ),
    ).length > 0;
  const [conventions, discussions] = await Promise.all([
    makeConventionEstablishmentDashboard({
      uow: uow,
      dashboardGateway: dashboardGateway,
      timeGateway: timeGateway,
      user,
      userHasEstablishmentRights,
    }),
    makeDiscussionsEstablishmentDashboard({
      dashboardGateway: dashboardGateway,
      timeGateway: timeGateway,
      user: user,
      userHasEstablishmentRights,
    }),
  ]);

  return {
    conventions,
    discussions,
  };
};

const makeConventionEstablishmentDashboard = async ({
  uow,
  dashboardGateway,
  timeGateway,
  user,
  userHasEstablishmentRights,
}: {
  uow: UnitOfWork;
  dashboardGateway: DashboardGateway;
  timeGateway: TimeGateway;
  user: User;
  userHasEstablishmentRights: boolean;
}): Promise<AbsoluteUrl | null> => {
  const conventionDashboardUrl =
    dashboardGateway.getEstablishmentConventionsDashboardUrl(
      user.id,
      timeGateway.now(),
    );

  if (userHasEstablishmentRights) return conventionDashboardUrl;

  const hasConventionForEstablishmentRepresentative =
    (
      await uow.conventionQueries.getConventionIdsByFilters({
        filters: {
          withEstablishmentRepresentative: { email: user.email },
        },
      })
    ).length > 0;

  if (hasConventionForEstablishmentRepresentative)
    return conventionDashboardUrl;

  const hasConventionForEstablishmentTutor =
    (
      await uow.conventionQueries.getConventionIdsByFilters({
        filters: {
          withEstablishmentTutor: { email: user.email },
        },
      })
    ).length > 0;

  return hasConventionForEstablishmentTutor ? conventionDashboardUrl : null;
};

const makeDiscussionsEstablishmentDashboard = async ({
  dashboardGateway,
  timeGateway,
  user,
  userHasEstablishmentRights,
}: {
  dashboardGateway: DashboardGateway;
  timeGateway: TimeGateway;
  user: User;
  userHasEstablishmentRights: boolean;
}): Promise<AbsoluteUrl | null> =>
  userHasEstablishmentRights
    ? dashboardGateway.getEstablishmentDiscussionsDashboardUrl(
        user.id,
        timeGateway.now(),
      )
    : null;

export const getUserByEmailAndCreateIfMissing = async ({
  userRepository,
  timeGateway,
  userIdIfNew,
  userEmail,
}: {
  userRepository: UserRepository;
  timeGateway: TimeGateway;
  userIdIfNew: UserId;
  userEmail: string;
}): Promise<User> =>
  (await userRepository.findByEmail(userEmail)) ||
  (await saveAndProvideNewUser(userRepository, {
    id: userIdIfNew,
    email: userEmail,
    createdAt: timeGateway.now().toISOString(),
    firstName: emptyName,
    lastName: emptyName,
    proConnect: null,
  }));

const saveAndProvideNewUser = async (
  userRepository: UserRepository,
  newUser: UserWithAdminRights,
) => {
  await userRepository.save(newUser);
  return newUser;
};

export const usersToEmails = (users: UserWithAdminRights[]): Email[] =>
  users.map(({ email }) => email);
