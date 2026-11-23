import { from, type Observable } from "rxjs";
import {
  type ConnectedUserJwt,
  type DataWithPagination,
  type DiscussionEstablishmentContactInfo,
  type DiscussionExchangeForbiddenParams,
  type DiscussionId,
  type DiscussionInList,
  type DiscussionReadDto,
  type EstablishmentNameAndAdmins,
  type EstablishmentPublicOption,
  type EstablishmentRoutes,
  type ExchangeRead,
  errors,
  type FormEstablishmentDto,
  type FormEstablishmentPendingUserRight,
  type GetEstablishmentPublicOptionsByFiltersInput,
  type SendMessageToDiscussionFromDashboardRequestPayload,
  type SiretDto,
  type UpdateDiscussionStatusParams,
} from "shared";
import type { HttpClient } from "shared-routes";
import type {
  CloseDiscussionByCandidateRequestedPayload,
  FetchDiscussionListRequestedPayload,
  FetchDiscussionRequestedPayload,
} from "src/core-logic/domain/discussion/discussion.slice";
import type { EstablishmentGateway } from "src/core-logic/ports/EstablishmentGateway";
import { match, P } from "ts-pattern";
import {
  logBodyAndThrow,
  otherwiseThrow,
  throwBadRequestWithExplicitMessage,
} from "../otherwiseThrow";

export class HttpEstablishmentGateway implements EstablishmentGateway {
  constructor(private readonly httpClient: HttpClient<EstablishmentRoutes>) {}

  public addFormEstablishment$(
    formEstablishment: FormEstablishmentDto,
    jwt: ConnectedUserJwt,
  ): Observable<void> {
    return from(
      this.httpClient
        .addFormEstablishment({
          body: formEstablishment,
          headers: { authorization: jwt },
        })
        .then((response) =>
          match(response)
            .with({ status: 200 }, () => {
              /* void */
            })
            .with({ status: 403 }, ({ body }) => {
              throw new Error(JSON.stringify(body));
            })
            .otherwise(otherwiseThrow),
        ),
    );
  }

  public deleteEstablishment$(
    siret: SiretDto,
    jwt: ConnectedUserJwt,
  ): Observable<void> {
    return from(
      this.httpClient
        .deleteEstablishment({
          urlParams: { siret },
          headers: { authorization: jwt },
        })
        .then((response) =>
          match(response)
            .with({ status: 204 }, () => {
              /* void */
            })
            .with({ status: P.union(404, 400, 401, 403) }, ({ body }) => {
              throw new Error(JSON.stringify(body));
            })
            .otherwise(otherwiseThrow),
        )
        .catch((error) => {
          //Todo temporary fix due to probable shared route bug
          if (
            error instanceof Error &&
            error.message.includes("Received status: 204.")
          ) {
            return;
          }
          throw error;
        }),
    );
  }

  public getFormEstablishmentFromJwt$(
    siret: SiretDto,
    jwt: ConnectedUserJwt,
  ): Observable<FormEstablishmentDto> {
    return from(
      this.httpClient
        .getFormEstablishment({
          urlParams: { siret },
          headers: { authorization: jwt },
        })
        .then((response) =>
          match(response)
            .with({ status: 200 }, ({ body }) => body)
            .with({ status: P.union(404, 401) }, ({ body }) => {
              throw new Error(JSON.stringify(body));
            })
            .with({ status: 403 }, (response) => {
              throw new Error(response.body.message);
            })
            .otherwise(otherwiseThrow),
        ),
    );
  }

  public getEstablishmentNameAndAdmins$(
    siret: SiretDto,
    jwt: ConnectedUserJwt,
  ): Observable<EstablishmentNameAndAdmins> {
    return from(
      this.httpClient
        .getEstablishmentNameAndAdmins({
          urlParams: { siret },
          headers: { authorization: jwt },
        })
        .then((response) =>
          match(response)
            .with({ status: 200 }, ({ body }) => body)
            .with({ status: 404 }, () => {
              throw errors.establishment.notFound({ siret });
            })
            .otherwise(otherwiseThrow),
        ),
    );
  }

  public getEstablishmentPublicOptions$(
    filters: GetEstablishmentPublicOptionsByFiltersInput,
    jwt: ConnectedUserJwt,
  ): Observable<EstablishmentPublicOption[]> {
    return from(
      this.httpClient
        .getEstablishmentPublicOptionsByFilters({
          queryParams: filters,
          headers: { authorization: jwt },
        })
        .then((response) =>
          match(response)
            .with({ status: 200 }, ({ body }) => body)
            .with({ status: 401 }, logBodyAndThrow)
            .otherwise(otherwiseThrow),
        ),
    );
  }

  public updateFormEstablishment$(
    formEstablishment: FormEstablishmentDto,
    jwt: ConnectedUserJwt,
  ): Observable<void> {
    return from(
      this.httpClient
        .updateFormEstablishment({
          body: formEstablishment,
          headers: {
            authorization: jwt,
          },
        })
        .then((response) =>
          match(response)
            .with({ status: 200 }, () => {
              /* void */
            })
            .with({ status: 400 }, throwBadRequestWithExplicitMessage)
            .with({ status: P.union(401, 403, 404, 409) }, logBodyAndThrow)
            .otherwise(otherwiseThrow),
        ),
    );
  }

