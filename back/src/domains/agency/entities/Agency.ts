import { toPairs } from "ramda";
import type {
  AgencyRole,
  AgencyUsersRights,
  ConnectedUser,
  UserId,
} from "shared";

export const getUserIdsWithoutRoleFromAgencyRights = ({
  rights,
  excludedRole,
}: {
  rights: AgencyUsersRights;
  excludedRole: AgencyRole;
}): UserId[] =>
  toPairs(rights).reduce<UserId[]>(
    (acc, [userId, right]) => [
      ...acc,
      ...(right?.roles.includes(excludedRole) ? [] : [userId]),
    ],
    [],
  );

export const isFTUser = (currentUser: ConnectedUser) =>
  currentUser.email.includes("@francetravail.fr");
