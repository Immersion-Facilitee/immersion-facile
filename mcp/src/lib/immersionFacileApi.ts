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
import { createFetchSharedClient } from "shared-routes/fetch";
import { match, P } from "ts-pattern";

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

const getDomain = () => {
  const domain = process.env.DOMAIN?.trim();

  if (!domain) {
    throw new ImmersionFacileApiError(
      500,
      "DOMAIN is not configured on the MCP server.",
    );
  }

  return domain.replace(/\/$/, "");
};

export const getFrontBaseUrl = (): AbsoluteUrl => {
  const domain = getDomain();
  return toAbsoluteUrl(
    domain.includes("localhost") ? `http://${domain}` : `https://${domain}`,
  );
};

export const getApiBaseUrl = (): AbsoluteUrl =>
  toAbsoluteUrl(`${getFrontBaseUrl()}/api`);

export const buildOfferUrl = (
  offer: Pick<
    SearchImmersionResultPublicV3,
    "siret" | "locationId" | "appellations"
  >,
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

const createApiClient = () =>
  createFetchSharedClient(publicApiV3SearchEstablishmentRoutes, fetch, {
    baseURL: getApiBaseUrl(),
  });

let apiClient: ReturnType<typeof createApiClient> | undefined;

const getApiClient = () => {
  apiClient ??= createApiClient();
  return apiClient;
};

export const searchImmersionOffers = async (
  params: GetOffersFlatParamsPublicV3,
): Promise<DataWithPagination<SearchImmersionResultPublicV3>> => {
  const response = await getApiClient().getOffers({
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
