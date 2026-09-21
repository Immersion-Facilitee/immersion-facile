import Bottleneck from "bottleneck";
import {
  type AppellationDto,
  appellationCodeSchema,
  cancellableSleep,
  errors,
  ONE_SECOND_MS,
} from "shared";
import type { HttpClient } from "shared-routes";
import { partnerNames } from "../../../../config/bootstrap/partnerNames";
import { createLogger } from "../../../../utils/logger";
import type { WithCache } from "../../caching-gateway/port/WithCache";
import type { AppellationsGateway } from "../ports/AppellationsGateway";
import {
  type DiagorienteAccessTokenResponse,
  type DiagorienteAppellationsRoutes,
  type DiagorienteRawResponse,
  diagorienteAppellationsRoutes,
  diagorienteTokenScope,
} from "./DiagorienteAppellationsGateway.routes";

const maxResults = 5;
const diagorienteMaxCallRatePerSeconds = 25;

export const requestMinTime = Math.floor(
  ONE_SECOND_MS / diagorienteMaxCallRatePerSeconds,
);

const logger = createLogger(__filename);

export class DiagorienteAppellationsGateway implements AppellationsGateway {
  #limiter = new Bottleneck({
    reservoir: diagorienteMaxCallRatePerSeconds,
    reservoirRefreshInterval: ONE_SECOND_MS, // number of ms
    reservoirRefreshAmount: diagorienteMaxCallRatePerSeconds,
    maxConcurrent: 5,
    minTime: requestMinTime,
  });

  #withCache: WithCache;
  #maxQueryDurationMs: number;

  constructor(
    private readonly httpClient: HttpClient<DiagorienteAppellationsRoutes>,
    private readonly diagorienteCredentials: {
      clientId: string;
      clientSecret: string;
    },
    withCache: WithCache,
    maxQueryDurationMs = 700,
  ) {
    this.#withCache = withCache;
    this.#maxQueryDurationMs = maxQueryDurationMs;
  }

  async searchAppellations(rawQuery: string): Promise<AppellationDto[]> {
    const tokenData = await this.getAccessToken()
      // Must not throw since usecase make a failback to internal appellation search
      .catch(() => null);
    if (!tokenData) return [];
    const cachedSearchAppellations = this.#withCache({
      overrideCacheDurationInHours: 24,
      logParams: {
        partner: "diagoriente",
        route: diagorienteAppellationsRoutes.searchAppellations,
      },
      getCacheKey: (query) => `diagoriente_${query}`,
      cb: (query): Promise<AppellationDto[]> =>
        this.httpClient
          .searchAppellations({
            queryParams: {
              query,
              nb_results: maxResults * 10,
              tags: ["ROME4"],
            },
            headers: {
              Authorization: `Bearer ${tokenData.access_token}`,
            },
          })
          .then(({ status, body }) =>
            status === 200 ? diagorienteRawResponseToAppellationsDto(body) : [],
          )
          .catch(() =>
            // Must not throw since usecase make a failback to internal appellation search
            [],
          ),
    });

    return this.#limiter.schedule(() => {
      const apiCallPromise = cachedSearchAppellations(rawQuery);

      const sleeping = cancellableSleep(this.#maxQueryDurationMs);

      return Promise.race([
        apiCallPromise.finally(() => sleeping.cancel()),
        sleeping.promise.then(() => {
          logger.warn({
            partnerApiCall: {
              partnerName: partnerNames.diagoriente,
              durationInMs: this.#maxQueryDurationMs,
              route: diagorienteAppellationsRoutes.searchAppellations,
              response: {
                kind: "failure",
                status: 504,
                body: {
                  message: `Timeout on immersion facilitée side - more than ${this.#maxQueryDurationMs} ms to response`,
                },
              },
            },
          });

          return [];
        }),
      ]);
    });
  }

  public getAccessToken(): Promise<DiagorienteAccessTokenResponse> {
    return this.#withCache({
      overrideCacheDurationInHours: 10 / 60,
      getCacheKey: () => "diagoriente_access_token",
      logParams: {
        partner: "diagoriente",
        route: diagorienteAppellationsRoutes.getAccessToken,
      },
      cb: () =>
        this.#limiter.schedule(() =>
          this.httpClient
            .getAccessToken({
              headers: {
                "Content-Type": "application/x-www-form-urlencoded",
              },
              body: {
                client_id: this.diagorienteCredentials.clientId,
                client_secret: this.diagorienteCredentials.clientSecret,
                grant_type: "client_credentials",
              },
            })
            .then(({ status, body }) => {
              if (status !== 200)
                throw errors.generic.unsupportedStatus({
                  body,
                  status,
                  serviceName: "Diagoriente",
                });

              return body;
            }),
        ),
    })(diagorienteTokenScope);
  }
}

const diagorienteRawResponseToAppellationsDto = (
  response: DiagorienteRawResponse,
): AppellationDto[] =>
  response.search_results
    .filter(
      ({ data }) => appellationCodeSchema.safeParse(data.code_ogr).success,
    )
    .sort((a, b) => (a.similarity <= b.similarity ? 1 : -1))
    .filter((_, index) => index <= maxResults - 1)
    .map(({ data }) => ({
      appellationLabel: data.titre,
      appellationCode: data.code_ogr,
    }));
