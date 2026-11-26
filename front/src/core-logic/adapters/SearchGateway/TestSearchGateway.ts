import { type Observable, Subject } from "rxjs";
import type {
  CreateDiscussionDto,
  DataWithPagination,
  ExternalOfferDto,
  GetExternalOffersFlatQueryParams,
  GetOffersFlatQueryParams,
  GroupInfo,
  GroupSlug,
  InternalOfferDto,
  SiretAndAppellationDto,
} from "shared";
import type { SearchGateway } from "src/core-logic/ports/SearchGateway";

export class TestSearchGateway implements SearchGateway {
  public currentInternalOffer$ = new Subject<InternalOfferDto>();

  public internalOffers$ = new Subject<DataWithPagination<InternalOfferDto>>();

  public currentExternalOffer$ = new Subject<ExternalOfferDto>();

  public externalOffers$ = new Subject<DataWithPagination<ExternalOfferDto>>();

  public currentGroupInfo$ = new Subject<GroupInfo>();

  public contactEstablishment(
    _params: CreateDiscussionDto,
  ): Promise<void | "alreadyContactedRecently"> {
    throw new Error("Method not implemented.");
  }

  public getGroupInfoBySlug$(_groupSlug: GroupSlug): Observable<GroupInfo> {
    return this.currentGroupInfo$;
  }

  public getOffer$(
    _params: SiretAndAppellationDto,
  ): Observable<InternalOfferDto> {
    return this.currentInternalOffer$;
  }

  public getExternalOffers$(
    _params: GetExternalOffersFlatQueryParams,
  ): Observable<DataWithPagination<ExternalOfferDto>> {
    return this.externalOffers$;
  }

  public getOffers$(
    _params: GetOffersFlatQueryParams,
  ): Observable<DataWithPagination<InternalOfferDto>> {
    return this.internalOffers$;
  }

  public getExternalOffer$(
    _params: SiretAndAppellationDto,
  ): Observable<ExternalOfferDto> {
    return this.currentExternalOffer$;
  }
}
