import axios, { type AxiosInstance } from "axios";
import {
  type AbsoluteUrl,
  type AppellationCode,
  type DataWithPagination,
  frontRoutes,
  type GetOffersFlatParamsPublicV3,
  makeRouteAbsoluteUrl,
  publicApiV3SearchEstablishmentRoutes,
  type SearchImmersionResultPublicV3,
  toAbsoluteUrl,
} from "shared";
import { createAxiosSharedClient } from "shared-routes/axios";
import { match, P } from "ts-pattern";

const DEFAULT_API_BASE_URL = "https://immersion-facile.beta.gouv.fr/api";
const DEFAULT_FRONT_BASE_URL = "https://immersion-facile.beta.gouv.fr";

export type SearchImmersionOffersParams = GetOffersFlatParamsPublicV3;
export type ImmersionOffer = SearchImmersionResultPublicV3;
export type SearchImmersionOffersResult =
  DataWithPagination<SearchImmersionResultPublicV3>;

export class ImmersionFacileApiError extends Error {
  readonly status: number;
  readonly issues?: string[];

  constructor(status: number, message: string, issues?: string[]) {
    super(message);
    this.name = "ImmersionFacileApiError";
    this.status = status;
    this.issues = issues;
  }
}

export const getApiBaseUrl = () =>
  process.env.IMMERSION_FACILE_API_BASE_URL?.replace(/\/$/, "") ??
  DEFAULT_API_BASE_URL;

export const getFrontBaseUrl = (): AbsoluteUrl =>
  toAbsoluteUrl(
    process.env.IMMERSION_FACILE_FRONT_BASE_URL?.replace(/\/$/, "") ??
      DEFAULT_FRONT_BASE_URL,
  );

export const buildOfferUrl = (
  offer: Pick<ImmersionOffer, "siret" | "locationId" | "appellations">,
  preferredAppellationCodes?: AppellationCode[],
): string | undefined => {
  const preferredCode = preferredAppellationCodes?.find((code) =>
    offer.appellations.some(
      (appellation) => appellation.appellationCode === code,
    ),
  );
  const appellationCode =
    preferredCode ?? offer.appellations[0]?.appellationCode;

  if (!appellationCode) {
    return undefined;
  }

  return makeRouteAbsoluteUrl({
    baseUrl: getFrontBaseUrl(),
    route: frontRoutes.searchResult({
      appellationCode: [appellationCode],
      siret: offer.siret,
      ...(offer.locationId ? { location: offer.locationId } : {}),
    }),
  });
};

const getApiToken = () => {
  const token = process.env.IMMERSION_FACILE_API_TOKEN?.trim();

  if (!token) {
    throw new ImmersionFacileApiError(
      500,
      "IMMERSION_FACILE_API_TOKEN is not configured on the MCP server.",
    );
  }

  return token;
};

const createApiClient = () => {
  const axiosInstance: AxiosInstance = axios.create({
    baseURL: getApiBaseUrl(),
    validateStatus: () => true,
  });

  return createAxiosSharedClient(
    publicApiV3SearchEstablishmentRoutes,
    axiosInstance,
  );
};

export const searchImmersionOffers = async (
  params: SearchImmersionOffersParams,
): Promise<SearchImmersionOffersResult> => {
  const response = await createApiClient().getOffers({
    headers: { authorization: getApiToken() },
    queryParams: params,
  });

  return match(response)
    .with({ status: 200 }, ({ body }) => body)
    .with({ status: P.union(400, 401, 403, 429) }, ({ status, body }) => {
      throw new ImmersionFacileApiError(status, body.message, body.issues);
    })
    .otherwise(({ status }) => {
      throw new ImmersionFacileApiError(
        status,
        `Immersion Facilitée API request failed with status ${status}.`,
      );
    });
};
