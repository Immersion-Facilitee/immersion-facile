import { type Observable, Subject } from "rxjs";
import type {
  AdminEstablishmentListItemDto,
  AgencyUserForListing,
  ApiConsumer,
  ApiConsumerId,
  ApiConsumerJwt,
  BanEstablishmentPayload,
  ConnectedUserJwt,
  DashboardUrlAndName,
  DataWithPagination,
  EstablishmentBatchReport,
  FormEstablishmentBatchDto,
  GetEstablishmentsForAdminParams,
  GetUsersFilters,
  NotificationsByKind,
  SetFeatureFlagParam,
  UserWithNumberOfAgenciesAndEstablishments,
  WithPreventToDelete,
  WithUserId,
} from "shared";
import type { AdminGateway } from "src/core-logic/ports/AdminGateway";

export class TestAdminGateway implements AdminGateway {
  public apiConsumers$ = new Subject<ApiConsumer[]>();

  public dashboardUrl$ = new Subject<DashboardUrlAndName>();

  public establishmentBatchResponse$ = new Subject<EstablishmentBatchReport>();

  public getAllApiConsumers$ = (_adminToken: ConnectedUserJwt) =>
    this.apiConsumers$;

  public lastNotifications$ = new Subject<NotificationsByKind>();

  public saveApiConsumersResponse$ = new Subject<ApiConsumerJwt>();

  public setFeatureFlagLastCalledWith: SetFeatureFlagParam | undefined =
    undefined;

  public setFeatureFlagResponse$ = new Subject<void>();

  public token$ = new Subject<string>();

  public getConnectedUsersResponse$ = new Subject<AgencyUserForListing[]>();

  public banEstablishmentResponse$ = new Subject<void>();

  public getEstablishmentsForAdminResponse$ = new Subject<
    DataWithPagination<AdminEstablishmentListItemDto>
  >();

  public listUsersResponse$ = new Subject<
    UserWithNumberOfAgenciesAndEstablishments[]
  >();

  public updateUserPreventToDeleteResponse$ = new Subject<void>();

  public updateFeatureFlags$ = (
    params: SetFeatureFlagParam,
    _adminToken: ConnectedUserJwt,
  ) => {
    this.setFeatureFlagLastCalledWith = params;
    return this.setFeatureFlagResponse$;
  };

  public getEstablishmentsForAdmin$(
    _params: GetEstablishmentsForAdminParams,
    _jwt: ConnectedUserJwt,
  ): Observable<DataWithPagination<AdminEstablishmentListItemDto>> {
    return this.getEstablishmentsForAdminResponse$;
  }

  public addEstablishmentBatch$(
    _establishmentBatch: FormEstablishmentBatchDto,
    _token: ConnectedUserJwt,
  ): Observable<EstablishmentBatchReport> {
    return this.establishmentBatchResponse$;
  }

  public getConnectedUsers$(): Observable<AgencyUserForListing[]> {
    return this.getConnectedUsersResponse$;
  }

  public getDashboardUrl$(): Observable<DashboardUrlAndName> {
    return this.dashboardUrl$;
  }

  public getLastNotifications$(
    _token: ConnectedUserJwt,
  ): Observable<NotificationsByKind> {
    return this.lastNotifications$;
  }

  public saveApiConsumer$(
    _apiConsumer: ApiConsumer,
    _adminToken: ConnectedUserJwt,
  ): Observable<ApiConsumerJwt> {
    return this.saveApiConsumersResponse$;
  }

  public listUsers$(
    _params: GetUsersFilters,
    _token: string,
  ): Observable<UserWithNumberOfAgenciesAndEstablishments[]> {
    return this.listUsersResponse$;
  }

  public revokeApiConsumerResponse$ = new Subject<void>();

  public revokeApiConsumer$(
    _consumerId: ApiConsumerId,
    _token: ConnectedUserJwt,
  ): Observable<void> {
    return this.revokeApiConsumerResponse$;
  }

  public renewApiConsumerKeyResponse$ = new Subject<ApiConsumerJwt>();

  public renewApiConsumerKey$(
    _consumerId: ApiConsumerId,
    _token: ConnectedUserJwt,
  ): Observable<ApiConsumerJwt> {
    return this.renewApiConsumerKeyResponse$;
  }

  public banEstablishment$(
    _payload: BanEstablishmentPayload,
  ): Observable<void> {
    return this.banEstablishmentResponse$;
  }

  public updateUserPreventToDelete$(
    _params: WithUserId & WithPreventToDelete,
    _token: ConnectedUserJwt,
  ): Observable<void> {
    return this.updateUserPreventToDeleteResponse$;
  }
}
