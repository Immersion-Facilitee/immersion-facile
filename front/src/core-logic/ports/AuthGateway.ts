import type { Observable } from "rxjs";
import type {
  AbsoluteUrl,
  AfterOAuthSuccessRedirectionResponse,
  ConnectedUser,
  ConnectedUserJwt,
  InitiateLoginByEmailParams,
  OAuthSuccessLoginParams,
  RenewExpiredJwtRequestDto,
  UserId,
  WithUserFilters,
} from "shared";

export interface AuthGateway {
  loginByEmail$: (params: InitiateLoginByEmailParams) => Observable<void>;
  getLogoutUrl$(payload: { jwt: ConnectedUserJwt }): Observable<AbsoluteUrl>;
  getConnectedUser$(params: {
    jwt: ConnectedUserJwt;
    userId?: UserId;
  }): Observable<ConnectedUser>;
  getConnectedUsers$: (
    token: ConnectedUserJwt,
    filters: WithUserFilters,
  ) => Observable<ConnectedUser[]>;
  confirmLoginByMagicLink$(
    params: OAuthSuccessLoginParams,
  ): Observable<AfterOAuthSuccessRedirectionResponse>;
  renewExpiredJwt$(
    renewMagicLinkRequestDto: RenewExpiredJwtRequestDto,
  ): Observable<void>;
}
