import {
  type ConnectedUserJwt,
  type ConnectedUserQueryParams,
  decodeURIWithParams,
  filterNotFalsy,
  frontRoutes,
  makeRouteAbsoluteUrl,
  queryParamsAsString,
  type WithAcquisitionQueryParams,
} from "shared";
import type {
  ConventionMagicLinkLifetime,
  GenerateConnectedUserLoginUrl,
  GenerateConventionMagicLinkRouteName,
  GenerateConventionMagicLinkUrl,
  GenerateEmailAuthCodeUrl,
} from "../config/bootstrap/magicLinkUrl";
import type { GenerateApiConsumerJwt } from "../domains/core/jwt";
import type { CreateConventionMagicLinkPayloadProperties } from "./jwt";

export const generateApiConsumerJwtTestFn: GenerateApiConsumerJwt = ({
  id,
  iat,
  version,
}) => `FAKE-API-CONSUMER-JWT-${id}-version-${version}-iat-${iat}`;

export const fakeGenerateMagicLinkUrlFn: GenerateConventionMagicLinkUrl = ({
  email,
  id,
  now,
  role,
  targetRoute,
  lifetime = "1Month",
  extraQueryParams = {},
}: CreateConventionMagicLinkPayloadProperties & {
  extraQueryParams?: WithAcquisitionQueryParams;
  targetRoute: GenerateConventionMagicLinkRouteName;
  lifetime?: ConventionMagicLinkLifetime;
}) => {
  const fakeJwt = [id, role, now.toISOString(), email, lifetime]
    .filter(filterNotFalsy)
    .join("/");

  return makeRouteAbsoluteUrl({
    route: frontRoutes[targetRoute]({
      ...extraQueryParams,
      jwt: fakeJwt,
    }),
    baseUrl: "http://fake-magic-link",
  });
};

export const fakeGenerateConnectedUserUrlFn: GenerateConnectedUserLoginUrl = ({
  user,
  ongoingOAuth,
}) => {
  const { uriWithoutParams, params } = decodeURIWithParams(
    ongoingOAuth.fromUri,
  );

  return `http://fake-connected-user${uriWithoutParams}?${queryParamsAsString<ConnectedUserQueryParams>(
    {
      ...params,
      token: `jwt-${user.id}` as ConnectedUserJwt,
      provider: ongoingOAuth.provider,
    },
  )}`;
};

export const fakeGenerateEmailAuthCodeUrlFn: GenerateEmailAuthCodeUrl = ({
  email,
  state,
  targetRoute,
}) =>
  makeRouteAbsoluteUrl({
    route: frontRoutes[targetRoute]({
      code: "EmailAuthCodeJwt",
      email,
      state,
    }),
    baseUrl: "http://fake-connected-user",
  });
