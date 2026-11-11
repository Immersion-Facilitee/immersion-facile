import {
  type AbsoluteUrl,
  type ConnectedUserQueryParams,
  type ConventionActorRole,
  type ConventionId,
  type DateTimeIsoString,
  decodeURIWithParams,
  type Email,
  type FrontRouteKeys,
  frontRoutes,
  makeRouteAbsoluteUrl,
  type OAuthSuccessLoginParams,
  type OmitFromExistingKeys,
  queryParamsAsString,
  type User,
  type WithAcquisitionQueryParams,
} from "shared";
import type { EmailOrProConnectOngoingAuth } from "../../domains/core/authentication/connected-user/entities/OngoingOAuth";
import type {
  GenerateConnectedUserJwt,
  GenerateConventionJwt,
  GenerateEmailAuthCodeJwt,
  GenerateVisitorOtpJwt,
} from "../../domains/core/jwt";
import {
  type CreateConventionMagicLinkPayloadProperties,
  createConnectedUserJwtPayload,
  createConventionMagicLinkPayload,
  createEmailAuthCodeJwtPayload,
  createVisitorOtpJwtPayload,
  makeEmailHash,
} from "../../utils/jwt";
import type { AppConfig } from "./appConfig";

export type GenerateConventionMagicLinkUrl = ReturnType<
  typeof makeGenerateConventionMagicLinkUrl
>;

export type ConventionMagicLinkLifetime = "1Month" | "2Days";

export type GenerateConventionMagicLinkRouteName = Extract<
  FrontRouteKeys,
  | "conventionImmersion"
  | "conventionToSign"
  | "unregisterEstablishmentLead"
  | "assessment"
  | "assessmentDocument"
  | "conventionDocument"
  | "manageConvention"
>;

export const makeGenerateConventionMagicLinkUrl =
  (config: AppConfig, generateConventionJwt: GenerateConventionJwt) =>
  ({
    targetRoute,
    lifetime = "1Month",
    extraQueryParams = {},
    ...jwtPayload
  }: OmitFromExistingKeys<
    CreateConventionMagicLinkPayloadProperties,
    "durationDays"
  > & {
    extraQueryParams?: WithAcquisitionQueryParams;
    targetRoute: GenerateConventionMagicLinkRouteName;
    lifetime?: ConventionMagicLinkLifetime;
  }): AbsoluteUrl => {
    const durationDaysByLifetime = {
      "2Days": config.conventionJwtTwoDaysDuration,
      "1Month": config.conventionJwt1MonthDurationInDays,
    };

    const jwt = generateConventionJwt(
      createConventionMagicLinkPayload({
        ...jwtPayload,
        durationDays: durationDaysByLifetime[lifetime],
      }),
    );

    return makeRouteAbsoluteUrl({
      route: frontRoutes[targetRoute]({
        ...extraQueryParams,
        jwt,
      }),
      baseUrl: config.immersionFacileBaseUrl,
    });
  };

export type GenerateConnectedUserLoginUrl = ReturnType<
  typeof makeGenerateConnectedUserLoginUrl
>;

export type GenerateConnectedUserLoginUrlParams = {
  user: User;
  ongoingOAuth: EmailOrProConnectOngoingAuth;
  now: Date;
};

export const makeGenerateConnectedUserLoginUrl =
  (config: AppConfig, generateConnectedUserJwt: GenerateConnectedUserJwt) =>
  ({
    user,
    ongoingOAuth,
    now,
  }: GenerateConnectedUserLoginUrlParams): AbsoluteUrl => {
    const { uriWithoutParams, params } = decodeURIWithParams(
      ongoingOAuth.fromUri,
    );

    const jwt = generateConnectedUserJwt(
      createConnectedUserJwtPayload({
        userId: user.id,
        now,
        durationHours: config.connectedUserJwtDurationInHours,
      }),
    );

    const queryParams = queryParamsAsString<ConnectedUserQueryParams>({
      ...params,
      token: jwt,
      provider: ongoingOAuth.provider,
    });

    return `${config.immersionFacileBaseUrl}${uriWithoutParams}?${queryParams}`;
  };

export type GenerateEmailAuthCodeUrl = ReturnType<
  typeof makeGenerateEmailAuthCodeUrl
>;

export type GenerateEmailAuthCodeUrlParams = {
  targetRoute: Extract<FrontRouteKeys, "magicLinkInterstitial">;
  state: string;
  email: Email;
  now: Date;
};

export type EmailAuthCodeUrlQueryParams = OAuthSuccessLoginParams & {
  email: Email;
};

export const makeGenerateEmailAuthCodeUrl =
  (config: AppConfig, generateEmailAuthCodeJwt: GenerateEmailAuthCodeJwt) =>
  ({
    email,
    state,
    targetRoute,
    now,
  }: GenerateEmailAuthCodeUrlParams): {
    url: AbsoluteUrl;
    expiresAt: DateTimeIsoString;
  } => {
    const payload = createEmailAuthCodeJwtPayload({
      now,
      durationMinutes: config.emailAuthCodeJwtDurationInMinutes,
      emailAuthCode: true,
    });
    const jwt = generateEmailAuthCodeJwt(payload);
    const expiresInMs = payload.exp * 1000;

    return {
      url: makeRouteAbsoluteUrl({
        route: frontRoutes[targetRoute]({
          code: jwt,
          email,
          state,
        }),
        baseUrl: config.immersionFacileBaseUrl,
      }),
      expiresAt: new Date(expiresInMs).toISOString(),
    };
  };

export type GenerateVisitorOtpUrl = ReturnType<
  typeof makeGenerateVisitorOtpUrl
>;

export type GenerateVisitorOtpRouteName = Extract<
  FrontRouteKeys,
  | "conventionImmersion"
  | "conventionToSign"
  | "unregisterEstablishmentLead"
  | "assessment"
  | "assessmentDocument"
  | "conventionDocument"
  | "manageConvention"
>;

export type GenerateVisitorOtpUrlParams = {
  conventionId: ConventionId;
  role: ConventionActorRole;
  email: Email;
  now: Date;
  targetRoute: GenerateVisitorOtpRouteName;
  extraQueryParams?: WithAcquisitionQueryParams;
};

export const makeGenerateVisitorOtpUrl =
  (config: AppConfig, generateVisitorOtpJwt: GenerateVisitorOtpJwt) =>
  ({
    conventionId,
    role,
    email,
    now,
    targetRoute,
    extraQueryParams = {},
  }: GenerateVisitorOtpUrlParams): AbsoluteUrl => {
    const jwt = generateVisitorOtpJwt(
      createVisitorOtpJwtPayload({
        purpose: "manageConvention",
        subject: {
          conventionId,
          role,
          emailHash: makeEmailHash(email),
        },
        now,
      }),
    );

    return makeRouteAbsoluteUrl({
      route: frontRoutes[targetRoute]({
        ...extraQueryParams,
        jwt,
      }),
      baseUrl: config.immersionFacileBaseUrl,
    });
  };
