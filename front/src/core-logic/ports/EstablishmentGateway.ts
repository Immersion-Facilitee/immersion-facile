import type { Observable } from "rxjs";
import type {
  ConnectedUserJwt,
  ConventionSupportedJwt,
  DataWithPagination,
  DiscussionEstablishmentContactInfo,
  DiscussionExchangeForbiddenParams,
  DiscussionId,
  DiscussionInList,
  DiscussionReadDto,
  EstablishmentNameAndAdmins,
  EstablishmentPublicOption,
  ExchangeRead,
  FormEstablishmentDto,
  FormEstablishmentUserRight,
  GetEstablishmentPublicOptionsByFiltersInput,
  SendMessageToDiscussionFromDashboardRequestPayload,
  SiretDto,
  WithDiscussionStatus,
} from "shared";
import type {
  CloseDiscussionByCandidateRequestedPayload,
  FetchDiscussionListRequestedPayload,
  FetchDiscussionRequestedPayload,
} from "../domain/discussion/discussion.slice";

export interface EstablishmentGateway {
  deleteEstablishment$(
    siret: SiretDto,
    jwt: ConnectedUserJwt,
  ): Observable<void>;
  addFormEstablishment$(
    establishment: FormEstablishmentDto,
    jwt: ConnectedUserJwt,
  ): Observable<void>;
  getFormEstablishmentFromJwt$(
    siret: SiretDto,
    jwt: ConnectedUserJwt,
  ): Observable<FormEstablishmentDto>;
  updateFormEstablishment$(
    establishment: FormEstablishmentDto,
    jwt: ConnectedUserJwt,
  ): Observable<void>;
  getEstablishmentNameAndAdmins$(
    siret: SiretDto,
    jwt: ConnectedUserJwt,
  ): Observable<EstablishmentNameAndAdmins>;
  getDiscussionById$(
    payload: FetchDiscussionRequestedPayload,
  ): Observable<DiscussionReadDto | undefined>;
  getDiscussionEstablishmentContactInfo$(
    discussionId: DiscussionId,
    jwt: ConnectedUserJwt,
  ): Observable<DiscussionEstablishmentContactInfo>;
  getEstablishmentPublicOptions$(
    filters: GetEstablishmentPublicOptionsByFiltersInput,
    jwt: ConnectedUserJwt,
  ): Observable<EstablishmentPublicOption[]>;
  sendMessage$(
    payload: SendMessageToDiscussionFromDashboardRequestPayload,
  ): Observable<ExchangeRead | DiscussionExchangeForbiddenParams>;
  updateDiscussionStatus$(
    payload: {
      jwt: ConventionSupportedJwt;
      discussionId: string;
    } & WithDiscussionStatus,
  ): Observable<void>;
  closeDiscussionByCandidate$(
    payload: CloseDiscussionByCandidateRequestedPayload,
  ): Observable<void>;
  getDiscussions$(
    payload: FetchDiscussionListRequestedPayload,
  ): Observable<DataWithPagination<DiscussionInList>>;

  userRegistrationOnEstablishment$(
    siret: SiretDto,
    userRight: FormEstablishmentUserRight,
    jwt: ConnectedUserJwt,
  ): Observable<void>;
}
