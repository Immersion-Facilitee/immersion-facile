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
} from "shared";

export interface AuthGateway {
  loginByEmail$: (params: InitiateLoginByEmailParams) => Observable<void>;
  getLogoutUrl$(payload: { jwt: ConnectedUserJwt }): Observable<AbsoluteUrl>;
  getConnectedUser$(params: {
    jwt: ConnectedUserJwt;
    userId?: UserId;
  }): Observable<ConnectedUser>;
  confirmLoginByMagicLink$(
    params: OAuthSuccessLoginParams,
  ): Observable<AfterOAuthSuccessRedirectionResponse>;
  renewExpiredJwt$(
    renewMagicLinkRequestDto: RenewExpiredJwtRequestDto,
  ): Observable<void>;
}