  public userRegistrationOnEstablishment$(
    siret: SiretDto,
    userRight: FormEstablishmentPendingUserRight,
    jwt: ConnectedUserJwt,
  ): Observable<void> {
    return from(
      this.httpClient
        .registerUserOnEstablishment({
          headers: { authorization: jwt },
          urlParams: { siret },
          body: userRight,
        })
        .then((response) =>
          match(response)
            .with({ status: 201 }, () => {})
            .with({ status: 400 }, throwBadRequestWithExplicitMessage)
            .with({ status: P.union(401, 403, 404) }, logBodyAndThrow)
            .otherwise(otherwiseThrow),
        ),
    );
  }

  public getDiscussionById$({
    discussionId,
    jwt,
  }: FetchDiscussionRequestedPayload): Observable<
    DiscussionReadDto | undefined
  > {
    return from(
      this.httpClient
        .getDiscussionById({
          headers: { authorization: jwt },
          urlParams: {
            discussionId,
          },
        })
        .then((response) =>
          match(response)
            .with({ status: 200 }, ({ body }) => body)
            .with(
              {
                status: 400,
              },
              logBodyAndThrow,
            )
            .with({ status: 401 }, logBodyAndThrow)
            .with({ status: 403 }, logBodyAndThrow)
            .with({ status: 404 }, logBodyAndThrow)
            .otherwise(otherwiseThrow),
        ),
    );
  }

  public getDiscussionEstablishmentContactInfo$(
    discussionId: DiscussionId,
    jwt: ConnectedUserJwt,
  ): Observable<DiscussionEstablishmentContactInfo> {
    return from(
      this.httpClient
        .getDiscussionEstablishmentContactInfo({
          headers: { authorization: jwt },
          urlParams: { discussionId },
        })
        .then((response) =>
          match(response)
            .with({ status: 200 }, ({ body }) => body)
            .with({ status: 400 }, logBodyAndThrow)
            .with({ status: 401 }, logBodyAndThrow)
            .with({ status: 403 }, logBodyAndThrow)
            .with({ status: 404 }, logBodyAndThrow)
            .otherwise(otherwiseThrow),
        ),
    );
  }

  public getDiscussions$(
    payload: FetchDiscussionListRequestedPayload,
  ): Observable<DataWithPagination<DiscussionInList>> {
    return from(
      this.httpClient
        .getDiscussions({
          queryParams: payload.filters,
          headers: { authorization: payload.jwt },
        })
        .then((response) =>
          match(response)
            .with({ status: 200 }, ({ body }) => body)
            .with({ status: 400 }, throwBadRequestWithExplicitMessage)
            .with({ status: 401 }, logBodyAndThrow)
            .otherwise(otherwiseThrow),
        ),
    );
  }

  public sendMessage$(
    payload: SendMessageToDiscussionFromDashboardRequestPayload,
  ): Observable<ExchangeRead | DiscussionExchangeForbiddenParams> {
    return from(
      this.httpClient
        .replyToDiscussion({
          headers: { authorization: payload.jwt },
          urlParams: { discussionId: payload.discussionId },
          body: {
            message: payload.message,
            recipientRole: payload.recipientRole,
          },
        })
        .then((response) =>
          match(response)
            .with({ status: 200 }, ({ body }) => body)
            .with({ status: 202 }, ({ body }) => body)
            .with({ status: 400 }, throwBadRequestWithExplicitMessage)
            .with({ status: 401 }, logBodyAndThrow)
            .with({ status: 404 }, logBodyAndThrow)
            .otherwise(otherwiseThrow),
        ),
    );
  }

  public closeDiscussionByCandidate$({
    jwt,
    discussionId,
  }: CloseDiscussionByCandidateRequestedPayload): Observable<void> {
    return from(
      this.httpClient
        .closeDiscussionByCandidate({
          headers: { authorization: jwt },
          urlParams: { discussionId },
        })
        .then((response) =>
          match(response)
            .with({ status: 200 }, () => undefined)
            .with({ status: 400 }, throwBadRequestWithExplicitMessage)
            .with({ status: P.union(401, 403, 404) }, logBodyAndThrow)
            .otherwise(otherwiseThrow),
        ),
    );
  }

  public updateDiscussionStatus$(
    params: {
      jwt: string;
      discussionId: string;
    } & UpdateDiscussionStatusParams,
  ): Observable<void> {
    const { discussionId: _, jwt: __, ...body } = params;
    return from(
      this.httpClient
        .updateDiscussionStatus({
          headers: { authorization: params.jwt },
          urlParams: { discussionId: params.discussionId },
          body,
        })
        .then((response) =>
          match(response)
            .with({ status: 200 }, () => undefined)
            .with({ status: 400 }, throwBadRequestWithExplicitMessage)
            .with({ status: P.union(401, 403, 404) }, logBodyAndThrow)
            .otherwise(otherwiseThrow),
        ),
    );
  }
}
