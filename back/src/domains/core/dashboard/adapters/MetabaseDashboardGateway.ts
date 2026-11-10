import jwt from "jsonwebtoken";
import type {
  AbsoluteUrl,
  AdminDashboardName,
  AgencyDashboards,
  ConventionId,
  DashboardName,
  OmitFromExistingKeys,
  UserId,
} from "shared";
import type { DashboardGateway } from "../port/DashboardGateway";

type MetabaseEndpoint = "v1" | "v2";

type MetabaseEndpointConfig = {
  url: AbsoluteUrl;
  apiKey: string;
};

export type MetabaseConfig = Record<MetabaseEndpoint, MetabaseEndpointConfig>;

type DashboardKind = "dashboard" | "question";

type MetabaseDashboard = {
  endpoint: MetabaseEndpoint;
  kind: DashboardKind;
  id: number;
};

const dashboardByName: Record<DashboardName, MetabaseDashboard> = {
  adminAgencies: { kind: "dashboard", id: 130, endpoint: "v1" },
  adminConventions: { kind: "dashboard", id: 5, endpoint: "v1" },
  adminEvents: { kind: "question", id: 330, endpoint: "v1" },
  adminEstablishments: { kind: "dashboard", id: 115, endpoint: "v1" },
  agencyForUser: { kind: "dashboard", id: 150, endpoint: "v1" }, // https://metabase.immersion-facile.beta.gouv.fr/dashboard/150
  erroredConventionsForUser: {
    kind: "dashboard",
    id: 151,
    endpoint: "v1",
  },
  conventionStatus: { kind: "dashboard", id: 45, endpoint: "v1" },
  establishmentRepresentativeConventions: {
    kind: "dashboard",
    id: 128,
    endpoint: "v1",
  },
  establishmentRepresentativeDiscussions: {
    kind: "dashboard",
    id: 138,
    endpoint: "v1",
  },
  statsEstablishmentDetails: { kind: "dashboard", id: 223, endpoint: "v1" },
  agencyManagement: { kind: "dashboard", id: 2, endpoint: "v2" },
  establishmentManagement: { kind: "dashboard", id: 13, endpoint: "v2" },
};

type MetabasePayload = {
  resource: Partial<Record<DashboardKind, number>>;
  params: Record<string, string[] | string>;
  exp: number; // number of milliseconds before expiration
};

export class MetabaseDashboardGateway implements DashboardGateway {
  constructor(private metabaseConfig: MetabaseConfig) {}

  public getAgencyUserUrls(
    userId: UserId,
    agencyNames: string[],
    now: Date,
  ): OmitFromExistingKeys<AgencyDashboards, "erroredConventionsDashboardUrl"> {
    return {
      agencyDashboardUrl: this.#makeDashboardUrlByDashboardName({
        dashboardName: "agencyForUser",
        now,
        lockedParams: { ic_user_id: userId },
      }),
      statsEstablishmentDetailsUrl: this.#makeDashboardUrlByDashboardName({
        dashboardName: "statsEstablishmentDetails",
        now,
      }),
      agencyManagement: this.#makeDashboardUrlByDashboardName({
        dashboardName: "agencyManagement",
        // this is to avoid too long url, we limit the number of agencies to 40, or we do not apply the default filter
        editableParams: {
          structure: agencyNames.length <= 40 ? agencyNames : [],
        },
        now,
      }),
      establishmentManagement: this.#makeDashboardUrlByDashboardName({
        dashboardName: "establishmentManagement",
        now,
      }),
    };
  }

  public getConventionStatusUrl(id: ConventionId, now: Date): AbsoluteUrl {
    return this.#makeDashboardUrlByDashboardName({
      dashboardName: "conventionStatus",
      now,
      lockedParams: {
        id: [id],
      },
    });
  }

  public getAdminDashboardUrl(
    dashboardName: AdminDashboardName,
    now: Date,
  ): AbsoluteUrl {
    return this.#makeDashboardUrlByDashboardName({ dashboardName, now });
  }

  public getErroredConventionsDashboardUrl(
    userId: UserId,
    now: Date,
  ): AbsoluteUrl {
    return this.#makeDashboardUrlByDashboardName({
      dashboardName: "erroredConventionsForUser",
      now,
      lockedParams: { ic_user_id: userId },
    });
  }

  public getEstablishmentConventionsDashboardUrl(
    userId: UserId,
    now: Date,
  ): AbsoluteUrl {
    return this.#makeDashboardUrlByDashboardName({
      dashboardName: "establishmentRepresentativeConventions",
      now,
      lockedParams: { ic_user_id: userId },
    });
  }

  public getEstablishmentDiscussionsDashboardUrl(
    userId: UserId,
    now: Date,
  ): AbsoluteUrl {
    return this.#makeDashboardUrlByDashboardName({
      dashboardName: "establishmentRepresentativeDiscussions",
      now,
      lockedParams: { ic_user_id: userId },
    });
  }

  #makeDashboardUrlByDashboardName({
    dashboardName,
    now,
    editableParams,
    lockedParams,
  }: {
    dashboardName: DashboardName;
    now: Date;
    editableParams?: Record<string, string | string[]>;
    lockedParams?: Record<string, string | string[]>;
  }): AbsoluteUrl {
    const dashboard = dashboardByName[dashboardName];
    const metabaseEndpointUrl = this.metabaseConfig[dashboard.endpoint].url;
    const baseUrl: AbsoluteUrl = `${metabaseEndpointUrl}/embed/${dashboard.kind}/${this.#createToken({ dashboard, now, lockedParams })}`;
    const queryString = makeQueryStringFromParams(editableParams ?? {});

    return `${baseUrl}${queryString ? `?${queryString}` : ""}#bordered=true&titled=true`;
  }

  #createToken({
    dashboard,
    lockedParams,
    now,
  }: {
    dashboard: MetabaseDashboard;
    lockedParams?: Record<string, string | string[]>;
    now: Date;
  }): string {
    const payload: MetabasePayload = {
      resource: { [dashboard.kind]: dashboard.id },
      params: lockedParams ?? {},
      exp: Math.round(now.getTime() / 1000) + 60 * 60 * 8, // 8 hours expiration
    };

    return jwt.sign(payload, this.metabaseConfig[dashboard.endpoint].apiKey);
  }
}

function makeQueryStringFromParams(params: Record<string, string | string[]>) {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    Array.isArray(value)
      ? value.forEach((v) => {
          searchParams.append(key, v);
        })
      : searchParams.set(key, value);
  });

  return searchParams.toString();
}
