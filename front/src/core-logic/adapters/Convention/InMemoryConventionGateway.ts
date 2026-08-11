import { from, type Observable, Subject } from "rxjs";
import {
  type AddConventionInput,
  type AgencyOption,
  type AgencyUserConventionListDto,
  type ApiConsumerName,
  type ArchivedConventionRequestDto,
  type ArchivedConventionRequestToReviewListDto,
  type BeneficiaryConventionListDto,
  type ConnectedUserJwt,
  type ConventionDraftDto,
  type ConventionDraftId,
  type ConventionDto,
  ConventionDtoBuilder,
  type ConventionId,
  type ConventionJwt,
  type ConventionLastBroadcastFeedbackResponse,
  type ConventionReadDto,
  type ConventionSupportedJwt,
  type ConventionTemplate,
  type ConventionTemplateId,
  type ConventionWithUnfinalizedAssessment,
  type DashboardUrlAndName,
  type DataWithPagination,
  type EditConventionCounsellorNameRequestDto,
  type EditConventionWithFinalStatusRequestDto,
  type FindSimilarConventionsParams,
  type FlatGetConventionsForAgencyUserParams,
  type FlatGetConventionsWithUnfinalizedAssessmentParams,
  type MarkPartnersErroredConventionAsHandledRequest,
  makeEmptyLastReminders,
  type PaginationQueryParams,
  type RenewConventionParams,
  type SaveConventionDraftDto,
  type SendSignatureLinkRequestDto,
  sleep,
  type TransferConventionToAgencyRequestDto,
  type UpdateConventionStatusRequestDto,
  type WithConventionId,
} from "shared";
import type { FetchConventionRequestedPayload } from "src/core-logic/domain/convention/convention.slice";
import type { ConventionGateway } from "src/core-logic/ports/ConventionGateway";
import type { ConventionWithBroadcastFeedback } from "../../../../../shared/src/convention/conventionWithBroadcastFeedback.dto";

const CONVENTION_VALIDATED_TEST = new ConventionDtoBuilder()
  .withStatus("ACCEPTED_BY_VALIDATOR")
  .build();

export class InMemoryConventionGateway implements ConventionGateway {
  public addConventionCallCount = 0;

  public addConventionResult$ = new Subject<void>();

  public saveArchivedConventionRequestResult$ = new Subject<void>();

  // For testing purpose
  public convention$ = new Subject<ConventionReadDto | undefined>();

  public conventionDraft$ = new Subject<ConventionDraftDto | undefined>();

  public conventionDashboardUrl$ = new Subject<DashboardUrlAndName>();

  public conventionModificationResult$ = new Subject<void>();

  public conventionRenewalResult$ = new Subject<void>();

  public conventionSignedResult$ = new Subject<void>();

  public getApiConsumersByconventionResult$ = new Subject<ApiConsumerName[]>();

  public getSimilarConventionsResult$ = new Subject<ConventionId[]>();

  public updateConventionCallCount = 0;

  public updateConventionResult$ = new Subject<void>();

  public broadcastConventionAgainResult$ = new Subject<void>();

  public sendSignatureLinkResult$ = new Subject<void>();

  public transferConventionToAgencyResult$ = new Subject<void>();

  public editConventionCounsellorNameResult$ = new Subject<void>();

  public editConventionWithFinalStatusResult$ = new Subject<void>();

  public markPartnersErroredConventionAsHandledResult$ = new Subject<void>();

  public saveConventionDraftResult$ = new Subject<void>();

  public createOrUpdateConventionTemplateResult$ = new Subject<void>();

  public getConventionTemplatesForCurrentUserResult$ = new Subject<
    ConventionTemplate[]
  >();

  public deleteConventionTemplateResult$ = new Subject<void>();

