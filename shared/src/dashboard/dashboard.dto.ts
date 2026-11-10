import type { AbsoluteUrl } from "../AbsoluteUrl";
import type { AgencyDashboards } from "../agency/agency.dto";
import type { ConventionId } from "../convention/convention.dto";
import type { EstablishmentDashboards } from "../establishment/establishment.dto";
import type { UserId } from "../user/user.dto";

export type DashboardName =
  | AdminDashboardName
  | ConventionMagicLinkDashboardName
  | EstablishmentDashboardName
  | AgencyDashboardName;

export type EstablishmentDashboardName =
  (typeof establishmentDashboardNames)[number];

export const establishmentDashboardNames = [
  "establishmentRepresentativeConventions",
  "establishmentRepresentativeDiscussions",
] as const;

export type AgencyDashboardName = (typeof agencyDashboardNames)[number];
export const agencyDashboardNames = [
  "agencyForUser",
  "erroredConventionsForUser",
  "statsEstablishmentDetails",
  "agencyManagement",
  "establishmentManagement",
] as const;

export const adminDashboardNames = [
  "adminConventions",
  "adminEvents",
  "adminEstablishments",
] as const;

export type AdminDashboardName = (typeof adminDashboardNames)[number];

export type ConventionMagicLinkDashboardName =
  (typeof conventionMagicLinkDashboardNames)[number];
export const conventionMagicLinkDashboardNames = ["conventionStatus"] as const;

export const allDashboardNames = [
  ...adminDashboardNames,
  ...establishmentDashboardNames,
  ...conventionMagicLinkDashboardNames,
] as const;

type GenericGetDashboardParams<N extends DashboardName> = {
  name: N;
};

export type GetDashboardParams =
  | GetAdminDashboardParams
  | GetConventionMagicLinkDashboardParams
  | GetEstablishmentDashboardParams;

export type DashboardUrlAndName = {
  name: DashboardName;
  url: AbsoluteUrl;
};

export type GetEstablishmentDashboardParams =
  GenericGetDashboardParams<"establishmentRepresentativeConventions"> & {
    ic_user_id: UserId;
  };

export type GetAdminDashboardParams =
  GenericGetDashboardParams<AdminDashboardName>;

export type GetConventionMagicLinkDashboardParams =
  GenericGetDashboardParams<"conventionStatus"> & {
    conventionId: ConventionId;
  };

export const noAgencyDashboards: AgencyDashboards = {
  agencyDashboardUrl: null,
  agencyManagement: null,
  erroredConventionsDashboardUrl: null,
  establishmentManagement: null,
  statsEstablishmentDetailsUrl: null,
};

export const noEstablishmentDashboard: EstablishmentDashboards = {
  conventions: null,
  discussions: null,
};
