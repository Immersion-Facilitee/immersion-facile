import { delay, type Observable, of } from "rxjs";
import {
  type AbsoluteUrl,
  type AfterOAuthSuccessRedirectionResponse,
  type ConnectedUser,
  type ConnectedUserJwt,
  type InitiateLoginByEmailParams,
  noAgencyDashboards,
  noEstablishmentDashboard,
  type OAuthSuccessLoginParams,
  type RenewExpiredJwtRequestDto,
  sleep,
  type UserId,
} from "shared";
import type { AuthGateway } from "src/core-logic/ports/AuthGateway";

export class SimulatedAuthGateway implements AuthGateway {
  constructor(private simulatedLatency = 0) {}
  loginByEmail$(_params: InitiateLoginByEmailParams): Observable<void> {
    return of(undefined).pipe(delay(this.simulatedLatency));
  }
  public getLogoutUrl$(): Observable<AbsoluteUrl> {
    return of("http://fake-logout.com");
  }
  public getConnectedUser$({
    jwt: _,
    userId,
  }: {
    jwt: ConnectedUserJwt;
    userId?: UserId;
  }): Observable<ConnectedUser> {
    return of(
      userId
        ? {
            email: "fake@user.com",
            firstName: "Billy",
            lastName: "Idol",
            id: userId,
            agencyRights: [],
            dashboards: {
              agencies: noAgencyDashboards,
              establishments: noEstablishmentDashboard,
            },
            proConnect: {
              externalId: "fake-user-external-id",
              siret: "00000000000000",
            },
            createdAt: new Date().toISOString(),
            preventToDelete: false,
            isBackofficeAdmin: true,
          }
        : simulatedUserConnected,
    );
  }

  public confirmLoginByMagicLink$(
    _params: OAuthSuccessLoginParams,
  ): Observable<AfterOAuthSuccessRedirectionResponse> {
    return of({
      ...simulatedUserConnected,
      idToken: "fake-id-token",
      provider: "email",
      token: "fake-token",
      redirectUri: "http://fake-redirect.com",
    });
  }

  public renewExpiredJwt$(_: RenewExpiredJwtRequestDto): Observable<void> {
    return of(undefined).pipe(delay(this.simulatedLatency));
  }

  public async renewExpiredJwt(_: RenewExpiredJwtRequestDto): Promise<void> {
    // This is supposed to ask the backend to send a new email to the owner of the expired magic link.
    // Since this operation makes no sense for local development, the implementation here is left empty.
    this.simulatedLatency && (await sleep(this.simulatedLatency));
    throw new Error("500 Not Implemented In InMemory Gateway");
  }
}

const simulatedUserConnected: ConnectedUser = {
  email: "fake@user.com",
  firstName: "Fake",
  lastName: "User",
  id: "fake-user-id",
  agencyRights: [],
  dashboards: {
    agencies: noAgencyDashboards,
    establishments: noEstablishmentDashboard,
  },
  proConnect: {
    externalId: "fake-user-external-id",
    siret: "00000000000000",
  },
  createdAt: new Date().toISOString(),
  preventToDelete: false,
  isBackofficeAdmin: true,
};
