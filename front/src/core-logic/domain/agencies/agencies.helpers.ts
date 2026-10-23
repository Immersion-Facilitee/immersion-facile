import {
  type AgencyId,
  type AgencyRole,
  type AgencyUserForListing,
  type ConnectedUser,
  hasAllowedRole,
  toAgencyRightsByAgencyId,
} from "shared";

export const hasCounsellorRoles = ({
  users,
  agencyId,
}: {
  users: {
    agencyRightsByAgencyId: Record<AgencyId, { roles: AgencyRole[] }>;
  }[];
  agencyId: AgencyId;
}): boolean =>
  users.some((user) =>
    hasAllowedRole({
      allowedRoles: ["counsellor"],
      candidateRoles: user.agencyRightsByAgencyId[agencyId]?.roles ?? [],
    }),
  );

export const toAgencyUserForListing = ({
  proConnect,
  dashboards: _,
  establishments: __,
  isBackofficeAdmin: ___,
  createdAt: ____,
  lastLoginAt: _____,
  preventToDelete: ______,
  agencyRights,
  ...user
}: ConnectedUser): AgencyUserForListing => ({
  ...user,
  isProConnectUser: proConnect !== null,
  agencyRightsByAgencyId: toAgencyRightsByAgencyId(agencyRights),
});
