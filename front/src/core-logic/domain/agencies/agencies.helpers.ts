import {
  type AgencyId,
  type ConnectedUser,
  errors,
  type UserParamsForAgency,
} from "shared";
import type { ConnectedUserWithNormalizedAgencyRights } from "src/core-logic/domain/admin/connectedUsersAdmin/connectedUsersAdmin.slice";

export const updateUserAgencyRights = (
  user: ConnectedUser,
  requestedUpdate: UserParamsForAgency,
): ConnectedUser => {
  const remainingAgencyRights = user.agencyRights.filter(
    (agencyRight) => agencyRight.agency.id !== requestedUpdate.agencyId,
  );
  const updatedAgencyRight = user.agencyRights.find(
    (agencyRight) => agencyRight.agency.id === requestedUpdate.agencyId,
  );
  if (!updatedAgencyRight)
    throw errors.agency.notFound({ agencyId: requestedUpdate.agencyId });
  return {
    ...user,
    email: requestedUpdate.email,
    agencyRights: [
      ...remainingAgencyRights,
      {
        ...updatedAgencyRight,
        isNotifiedByEmail: requestedUpdate.isNotifiedByEmail,
        roles: requestedUpdate.roles,
      },
    ],
  };
};

export const hasCounsellorRoles = ({
  users,
  agencyId,
}: {
  users: ConnectedUserWithNormalizedAgencyRights[];
  agencyId: AgencyId;
}) =>
  users.some((user) =>
    user.agencyRights[agencyId]?.roles.includes("counsellor"),
  );
