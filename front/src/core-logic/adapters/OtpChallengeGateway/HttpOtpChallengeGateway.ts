import { from, type Observable } from "rxjs";
import type {
  ActiveOtpSession,
  GetOtpSessionQueryParams,
  HttpErrorBody,
  MaskedOtpRecipients,
  OtpChallengeRoutes,
  OtpJwt,
  RequestOtpChallengeDto,
  VerifyOtpChallengeDto,
} from "shared";
import type { HttpClient, HttpResponse } from "shared-routes";
import {
  otherwiseThrow,
  throwBadRequestWithExplicitMessage,
  throwTooManyRequestWithExplicitMessage,
} from "src/core-logic/adapters/otherwiseThrow";
import type { OtpChallengeGateway } from "src/core-logic/ports/OtpChallengeGateway";
import { match, P } from "ts-pattern";

const throwWithBackMessage = ({
  body,
}: HttpResponse<number, Pick<HttpErrorBody, "message">>): never => {
  throw new Error(body.message);
};

export class HttpOtpChallengeGateway implements OtpChallengeGateway {
  constructor(private readonly httpClient: HttpClient<OtpChallengeRoutes>) {}

  public getMaskedOtpRecipient$(jwt: OtpJwt): Observable<MaskedOtpRecipients> {
    return from(
      this.httpClient
        .getMaskedOtpRecipient({ headers: { authorization: jwt } })
        .then((response) =>
          match(response)
            .with({ status: 200 }, ({ body }) => body)
            .with({ status: 400 }, throwBadRequestWithExplicitMessage)
            .with({ status: P.union(401, 403, 404) }, throwWithBackMessage)
            .otherwise(otherwiseThrow),
        ),
    );
  }

  public requestOtpChallenge$(
    params: RequestOtpChallengeDto,
    jwt: OtpJwt,
  ): Observable<void> {
    return from(
      this.httpClient
        .requestOtpChallenge({
          headers: { authorization: jwt },
          body: params,
        })
        .then((response) =>
          match(response)
            .with({ status: 204 }, () => undefined)
            .with({ status: 400 }, throwBadRequestWithExplicitMessage)
            .with({ status: 429 }, throwTooManyRequestWithExplicitMessage)
            .with({ status: P.union(401, 403, 404) }, throwWithBackMessage)
            .otherwise(otherwiseThrow),
        ),
    );
  }

  public verifyOtpChallenge$(
    params: VerifyOtpChallengeDto,
    jwt: OtpJwt,
  ): Observable<ActiveOtpSession> {
    return from(
      this.httpClient
        .verifyOtpChallenge({
          headers: { authorization: jwt },
          body: params,
        })
        .then((response) =>
          match(response)
            .with({ status: 200 }, ({ body }) => body)
            .with({ status: 400 }, throwBadRequestWithExplicitMessage)
            .with({ status: 429 }, throwTooManyRequestWithExplicitMessage)
            .with({ status: P.union(401, 403, 404) }, throwWithBackMessage)
            .otherwise(otherwiseThrow),
        ),
    );
  }

  public getOtpSession$(
    params: GetOtpSessionQueryParams,
  ): Observable<ActiveOtpSession | null> {
    return from(
      this.httpClient.getOtpSession({ queryParams: params }).then((response) =>
        match(response)
          .with({ status: 200 }, ({ body }) => body)
          .with({ status: 401 }, () => null)
          .with({ status: 400 }, throwBadRequestWithExplicitMessage)
          .with({ status: 403 }, throwWithBackMessage)
          .otherwise(otherwiseThrow),
      ),
    );
  }
}
