import { from, type Observable } from "rxjs";
import {
  type AppellationAndRomeDto,
  type AppellationSearchInputParams,
  type FormCompletionRoutes,
  type GetSiretEstablishmentDtoResponse,
  type GetSiretInfoError,
  type SiretDto,
  siretApiMissingEstablishmentMessage,
  tooManySirenRequestsSiretErrorMessage,
} from "shared";
import type {
  HttpClient,
  HttpResponse,
  ResponsesToHttpResponse,
} from "shared-routes";
import { otherwiseThrow } from "src/core-logic/adapters/otherwiseThrow";
import type { FormCompletionGateway } from "src/core-logic/ports/FormCompletionGateway";
import { match, P } from "ts-pattern";

export class HttpFormCompletionGateway implements FormCompletionGateway {
  constructor(private readonly httpClient: HttpClient<FormCompletionRoutes>) {}

  public getAppellationDtoMatching$(
    params: AppellationSearchInputParams,
  ): Observable<AppellationAndRomeDto[]> {
    return from(
      this.httpClient
        .appellation({
          queryParams: params,
        })
        .then((response) =>
          match(response)
            .with({ status: 200 }, ({ body }) => body)
            .otherwise(otherwiseThrow),
        ),
    );
  }

  public getSiretEstablishmentDtoResponse$(
    siret: SiretDto,
  ): Observable<GetSiretEstablishmentDtoResponse> {
    return from(
      this.httpClient
        .getSiretEstablishmentDto({ urlParams: { siret } })
        .then(handleSiretResponses),
    );
  }

  public isSiretAlreadySaved$(siret: SiretDto): Observable<boolean> {
    return from(
      this.httpClient
        .isSiretAlreadySaved({ urlParams: { siret } })
        .then(getBodyIfStatus200ElseThrow),
    );
  }
}

const handleSiretResponses = (
  response: ResponsesToHttpResponse<
    FormCompletionRoutes["getSiretEstablishmentDto"]["responses"]
  >,
) =>
  match(response)
    .with({ status: 200 }, ({ body }) => body)
    .with({ status: 400 }, ({ body, status }) => {
      // biome-ignore lint/suspicious/noConsole: debug purpose
      console.error(body.message);
      return errorMessageByCode[status];
    })
    .with(
      { status: P.union(403, 404, 429) },
      ({ status }) => errorMessageByCode[status],
    )
    .otherwise(otherwiseThrow);

const getBodyIfStatus200ElseThrow = <R extends HttpResponse<number, unknown>>(
  response: R,
): R["status"] extends 200 ? R["body"] : never => {
  if (response.status !== 200)
    throw new Error("Une erreur non managée est survenue (pas dans le catch)");

  return response.body as any;
};

const errorMessageByCode = {
  403: "L'entreprise avec ce siret est bannie",
  429: tooManySirenRequestsSiretErrorMessage,
  404: siretApiMissingEstablishmentMessage,
  400: "Erreur sur le siret fourni",
} satisfies Record<number, GetSiretInfoError>;
