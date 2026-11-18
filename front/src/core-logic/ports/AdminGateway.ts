import type { Observable } from "rxjs";
import type {
  AgencyUserForListing,
  ApiConsumer,
  ApiConsumerId,
  ApiConsumerJwt,
  BanEstablishmentPayload,
  ConnectedUserJwt,
  DashboardUrlAndName,
  EstablishmentBatchReport,
  FormEstablishmentBatchDto,
  GetDashboardParams,
  GetUsersFilters,
  NotificationsByKind,
  SetFeatureFlagParam,
  UserWithNumberOfAgenciesAndEstablishments,
  WithPreventToDelete,
  WithUserFilters,
  WithUserId,
} from "shared";

export interface AdminGateway {
  addEstablishmentBatch$: (
    establishmentBatch: FormEstablishmentBatchDto,
    token: ConnectedUserJwt,
  ) => Observable<EstablishmentBatchReport>;

  getConnectedUsers$: (
    token: ConnectedUserJwt,
    filters: WithUserFilters,
  ) => Observable<AgencyUserForListing[]>;

  getDashboardUrl$: (
    params: GetDashboardParams,
    token: ConnectedUserJwt,
  ) => Observable<DashboardUrlAndName>;
  updateFeatureFlags$: (
    params: SetFeatureFlagParam,
    adminToken: ConnectedUserJwt,
  ) => Observable<void>;
  getAllApiConsumers$: (
    adminToken: ConnectedUserJwt,
  ) => Observable<ApiConsumer[]>;

  getLastNotifications$(
    token: ConnectedUserJwt,
  ): Observable<NotificationsByKind>;

  saveApiConsumer$(
    apiConsumer: ApiConsumer,
    adminToken: ConnectedUserJwt,
  ): Observable<ApiConsumerJwt | undefined>;

  listUsers$(
    params: GetUsersFilters,
    token: ConnectedUserJwt,
  ): Observable<UserWithNumberOfAgenciesAndEstablishments[]>;

  revokeApiConsumer$(
    consumerId: ApiConsumerId,
    token: ConnectedUserJwt,
  ): Observable<void>;

  renewApiConsumerKey$(
    consumerId: ApiConsumerId,
    token: ConnectedUserJwt,
  ): Observable<ApiConsumerJwt>;

  banEstablishment$(
    banEstablishmentPayload: BanEstablishmentPayload,
    jwt: ConnectedUserJwt,
  ): Observable<void>;

  updateUserPreventToDelete$(
    params: WithUserId & WithPreventToDelete,
    token: ConnectedUserJwt,
  ): Observable<void>;
}