  public getConventionsForUserResult$ = new Subject<
    DataWithPagination<AgencyUserConventionListDto>
  >();
  public getBeneficiaryConventionListResult$ =
    new Subject<BeneficiaryConventionListDto>();
  public getConventionLastBroadcastFeedbackResult$ =
    new Subject<ConventionLastBroadcastFeedbackResponse>();

  public getConventionsWithErroredBroadcastFeedbackResult$ = new Subject<
    DataWithPagination<ConventionWithBroadcastFeedback>
  >();

  public getConventionsWithUnfinalizedAssessmentResult$ = new Subject<
    DataWithPagination<ConventionWithUnfinalizedAssessment>
  >();

  public fetchArchivedConventionRequestToReviewListResult$ =
    new Subject<ArchivedConventionRequestToReviewListDto>();

  #agencies: { [id: string]: AgencyOption } = {};

  #conventions: { [id: string]: ConventionDto } = {
    [CONVENTION_VALIDATED_TEST.id]: CONVENTION_VALIDATED_TEST,
  };

  constructor(private simulatedLatency?: number) {}

  fetchArchivedConventionRequestToReviewList$(
    _jwt: string,
  ): Observable<ArchivedConventionRequestToReviewListDto> {
    return this.fetchArchivedConventionRequestToReviewListResult$;
  }

  getBeneficiaryConventionList$(
    _jwt: string,
  ): Observable<BeneficiaryConventionListDto> {
    return this.getBeneficiaryConventionListResult$;
  }

  broadcastConventionAgain$(
    _params: WithConventionId,
    _jwt: ConnectedUserJwt,
  ): Observable<void> {
    return this.broadcastConventionAgainResult$;
  }

  public createConvention$(_params: AddConventionInput): Observable<void> {
    this.addConventionCallCount++;
    return this.addConventionResult$;
  }

  public saveArchivedConventionRequest$(
    _archivedConventionRequest: ArchivedConventionRequestDto,
    _jwt: ConnectedUserJwt,
  ): Observable<void> {
    return this.saveArchivedConventionRequestResult$;
  }

  public editConventionCounsellorName$(
    _params: EditConventionCounsellorNameRequestDto,
    _jwt: ConventionSupportedJwt,
  ): Observable<void> {
    return this.editConventionCounsellorNameResult$;
  }

  public editConventionWithFinalStatus$(
    _params: EditConventionWithFinalStatusRequestDto,
    _jwt: ConventionSupportedJwt,
  ): Observable<void> {
    return this.editConventionWithFinalStatusResult$;
  }

  public getApiConsumersByConvention$(
    _params: WithConventionId,
    _jwt: ConnectedUserJwt,
  ): Observable<ApiConsumerName[]> {
    return this.getApiConsumersByconventionResult$;
  }

  public getConventionStatusDashboardUrl$(
    _conventionId: ConventionId,
    _jwt: ConventionJwt,
  ) {
    return this.conventionDashboardUrl$;
  }

  public getSimilarConventions$(
    _findSimilarConventionsParams: FindSimilarConventionsParams,
  ): Observable<ConventionId[]> {
    return this.getSimilarConventionsResult$;
  }

  public sendSignatureLink$(
    _params: SendSignatureLinkRequestDto,
    _jwt: ConventionSupportedJwt,
  ): Observable<void> {
    return this.sendSignatureLinkResult$;
  }

  public renewConvention$(
    _params: RenewConventionParams,
    _jwt: ConventionSupportedJwt,
  ): Observable<void> {
    return this.conventionRenewalResult$;
  }

  public async retreiveById(id: ConventionId): Promise<ConventionReadDto> {
    this.simulatedLatency && (await sleep(this.simulatedLatency));
    return this.#inferConventionReadDto(this.#conventions[id]);
  }

  public retrieveFromToken$(
    payload: FetchConventionRequestedPayload,
  ): Observable<ConventionReadDto | undefined> {
    return this.simulatedLatency
      ? from(this.#getMagicLink(payload))
      : this.convention$;
  }

  public saveConventionDraft(
    _saveConventionDraftDto: SaveConventionDraftDto,
  ): Observable<void> {
    return this.saveConventionDraftResult$;
  }

  public getConventionDraftById$(
    _conventionDraftId: ConventionDraftId,
  ): Observable<ConventionDraftDto | undefined> {
    return this.conventionDraft$;
  }

  public createOrUpdateConventionTemplate$(
    _conventionTemplate: ConventionTemplate,
    _jwt: ConnectedUserJwt,
  ): Observable<void> {
    return this.createOrUpdateConventionTemplateResult$;
  }

  public getConventionTemplatesForCurrentUser$(
    _jwt: string,
  ): Observable<ConventionTemplate[]> {
    return this.getConventionTemplatesForCurrentUserResult$;
  }

  public deleteConventionTemplate$(
    _conventionTemplateId: ConventionTemplateId,
    _jwt: string,
  ): Observable<void> {
    return this.deleteConventionTemplateResult$;
  }

  public signConvention$(
    _conventionId: ConventionId,
    _jwt: ConventionJwt | ConnectedUserJwt,
  ): Observable<void> {
    return this.conventionSignedResult$;
  }

  public transferConventionToAgency$(
    _params: TransferConventionToAgencyRequestDto,
    _jwt: ConventionSupportedJwt,
  ): Observable<void> {
    return this.transferConventionToAgencyResult$;
  }

  public updateConvention$(
    _conventionDto: ConventionDto,
    _jwt: string,
  ): Observable<void> {
    this.updateConventionCallCount++;
    return this.updateConventionResult$;
  }

  public updateConventionStatus$(
    _params: UpdateConventionStatusRequestDto,
    _jwt: string,
  ): Observable<void> {
    return this.conventionModificationResult$;
  }

  async #getMagicLink({
    conventionId,
  }: FetchConventionRequestedPayload): Promise<ConventionReadDto> {
    this.simulatedLatency && (await sleep(this.simulatedLatency));
    return this.#inferConventionReadDto(this.#conventions[conventionId]);
  }

  #inferConventionReadDto(convention: ConventionDto): ConventionReadDto {
    return {
      ...convention,
      agencyName: this.#agencies[convention.agencyId]?.name ?? "agency-name",
      agencyContactEmail: "contact@mail.com",
      agencyDepartment: "75",
      agencyKind: "mission-locale",
      agencySiret: "22220000222200",
      agencyValidationSteps: "validator-only",
      assessment: null,
      lastReminders: makeEmptyLastReminders(),
      isEstablishmentBanned: false,
    };
  }

  public markPartnersErroredConventionAsHandled$(
    _params: MarkPartnersErroredConventionAsHandledRequest,
    _jwt: string,
  ): Observable<void> {
    return this.markPartnersErroredConventionAsHandledResult$;
  }

  public getConventionsForUser$(
    _params: FlatGetConventionsForAgencyUserParams,
    _jwt: string,
  ): Observable<DataWithPagination<AgencyUserConventionListDto>> {
    return this.getConventionsForUserResult$;
  }
  public getConventionLastBroadcastFeedback$(
    _conventionId: ConventionId,
    _jwt: ConventionSupportedJwt,
  ): Observable<ConventionLastBroadcastFeedbackResponse> {
    return this.getConventionLastBroadcastFeedbackResult$;
  }

  public getConventionsWithErroredBroadcastFeedback$(
    _params: Required<PaginationQueryParams>,
    _jwt: string,
  ): Observable<DataWithPagination<ConventionWithBroadcastFeedback>> {
    return this.getConventionsWithErroredBroadcastFeedbackResult$;
  }

  public getConventionsWithUnfinalizedAssessment$(
    _params: FlatGetConventionsWithUnfinalizedAssessmentParams,
    _jwt: string,
  ): Observable<DataWithPagination<ConventionWithUnfinalizedAssessment>> {
    return this.getConventionsWithUnfinalizedAssessmentResult$;
  }
}
