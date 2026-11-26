import type { Observable } from "rxjs";
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

export type ContactErrorKind = "alreadyContactedRecently";

export interface SearchGateway {
  getOffer$(params: SiretAndAppellationDto): Observable<InternalOfferDto>;
  getOffers$(
    params: GetOffersFlatQueryParams,
  ): Observable<DataWithPagination<InternalOfferDto>>;
  contactEstablishment: (
    params: CreateDiscussionDto,
  ) => Promise<void | ContactErrorKind>;
  getGroupInfoBySlug$(groupSlug: GroupSlug): Observable<GroupInfo>;
  getExternalOffer$(
    params: SiretAndAppellationDto,
  ): Observable<ExternalOfferDto>;
  getExternalOffers$(
    params: GetExternalOffersFlatQueryParams,
  ): Observable<DataWithPagination<ExternalOfferDto>>;
}
