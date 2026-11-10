import type {
  AbsoluteUrl,
  AdminDashboardName,
  AgencyDashboards,
  ConventionId,
  OmitFromExistingKeys,
  UserId,
} from "shared";
import type { DashboardGateway } from "../port/DashboardGateway";

export class StubDashboardGateway implements DashboardGateway {
  getAgencyUserUrls(
    userId: UserId,
    agencyNames: string[],
    now: Date,
  ): OmitFromExistingKeys<AgencyDashboards, "erroredConventionsDashboardUrl"> {
    return {
      agencyDashboardUrl: `http://stub-metabasev1/AgencyUserDashboard/${userId}/${now}`,
      statsEstablishmentDetailsUrl: `http://stub-metabasev1/EstablishmentDashboard/${now}`,
      agencyManagement: `http://stub-metabasev2/ManageMyAgency/${now}/${agencyNames.join()}`,
      establishmentManagement: `http://stub-metabasev2/ManageMyEstablishments/${now}`,
    };
  }
  getErroredConventionsDashboardUrl(
    userId: UserId,
    now: Date,
  ): `http://${string}` | `https://${string}` {
    return `http://stubErroredConventionDashboard/${userId}/${now}`;
  }

  public getConventionStatusUrl(id: ConventionId, now: Date): AbsoluteUrl {
    return `http://stubConventionStatusDashboard/${id}/${now}`;
  }

  public getAdminDashboardUrl(
    adminDashboardKind: AdminDashboardName,
    now: Date,
  ): AbsoluteUrl {
    return `http://stubDashboard/${adminDashboardKind}/${now}`;
  }

  public getEstablishmentConventionsDashboardUrl(
    userId: UserId,
    now: Date,
  ): AbsoluteUrl {
    return `http://stubEstablishmentConventionsDashboardUrl/${userId}/${now}`;
  }

  public getEstablishmentDiscussionsDashboardUrl(
    userId: UserId,
    now: Date,
  ): AbsoluteUrl {
    return `http://stubEstablishmentDiscussionsDashboardUrl/${userId}/${now}`;
  }
}
