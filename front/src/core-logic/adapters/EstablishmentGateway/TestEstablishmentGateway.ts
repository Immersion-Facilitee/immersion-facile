import { type Observable, Subject } from "rxjs";
import type {
  ConnectedUserJwt,
  DataWithPagination,
  DiscussionEstablishmentContactInfo,
  DiscussionId,
  DiscussionInList,
  DiscussionReadDto,
  EstablishmentNameAndAdmins,
  EstablishmentPublicOption,
  ExchangeRead,
  FormEstablishmentDto,
  FormEstablishmentUserRight,
  GetEstablishmentPublicOptionsByFiltersInput,
  SiretDto,
  WithDiscussionStatusRejected,
} from "shared";
import type {
  CloseDiscussionByCandidateRequestedPayload,
  FetchDiscussionListRequestedPayload,
  FetchDiscussionRequestedPayload,
  SendExchangeRequestedPayload,
} from "src/core-logic/domain/discussion/discussion.slice";
import type { EstablishmentGateway } from "src/core-logic/ports/EstablishmentGateway";

export class TestEstablishmentGateway implements EstablishmentGateway {
  public addFormEstablishmentResult$ = new Subject<void>();

  public deleteEstablishmentResult$ = new Subject<void>();

  public editFormEstablishmentResult$ = new Subject<void>();

  public formEstablishment$ = new Subject<FormEstablishmentDto>();

  public establishmentAdmins$ = new Subject<EstablishmentNameAndAdmins>();

  public establishmentPublicOptions$ = new Subject<
    EstablishmentPublicOption[]
  >();

  public userRegistrationOnEstablishmentResult$ = new Subject<void>();

  public discussions$ = new Subject<DataWithPagination<DiscussionInList>>();

  public discussion$ = new Subject<DiscussionReadDto | undefined>();

  public discussionEstablishmentContactInfo$ =
    new Subject<DiscussionEstablishmentContactInfo>();

  public sendMessageResponse$ = new Subject<ExchangeRead>();

  public updateDiscussionStatusResponse$ = new Subject<void>();

  public closeDiscussionByCandidateResponse$ = new Subject<void>();

  public addFormEstablishment$(
    _formEstablishment: FormEstablishmentDto,
  ): Observable<void> {
    return this.addFormEstablishmentResult$;
  }

  public deleteEstablishment$(
    _siret: SiretDto,
    _jwt: ConnectedUserJwt,
  ): Observable<void> {
    return this.deleteEstablishmentResult$;
  }

  public getFormEstablishmentFromJwt$(
    _siret: SiretDto,
    _jwt: ConnectedUserJwt,
  ): Observable<FormEstablishmentDto> {
    return this.formEstablishment$;
  }

  public getEstablishmentNameAndAdmins$(
    _siret: SiretDto,
    _jwt: ConnectedUserJwt,
  ): Observable<EstablishmentNameAndAdmins> {
    return this.establishmentAdmins$;
  }

  public getEstablishmentPublicOptions$(
    _filters: GetEstablishmentPublicOptionsByFiltersInput,
    _jwt: ConnectedUserJwt,
  ): Observable<EstablishmentPublicOption[]> {
    return this.establishmentPublicOptions$;
  }

  public userRegistrationOnEstablishment$(
    _siret: SiretDto,
    _userRight: FormEstablishmentUserRight,
    _jwt: ConnectedUserJwt,
  ): Observable<void> {
    return this.userRegistrationOnEstablishmentResult$;
  }

  public updateFormEstablishment$(
    _formEstablishment: FormEstablishmentDto,
    _jwt: ConnectedUserJwt,
  ): Observable<void> {
    return this.editFormEstablishmentResult$;
  }

  public getDiscussionById$(
    _payload: FetchDiscussionRequestedPayload,
  ): Observable<DiscussionReadDto | undefined> {
    return this.discussion$;
  }

  public getDiscussionEstablishmentContactInfo$(
    _discussionId: DiscussionId,
    _jwt: ConnectedUserJwt,
  ): Observable<DiscussionEstablishmentContactInfo> {
    return this.discussionEstablishmentContactInfo$;
  }
  public getDiscussions$(
    _payload: FetchDiscussionListRequestedPayload,
  ): Observable<DataWithPagination<DiscussionInList>> {
    return this.discussions$;
  }

  public sendMessage$(
    _payload: SendExchangeRequestedPayload,
  ): Observable<ExchangeRead> {
    return this.sendMessageResponse$;
  }

  public closeDiscussionByCandidate$(
    _payload: CloseDiscussionByCandidateRequestedPayload,
  ): Observable<void> {
    return this.closeDiscussionByCandidateResponse$;
  }

  public updateDiscussionStatus$(
    _payload: {
      jwt: string;
      discussionId: string;
    } & WithDiscussionStatusRejected,
  ): Observable<void> {
    return this.updateDiscussionStatusResponse$;
  }
}
