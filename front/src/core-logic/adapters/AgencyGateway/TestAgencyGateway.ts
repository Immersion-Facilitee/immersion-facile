import { type Observable, Subject } from "rxjs";
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
  ListAgencyOptionsRequestDto,
  UserParamsForAgency,
  WithAgencyId,
  WithAgencyIdAndUserId,
} from "shared";
import type { AgencyGateway } from "src/core-logic/ports/AgencyGateway";

export class TestAgencyGateway implements AgencyGateway {
  public createUserForAgencyResponse$ = new Subject<ConnectedUser>();

  public addAgencyResponse$ = new Subject<undefined>();

  public agencyOptions$ = new Subject<AgencyOption[]>();

  public agencyInfo$ = new Subject<AgencyPublicDisplayDto>();

  public customAgencyId$ = new Subject<AgencyId | undefined>();

  public fetchedAgency$ = new Subject<AgencyDto>();

  public getAgencyUsersResponse$ = new Subject<AgencyUserForListing[]>();

  public updateAgencyResponse$ = new Subject<undefined>();

  public updateUserAgencyRightResponse$ = new Subject<undefined>();

  public removeUserFromAgencyResponse$ = new Subject<undefined>();

  public registerAgenciesToCurrentUserResponse$ = new Subject<undefined>();

  public closeAgencyAndTransfertConventionsResponse$ = new Subject<undefined>();

  addAgency$(_agency: CreateAgencyDto): Observable<void> {
    return this.addAgencyResponse$;
  }

  public createUserForAgency$(
    _params: UserParamsForAgency,
    _token: string,
  ): Observable<ConnectedUser> {
    return this.createUserForAgencyResponse$;
  }

  public getAgencyById$(
    _agencyId: AgencyId,
    _token: ConnectedUserJwt,
  ): Observable<AgencyDto> {
    return this.fetchedAgency$;
  }

  public getAgencyPublicInfoById$(
    _agencyId: WithAgencyId,
  ): Observable<AgencyPublicDisplayDto> {
    return this.agencyInfo$;
  }

  public getAgencyUsers$(): Observable<AgencyUserForListing[]> {
    return this.getAgencyUsersResponse$;
  }

  public listAgencyOptionsByFilter$(
    _filter: ListAgencyOptionsRequestDto,
  ): Observable<AgencyOption[]> {
    return this.agencyOptions$;
  }

  public updateAgency$(
    _agencyDto: AgencyDto,
    _adminToken: ConnectedUserJwt,
  ): Observable<void> {
    return this.updateAgencyResponse$;
  }

  public updateUserAgencyRight$(): Observable<void> {
    return this.updateUserAgencyRightResponse$;
  }

  public removeUserFromAgency$(
    _params: WithAgencyIdAndUserId,
    _token: string,
  ): Observable<void> {
    return this.removeUserFromAgencyResponse$;
  }

  public registerAgenciesToCurrentUser$(
    _agencyIds: AgencyId[],
    _token: string,
  ): Observable<void> {
    return this.registerAgenciesToCurrentUserResponse$;
  }

  public closeAgencyAndTransfertConventions$(
    _payload: CloseAgencyAndTransferConventionsRequestDto,
    _adminToken: ConnectedUserJwt,
  ): Observable<void> {
    return this.closeAgencyAndTransfertConventionsResponse$;
  }
}
