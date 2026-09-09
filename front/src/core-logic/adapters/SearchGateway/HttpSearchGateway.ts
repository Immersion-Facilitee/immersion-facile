import { from, type Observable } from "rxjs";
import type {
  CreateDiscussionDto,
  DataWithPagination,
  ExternalOfferDto,
  GetExternalOffersFlatQueryParams,
  GetOffersFlatQueryParams,
  GroupSlug,
  GroupWithResults,
  InternalOfferDto,
  SearchResultQuery,
  SearchRoutes,
  SiretAndAppellationDto,
} from "shared";
import type { HttpClient } from "shared-routes";
import {
  logBodyAndThrow,
  otherwiseThrow,
  throwBadRequestWithExplicitMessage,
} from "src/core-logic/adapters/otherwiseThrow";
import type {
  ContactErrorKind,
  SearchGateway,
} from "src/core-logic/ports/SearchGateway";
import { match, P } from "ts-pattern";

export class HttpSearchGateway implements SearchGateway {
  constructor(private readonly httpClient: HttpClient<SearchRoutes>) {}

  public async contactEstablishment(
    params: CreateDiscussionDto,
  ): Promise<void | ContactErrorKind> {
    return this.httpClient
      .contactEstablishment({
        body: params,
      })
      .then((response) =>
        match(response)
          .with({ status: 201 }, () => undefined)
          .with({ status: 400 }, throwBadRequestWithExplicitMessage)
          .with({ status: 404 }, logBodyAndThrow)
          .with(
            { status: 409 },
            (): ContactErrorKind => "alreadyContactedRecently",
          )
          .otherwise(otherwiseThrow),
      );
  }

  public async getGroupBySlug(groupSlug: GroupSlug): Promise<GroupWithResults> {
    return this.httpClient
      .getGroupBySlug({
        urlParams: { groupSlug },
      })
      .then((response) =>
        match(response)
          .with({ status: 200 }, ({ body }) => body)
          .with({ status: P.union(404) }, () => {
            throw new Error(
              `Nous n'avons pas trouvé le groupe: '${groupSlug}'`,
            );
          })
          .otherwise(otherwiseThrow),
      );
  }

  public getOffer$(params: SearchResultQuery): Observable<InternalOfferDto> {
    return from(
      this.httpClient
        .getSearchResult({
          queryParams: params,
        })
        .then((result) =>
          match(result)
            .with({ status: 200 }, ({ body }) => body)
            .with({ status: 400 }, throwBadRequestWithExplicitMessage)
            .with({ status: 404 }, logBodyAndThrow)
            .otherwise(otherwiseThrow),
        ),
    );
  }

  public getOffers$(
    params: GetOffersFlatQueryParams,
  ): Observable<DataWithPagination<InternalOfferDto>> {
    return from(
      this.httpClient
        .getOffers({
          queryParams: params,
        })
        .then((result) =>
          match(result)
            .with({ status: 200 }, ({ body }) => body)
            .with({ status: 400 }, throwBadRequestWithExplicitMessage)
            .otherwise(otherwiseThrow),
        ),
    );
  }

  public getExternalOffers$(
    params: GetExternalOffersFlatQueryParams,
  ): Observable<DataWithPagination<ExternalOfferDto>> {
    return from(
      this.httpClient
        .getExternalOffers({
          queryParams: params,
        })
        .then((result) =>
          match(result)
            .with({ status: 200 }, ({ body }) => ({
              data: body,
              pagination: {
                totalPages: 1,
                currentPage: 1,
                numberPerPage: 50,
                totalRecords: body.length,
              },
            }))
            .with({ status: 400 }, throwBadRequestWithExplicitMessage)
            .otherwise(otherwiseThrow),
        ),
    );
  }

  public getExternalOffer$(
    params: SiretAndAppellationDto,
  ): Observable<ExternalOfferDto> {
    return from(
      this.httpClient
        .getExternalSearchResult({
          queryParams: params,
        })
        .then((result) =>
          match(result)
            .with({ status: 200 }, ({ body }) => body)
            .with({ status: 400 }, throwBadRequestWithExplicitMessage)
            .with({ status: 404 }, ({ body }) => {
              throw new Error(body.message);
            })
            .otherwise(otherwiseThrow),
        ),
    );
  }
}
