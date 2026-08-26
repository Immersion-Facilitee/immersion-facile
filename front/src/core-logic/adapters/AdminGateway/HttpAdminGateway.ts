import { from, type Observable } from "rxjs";
import {
  type AdminRoutes,
  type ApiConsumer,
  type ApiConsumerId,
  type ApiConsumerJwt,
  type BanEstablishmentPayload,
  type ConnectedUser,
  type ConnectedUserJwt,
  createApiConsumerParamsFromApiConsumer,
  type DashboardUrlAndName,
  type EstablishmentBatchReport,
  type FormEstablishmentBatchDto,
  type GetDashboardParams,
  type GetUsersFilters,
  type RejectConnectedUserRoleForAgencyParams,
  type SetFeatureFlagParam,
  type UserParamsForAgency,
  type UserWithNumberOfAgenciesAndEstablishments,
  type WithPreventToDelete,
  type WithUserId,
} from "shared";
import type { HttpClient } from "shared-routes";
import {
  logBodyAndThrow,
  otherwiseThrow,
  throwBadRequestWithExplicitMessage,
} from "src/core-logic/adapters/otherwiseThrow";
import type { AdminGateway } from "src/core-logic/ports/AdminGateway";
import { match, P } from "ts-pattern";

export class HttpAdminGateway implements AdminGateway {
  constructor(private readonly httpClient: HttpClient<AdminRoutes>) {}

  public addEstablishmentBatch$(
    establishmentBatch: FormEstablishmentBatchDto,
    token: ConnectedUserJwt,
  ): Observable<EstablishmentBatchReport> {
    return from(
      this.httpClient
        .addFormEstablishmentBatch({
          headers: {
            authorization: token,
          },
          body: establishmentBatch,
        })
        .then((response) =>
          match(response)
            .with({ status: 200 }, ({ body }) => body)
            .with({ status: 400 }, throwBadRequestWithExplicitMessage)
            .with({ status: 401 }, logBodyAndThrow)
            .otherwise(otherwiseThrow),
        ),
    );
  }

  public createUserForAgency$(
    params: UserParamsForAgency,
    token: string,
  ): Observable<ConnectedUser> {
    return from(
      this.httpClient
        .createUserForAgency({
          body: params,
          headers: { authorization: token },
        })
        .then((response) =>
          match(response)
            .with({ status: 200 }, ({ body }) => body)
            .with({ status: 400 }, throwBadRequestWithExplicitMessage)
            .with({ status: P.union(401, 404) }, logBodyAndThrow)
            .otherwise(otherwiseThrow),
        ),
    );
  }

  public getAllApiConsumers$(
    adminToken: ConnectedUserJwt,
  ): Observable<ApiConsumer[]> {
    return from(
      this.httpClient
        .getAllApiConsumers({
          headers: { authorization: adminToken },
        })
        .then((response) =>
          match(response)
            .with({ status: 200 }, ({ body }) => body)
            .with({ status: P.union(401, 403) }, logBodyAndThrow)
            .otherwise(otherwiseThrow),
        ),
    );
  }

  public getDashboardUrl$(
    params: GetDashboardParams,
    token: ConnectedUserJwt,
  ): Observable<DashboardUrlAndName> {
    return from(
      this.httpClient
        .getDashboardUrl({
          urlParams: { dashboardName: params.name },
          queryParams: {
            ...(params.name === "adminAgencyDetails"
              ? { agencyId: params.agencyId }
              : {}),
          },
          headers: {
            authorization: token,
          },
        })
        .then((response) =>
          match(response)
            .with({ status: 200 }, ({ body }) => body)
            .with({ status: 400 }, throwBadRequestWithExplicitMessage)
            .with({ status: P.union(401, 403) }, logBodyAndThrow)
            .otherwise(otherwiseThrow),
        ),
    );
  }

  public getLastNotifications$(token: ConnectedUserJwt) {
    return from(
      this.httpClient
        .getLastNotifications({ headers: { authorization: token } })
        .then((response) =>
          match(response)
            .with({ status: 200 }, ({ body }) => body)
            .with({ status: P.union(400) }, throwBadRequestWithExplicitMessage)
            .with({ status: P.union(401, 403) }, logBodyAndThrow)
            .otherwise(otherwiseThrow),
        ),
    );
  }

  public rejectUserForAgency$(
    params: RejectConnectedUserRoleForAgencyParams,
    token: string,
  ): Observable<void> {
    return from(
      this.httpClient
        .rejectIcUserForAgency({
          body: params,
          headers: { authorization: token },
        })
        .then((response) =>
          match(response)
            .with({ status: 201 }, () => undefined)
            .with({ status: P.union(401, 404) }, logBodyAndThrow)
            .otherwise(otherwiseThrow),
        ),
    );
  }

