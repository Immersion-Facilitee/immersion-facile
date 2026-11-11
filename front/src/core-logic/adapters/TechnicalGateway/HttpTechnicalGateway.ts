import type { AxiosInstance } from "axios";
import { from, map, type Observable } from "rxjs";
import {
  type AbsoluteUrl,
  type ConnectedUserJwt,
  type ConventionSupportedJwt,
  type Email,
  type FeatureFlags,
  type HtmlToPdfRequest,
  type TechnicalRoutes,
  uploadFileRoute,
  type ValidateEmailFeedback,
} from "shared";
import type { HttpClient } from "shared-routes";
import {
  logBodyAndThrow,
  otherwiseThrow,
  throwBadRequestWithExplicitMessage,
} from "src/core-logic/adapters/otherwiseThrow";
import type { TechnicalGateway } from "src/core-logic/ports/TechnicalGateway";
import { match, P } from "ts-pattern";

export class HttpTechnicalGateway implements TechnicalGateway {
  public getAllFeatureFlags$ = (): Observable<FeatureFlags> =>
    from(this.httpClient.featureFlags({ queryParams: null })).pipe(
      map((response) =>
        match(response)
          .with({ status: 200 }, ({ body }) => body)
          .with({ status: 400 }, throwBadRequestWithExplicitMessage)
          .otherwise(otherwiseThrow),
      ),
    );

  constructor(
    private readonly httpClient: HttpClient<TechnicalRoutes>,
    private readonly axiosInstance: AxiosInstance,
  ) {}

  public getEmailStatus(email: Email): Promise<ValidateEmailFeedback> {
    return this.httpClient
      .validateEmail({
        queryParams: {
          email,
        },
      })
      .then((response) =>
        match(response)
          .with({ status: 200 }, ({ body }) => body)
          .with({ status: 400 }, throwBadRequestWithExplicitMessage)
          .otherwise(otherwiseThrow),
      );
  }

  public htmlToPdf(
    params: HtmlToPdfRequest,
    jwt: ConventionSupportedJwt,
  ): Promise<string> {
    return this.httpClient
      .htmlToPdf({
        body: params,
        headers: { authorization: jwt },
      })
      .then((response) =>
        match(response)
          .with({ status: 200 }, ({ body }) => body)
          .with({ status: P.union(401, 403) }, logBodyAndThrow)
          .otherwise(otherwiseThrow),
      );
  }

  public async uploadFile(
    file: File,
    jwt: ConnectedUserJwt,
  ): Promise<AbsoluteUrl> {
    const formData = new FormData();
    formData.append(uploadFileRoute, file);
    const { data, status } = await this.axiosInstance.post(
      `/${uploadFileRoute}`,
      formData,
      { headers: { authorization: jwt } },
    );
    if (status !== 200) throw new Error(data.message);
    return data;
  }
}
