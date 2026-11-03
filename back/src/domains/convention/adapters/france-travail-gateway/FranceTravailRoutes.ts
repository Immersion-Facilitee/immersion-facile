import {
  type AbsoluteUrl,
  withAuthorizationHeaders,
  type ZodSchemaWithInputMatchingOutput,
} from "shared";
import { defineRoute, defineRoutes } from "shared-routes";
import { z } from "zod";
import type { AccessTokenResponse } from "../../../../config/bootstrap/appConfig";
import { broadcastPayloadSchema } from "../../use-cases/broadcast/broadcastConvention.schema";

export const getFtTestPrefix = (ftApiUrl: AbsoluteUrl) =>
  ["https://api.peio.pe-qvr.fr", "https://api-r.es-qvr.fr"].includes(ftApiUrl)
    ? "test"
    : "";

export type FrancetTravailRoutes = ReturnType<typeof createFranceTravailRoutes>;

const ftBusinessError = z.object({
  codeErreur: z.string().optional(),
  codeHttp: z.number(),
  message: z.string(),
});

const ftAuthError = z.object({
  error: z.string(),
  error_description: z.string(),
});

const ftAccessTokenResponseSchema: ZodSchemaWithInputMatchingOutput<AccessTokenResponse> =
  z.object({
    access_token: z.string(),
    expires_in: z.number(),
    scope: z.string(),
    token_type: z.string(),
  });

export const createFranceTravailRoutes = ({
  ftApiUrl,
  ftEnterpriseUrl,
}: {
  ftApiUrl: AbsoluteUrl;
  ftEnterpriseUrl: AbsoluteUrl;
}) => {
  const ftTestPrefix = getFtTestPrefix(ftApiUrl);

  return defineRoutes({
    getAccessToken: defineRoute({
      method: "post",
      url: `${ftEnterpriseUrl}/connexion/oauth2/access_token?realm=%2Fpartenaire`,
      headersSchema: z.object({
        "Content-Type": z.literal("application/x-www-form-urlencoded"),
      }),
      requestBodySchema: z.string(),
      responses: {
        200: ftAccessTokenResponseSchema,
        400: ftAuthError,
        429: z.any(),
        503: z.any(),
      },
    }),
    broadcastConvention: defineRoute({
      method: "post",
      url: `${ftApiUrl}/partenaire/${ftTestPrefix}immersion-pro/v3/demandes-immersion`, // we need to wait for FT to provide the new URL
      requestBodySchema: broadcastPayloadSchema,
      ...withAuthorizationHeaders,
      responses: {
        200: z.any(),
        201: z.any(),
        204: z.any(),
        400: ftBusinessError.or(z.string()),
        404: ftBusinessError,
      },
    }),
  });
};
