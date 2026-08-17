import { keys } from "ramda";
import { z } from "zod";
import {
  type AllowedFtRedirectRoute,
  type AllowedLoginSource,
  type FederatedIdentityProvider,
  frontRoutes,
} from "..";
import { absoluteUrlSchema } from "../AbsoluteUrl";
import { emailSchema } from "../email/email.schema";
import type { ZodSchemaWithInputMatchingOutput } from "../zodUtils";
import {
  type AfterOAuthSuccessRedirectionResponse,
  allowedLoginSources,
  type InitiateLoginByEmailParams,
  type InitiateLoginByOAuthParams,
  type OAuthSuccessLoginParams,
  oAuthProvidersForLogin,
  type WithRedirectUri,
} from "./auth.dto";

const isAllowedRedirectPath = (
  redirectPath: string,
  allowedPaths: (AllowedLoginSource | AllowedFtRedirectRoute)[],
) => {
  if (/^([a-zA-Z][a-zA-Z0-9+.-]*:)?\/\//.test(redirectPath)) {
    return false;
  }
  if (!redirectPath.startsWith("/")) {
    return false;
  }
  const [pathname] = redirectPath.split("?", 1);
  const cleanPath = decodeURIComponent(pathname);

  return allowedPaths.some((path) => {
    const [allowedPath] = {
      ...allowedLoginSources,
      conventionImmersion: frontRoutes.conventionImmersion,
    }
      [path]()
      .href.split("?", 1);

    return cleanPath === allowedPath || cleanPath.startsWith(`${allowedPath}/`);
  });
};

export const withRedirectUriSchema: ZodSchemaWithInputMatchingOutput<WithRedirectUri> =
  z.object({
    redirectUri: z
      .string()
      .refine((uri) => isAllowedRedirectPath(uri, keys(allowedLoginSources)), {
        message: "redirectUri is not allowed",
      }),
  });

export const initiateLoginByOAuthParamsSchema: ZodSchemaWithInputMatchingOutput<InitiateLoginByOAuthParams> =
  z.object({
    redirectUri: z
      .string()
      .refine(
        (uri) =>
          isAllowedRedirectPath(uri, [
            ...keys(allowedLoginSources),
            "conventionImmersion",
          ]),
        {
          message: "redirectUri is not allowed",
        },
      ),
    provider: z.enum(oAuthProvidersForLogin),
  });

export const initiateLoginByEmailParamsSchema: ZodSchemaWithInputMatchingOutput<InitiateLoginByEmailParams> =
  z
    .object({
      email: emailSchema,
    })
    .and(withRedirectUriSchema);

export const oAuthSuccessLoginParamsSchema: ZodSchemaWithInputMatchingOutput<OAuthSuccessLoginParams> =
  z.object({
    code: z.string(),
    state: z.string(),
  });

export const afterOAuthSuccessRedirectionResponseSchema: ZodSchemaWithInputMatchingOutput<AfterOAuthSuccessRedirectionResponse> =
  z.object({
    provider: z.enum(["proConnect", "email"]),
    redirectUri: absoluteUrlSchema,
  });

export const federatedIdentityProviderSchema: ZodSchemaWithInputMatchingOutput<FederatedIdentityProvider> =
  z.enum(["proConnect", "email", "ftConnect"]);