  public saveApiConsumer$(
    apiConsumer: ApiConsumer,
    adminToken: ConnectedUserJwt,
  ): Observable<ApiConsumerJwt | undefined> {
    return from(
      this.httpClient
        .saveApiConsumer({
          body: createApiConsumerParamsFromApiConsumer(apiConsumer),
          headers: { authorization: adminToken },
        })
        .then((response) =>
          match(response)
            .with({ status: 200 }, ({ body }) => body || undefined)
            .with({ status: P.union(401, 403) }, logBodyAndThrow)
            .otherwise(otherwiseThrow),
        ),
    );
  }

  public updateFeatureFlags$(
    params: SetFeatureFlagParam,
    token: ConnectedUserJwt,
  ): Observable<void> {
    return from(
      this.httpClient
        .updateFeatureFlags({
          body: params,
          headers: { authorization: token },
        })
        .then((response) =>
          match(response)
            .with({ status: 201 }, () => undefined)
            .with({ status: P.union(401, 403) }, logBodyAndThrow)
            .otherwise(otherwiseThrow),
        ),
    );
  }

  public updateUserRoleForAgency$(
    params: UserParamsForAgency,
    token: string,
  ): Observable<void> {
    return from(
      this.httpClient
        .updateUserRoleForAgency({
          body: params,
          headers: { authorization: token },
        })
        .then((response) =>
          match(response)
            .with({ status: 201 }, () => undefined)
            .with({ status: 400 }, throwBadRequestWithExplicitMessage)
            .with({ status: P.union(401, 404) }, logBodyAndThrow)
            .otherwise(otherwiseThrow),
        ),
    );
  }

  public listUsers$(
    filters: GetUsersFilters,
    token: ConnectedUserJwt,
  ): Observable<UserWithNumberOfAgenciesAndEstablishments[]> {
    return from(
      this.httpClient
        .getUsers({ headers: { authorization: token }, queryParams: filters })
        .then((response) =>
          match(response)
            .with({ status: 200 }, ({ body }) => body)
            .with({ status: P.union(401, 403) }, logBodyAndThrow)
            .otherwise(otherwiseThrow),
        ),
    );
  }

  public revokeApiConsumer$(
    consumerId: ApiConsumerId,
    token: ConnectedUserJwt,
  ): Observable<void> {
    return from(
      this.httpClient
        .revokeApiConsumer({
          headers: { authorization: token },
          urlParams: { consumerId },
        })
        .then((response) =>
          match(response)
            .with({ status: 200 }, () => undefined)
            .with({ status: P.union(401, 403, 404, 409) }, logBodyAndThrow)
            .otherwise(otherwiseThrow),
        ),
    );
  }

  public renewApiConsumerKey$(
    consumerId: ApiConsumerId,
    token: ConnectedUserJwt,
  ): Observable<ApiConsumerJwt> {
    return from(
      this.httpClient
        .renewApiConsumerKey({
          headers: { authorization: token },
          urlParams: { consumerId },
        })
        .then((response) =>
          match(response)
            .with({ status: 200 }, ({ body }) => body)
            .with({ status: P.union(401, 403, 404, 409) }, logBodyAndThrow)
            .otherwise(otherwiseThrow),
        ),
    );
  }

  public updateUserPreventToDelete$(
    params: WithUserId & WithPreventToDelete,
    token: ConnectedUserJwt,
  ): Observable<void> {
    return from(
      this.httpClient
        .updateUserPreventToDelete({
          headers: { authorization: token },
          urlParams: { userId: params.userId },
          body: { preventToDelete: params.preventToDelete },
        })
        .then((response) =>
          match(response)
            .with({ status: 200 }, () => undefined)
            .with({ status: 400 }, throwBadRequestWithExplicitMessage)
            .with({ status: P.union(401, 403, 404) }, logBodyAndThrow)
            .otherwise(otherwiseThrow),
        ),
    );
  }

  public banEstablishment$(
    payload: BanEstablishmentPayload,
    jwt: ConnectedUserJwt,
  ): Observable<void> {
    return from(
      this.httpClient
        .banEstablishment({
          headers: { authorization: jwt },
          body: {
            siret: payload.siret,
            establishmentBannishmentJustification:
              payload.establishmentBannishmentJustification,
          },
        })
        .then((response) =>
          match(response)
            .with({ status: 201 }, () => {})
            .with({ status: 400 }, throwBadRequestWithExplicitMessage)
            .with({ status: P.union(401, 403, 409) }, logBodyAndThrow)
            .otherwise(otherwiseThrow),
        ),
    );
  }
}
