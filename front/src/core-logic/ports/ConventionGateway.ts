import type { Observable } from "rxjs";
import type {
  AgencyUserConventionListDto,
  ApiConsumerName,
  ArchivedConventionRequestDto,
  ArchivedConventionRequestToReviewListDto,
  BeneficiaryConventionListDto,
  ConnectedUserJwt,
  ConventionDraftDto,
  ConventionDraftId,
  ConventionDto,
  ConventionId,
  ConventionJwt,
  ConventionLastBroadcastFeedbackResponse,
  ConventionReadDto,
  ConventionSupportedJwt,
  ConventionTemplate,
  ConventionTemplateId,
  ConventionWithUnfinalizedAssessment,
  DashboardUrlAndName,
  DataWithPagination,
  DiscussionId,
  EditConventionCounsellorNameRequestDto,
  EditConventionWithFinalStatusRequestDto,
  FindSimilarConventionsParams,
  FlatGetConventionsForAgencyUserParams,
  FlatGetConventionsWithErroredBroadcastFeedbackParams,
  FlatGetConventionsWithUnfinalizedAssessmentParams,
  MarkPartnersErroredConventionAsHandledRequest,
  RenewConventionParams,
  SaveConventionDraftDto,
  SendSignatureLinkRequestDto,
  TransferConventionToAgencyRequestDto,
  UpdateConventionStatusRequestDto,
  WithConventionId,
} from "shared";
import type { ConventionWithBroadcastFeedbackReadDto } from "../../../../shared/src/convention/conventionWithBroadcastFeedback.dto";
import type { FetchConventionRequestedPayload } from "../domain/convention/convention.slice";

export interface ConventionGateway {
  retrieveFromToken$(
    payload: FetchConventionRequestedPayload,
  ): Observable<ConventionReadDto | undefined>;
  getConventionStatusDashboardUrl$(
    conventionId: ConventionId,
    jwt: string,
  ): Observable<DashboardUrlAndName>;

  createConvention$(params: {
    convention: ConventionDto;
    discussionId?: DiscussionId;
  }): Observable<void>;
  getApiConsumersByConvention$(
    params: {
      conventionId: ConventionId;
    },
    jwt: string,
  ): Observable<ApiConsumerName[]>;
  getSimilarConventions$(
    findSimilarConventionsParams: FindSimilarConventionsParams,
  ): Observable<ConventionId[]>;
  updateConvention$(
    conventionDto: ConventionDto,
    jwt: string,
  ): Observable<void>;
  updateConventionStatus$(
    params: UpdateConventionStatusRequestDto,
    jwt: ConventionSupportedJwt,
  ): Observable<void>;
  signConvention$(
    conventionId: ConventionId,
    jwt: ConventionJwt | ConnectedUserJwt,
  ): Observable<void>;
  saveConventionDraft(
    saveConventionDraftDto: SaveConventionDraftDto,
  ): Observable<void>;
  sendSignatureLink$(
    params: SendSignatureLinkRequestDto,
    jwt: ConventionSupportedJwt,
  ): Observable<void>;

  renewConvention$(
    params: RenewConventionParams,
    jwt: ConventionSupportedJwt,
  ): Observable<void>;
  broadcastConventionAgain$(
    params: WithConventionId,
    jwt: ConnectedUserJwt,
  ): Observable<void>;
  transferConventionToAgency$(
    params: TransferConventionToAgencyRequestDto,
    jwt: ConventionSupportedJwt,
  ): Observable<void>;
  editConventionCounsellorName$(
    params: EditConventionCounsellorNameRequestDto,
    jwt: ConventionSupportedJwt,
  ): Observable<void>;
  editConventionWithFinalStatus$(
    params: EditConventionWithFinalStatusRequestDto,
    jwt: ConventionSupportedJwt,
  ): Observable<void>;
  markPartnersErroredConventionAsHandled$(
    params: MarkPartnersErroredConventionAsHandledRequest,
    jwt: ConventionSupportedJwt,
  ): Observable<void>;
  getConventionsForUser$(
    params: FlatGetConventionsForAgencyUserParams,
    jwt: string,
  ): Observable<DataWithPagination<AgencyUserConventionListDto>>;
  getBeneficiaryConventionList$(
    jwt: string,
  ): Observable<BeneficiaryConventionListDto>;
  getConventionLastBroadcastFeedback$(
    conventionId: ConventionId,
    jwt: ConventionSupportedJwt,
  ): Observable<ConventionLastBroadcastFeedbackResponse>;
  getConventionsWithErroredBroadcastFeedback$(
    params: FlatGetConventionsWithErroredBroadcastFeedbackParams,
    jwt: string,
  ): Observable<DataWithPagination<ConventionWithBroadcastFeedbackReadDto>>;
  getConventionsWithUnfinalizedAssessment$(
    params: FlatGetConventionsWithUnfinalizedAssessmentParams,
    jwt: string,
  ): Observable<DataWithPagination<ConventionWithUnfinalizedAssessment>>;
  getConventionDraftById$(
    conventionDraftId: ConventionDraftId,
  ): Observable<ConventionDraftDto | undefined>;
  createOrUpdateConventionTemplate$(
    conventionTemplate: ConventionTemplate,
    jwt: string,
  ): Observable<void>;
  getConventionTemplatesForCurrentUser$(
    jwt: string,
  ): Observable<ConventionTemplate[]>;
  deleteConventionTemplate$(
    conventionTemplateId: ConventionTemplateId,
    jwt: string,
  ): Observable<void>;
  saveArchivedConventionRequest$(
    archivedConventionRequest: ArchivedConventionRequestDto,
    jwt: ConnectedUserJwt,
  ): Observable<void>;
  fetchArchivedConventionRequestToReviewList$(
    jwt: string,
  ): Observable<ArchivedConventionRequestToReviewListDto>;
}
