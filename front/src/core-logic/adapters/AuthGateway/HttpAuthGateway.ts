import { from, type Observable } from "rxjs";
import type {
  AbsoluteUrl,
  AfterOAuthSuccessRedirectionResponse,
  AuthRoutes,
  ConnectedUser,
  ConnectedUserJwt,
  InitiateLoginByEmailParams,
  OAuthSuccessLoginParams,
  RenewExpiredJwtRequestDto,
  UserId,
  WithUserFilters,
} from "shared";
import type { HttpClient } from "shared-routes";
import {
  logBodyAndThrow,
  otherwiseThrow,
  throwBadRequestWithExplicitMessage,
} from "src/core-logic/adapters/otherwiseThrow";
import type { AuthGateway } from "src/core-logic/ports/AuthGateway";
import { match, P } from "ts-pattern";

export class HttpAuthGateway implements AuthGateway {
  constructor(private readonly httpClient: HttpClient<AuthRoutes>) {}

  loginByEmail$(params: InitiateLoginByEmailParams): Observable<void> {
    return from(
      this.httpClient
        .initiateLoginByEmail({
          body: params,
        })
        .then((response) =>
          match(response)
            .with({ status: 200 }, () => undefined)
            .otherwise(otherwiseThrow),
        ),
    );
  }

  public getLogoutUrl$({
    jwt,
  }: {
    jwt: ConnectedUserJwt;
  }): Observable<AbsoluteUrl> {
    return from(
      this.httpClient
        .getOAuthLogoutUrl({
          headers: { authorization: jwt },
        })
        .then((response) =>
          match(response)
            .with({ status: 200 }, ({ body }) => body)
            .with({ status: P.union(400, 401) }, logBodyAndThrow)
            .otherwise(otherwiseThrow),
        ),
    );
  }

  public getConnectedUser$({
    jwt,
    userId,
  }: {
    jwt: ConnectedUserJwt;
    userId?: UserId;
  }): Observable<ConnectedUser> {
    return from(
      this.httpClient
        .getConnectedUser({
          headers: { authorization: jwt },
          queryParams: { userId },
        })
        .then((response) =>
          match(response)
            .with({ status: 200 }, ({ body }) => body)
            .with({ status: 400 }, throwBadRequestWithExplicitMessage)
            .with({ status: P.union(401, 403, 404) }, logBodyAndThrow)
            .otherwise(otherwiseThrow),
        ),
    );
  }

  public getConnectedUsers$(
    token: ConnectedUserJwt,
    filters: WithUserFilters,
  ): Observable<ConnectedUser[]> {
    return from(
      this.httpClient
        .getConnectedUsers({
          queryParams: filters,
          headers: { authorization: token },
        })
        .then((response) =>
          match(response)
            .with({ status: 200 }, ({ body }) => body)
            .with({ status: 401 }, logBodyAndThrow)
            .otherwise(otherwiseThrow),
        ),
    );
  }

  public confirmLoginByMagicLink$(
    params: OAuthSuccessLoginParams,
  ): Observable<AfterOAuthSuccessRedirectionResponse> {
    return from(
      this.httpClient
        .afterEmailOrProConnectOAuthLogin({
          queryParams: params,
        })
        .then((response) =>
          match(response)
            .with({ status: 200 }, ({ body }) => body)
            .with({ status: 302 }, logBodyAndThrow)
            .with({ status: 400 }, throwBadRequestWithExplicitMessage)
            .with({ status: 403 }, logBodyAndThrow)
            .otherwise(otherwiseThrow),
        ),
    );
  }

  public renewExpiredJwt$(params: RenewExpiredJwtRequestDto): Observable<void> {
    return from(
      this.httpClient
        .renewExpiredJwt({
          queryParams:
            params.kind === "convention"
              ? {
                  ...params,
                  originalUrl: encodeURIComponent(params.originalUrl),
                }
              : params,
        })
        .then((response) =>
          match(response)
            .with({ status: 200 }, () => undefined)
            .with({ status: 400 }, throwBadRequestWithExplicitMessage)
            .with({ status: 403 }, logBodyAndThrow)
            .with({ status: 404 }, logBodyAndThrow)
            .otherwise(otherwiseThrow),
        ),
    );
  }
}
