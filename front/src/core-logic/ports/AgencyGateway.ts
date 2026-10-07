import type { Observable } from "rxjs";
import type {
  AgencyDto,
  AgencyId,
  AgencyOption,
  AgencyPublicDisplayDto,
  AgencyUserForListing,
  CloseAgencyAndTransferConventionsRequestDto,
  ConnectedUser,
  ConnectedUserJwt,
  CreateAgencyDto,
  GetAgencyUsersFilters,
  ListAgencyOptionsRequestDto,
  UserParamsForAgency,
  WithAgencyId,
  WithAgencyIdAndUserId,
} from "shared";

export interface AgencyGateway {
  addAgency$(agency: CreateAgencyDto): Observable<void>;
  createUserForAgency$(
    params: UserParamsForAgency,
    token: ConnectedUserJwt,
  ): Observable<ConnectedUser>;
  getAgencyById$(
    agencyId: AgencyId,
    token: ConnectedUserJwt,
  ): Observable<AgencyDto>;
  getAgencyPublicInfoById$(
    agencyId: WithAgencyId,
  ): Observable<AgencyPublicDisplayDto>;
  getAgencyUsers$(
    token: ConnectedUserJwt,
    filters: GetAgencyUsersFilters,
  ): Observable<AgencyUserForListing[]>;
  listAgencyOptionsByFilter$(
    filter: ListAgencyOptionsRequestDto,
  ): Observable<AgencyOption[]>;
  updateAgency$(
    agencyDto: AgencyDto,
    adminToken: ConnectedUserJwt,
  ): Observable<void>;
  updateUserAgencyRight$(
    params: UserParamsForAgency,
    token: ConnectedUserJwt,
  ): Observable<void>;
  registerAgenciesToCurrentUser$(
    agencyIds: AgencyId[],
    token: string,
  ): Observable<void>;
  removeUserFromAgency$(
    params: WithAgencyIdAndUserId,
    token: ConnectedUserJwt,
  ): Observable<void>;
  closeAgencyAndTransfertConventions$(
    payload: CloseAgencyAndTransferConventionsRequestDto,
    adminToken: ConnectedUserJwt,
  ): Observable<void>;
}
