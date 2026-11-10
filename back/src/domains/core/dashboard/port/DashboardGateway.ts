import type {
  AbsoluteUrl,
  AdminDashboardName,
  AgencyDashboards,
  ConventionId,
  OmitFromExistingKeys,
  UserId,
} from "shared";

export interface DashboardGateway {
  getAdminDashboardUrl(
    adminDashboardKind: AdminDashboardName,
    now: Date,
  ): AbsoluteUrl;
  getAgencyUserUrls(
    userId: UserId,
    agencyNames: string[],
    now: Date,
  ): OmitFromExistingKeys<AgencyDashboards, "erroredConventionsDashboardUrl">;
  getErroredConventionsDashboardUrl(userId: UserId, now: Date): AbsoluteUrl;
  getConventionStatusUrl(id: ConventionId, now: Date): AbsoluteUrl;
  getEstablishmentConventionsDashboardUrl(
    userId: UserId,
    now: Date,
  ): AbsoluteUrl;
  getEstablishmentDiscussionsDashboardUrl(
    userId: UserId,
    now: Date,
  ): AbsoluteUrl;
}
