import { decode, TokenExpiredError } from "jsonwebtoken";
import { keys, values } from "ramda";
import {
  type AppSupportedDomainJwtPayload,
  type AppSupportedJwt,
  type ConnectedUserDomainJwtPayload,
  type ConventionDomainJwtPayload,
  errors,
  ForbiddenError,
  frontRoutes,
  type MagicLinkRenewalParams,
  type OAuthState,
  removeAllParamsFromUrl,
  renewExpiredJwtRequestSchema,
  type ShortLinkId,
} from "shared";
import type { AppConfig } from "../../../../../config/bootstrap/appConfig";
import { verifyJwtConfig } from "../../../../../config/bootstrap/authMiddleware";
import type {
  GenerateConnectedUserLoginUrl,
  GenerateConventionMagicLinkRouteName,
  GenerateConventionMagicLinkUrl,
  GenerateEmailAuthCodeUrl,
} from "../../../../../config/bootstrap/magicLinkUrl";
import { agencyWithRightToAgencyDto } from "../../../../../utils/agency";
import { conventionEmailsByRole } from "../../../../../utils/convention";
import { makeEmailHash } from "../../../../../utils/jwt";
import { retrieveConventionWithAgency } from "../../../../convention/entities/Convention";
import type { CreateNewEvent } from "../../../events/ports/EventBus";
import type { SaveNotificationAndRelatedEvent } from "../../../notifications/helpers/Notification";
import type { ShortLinkIdGeneratorGateway } from "../../../short-link/ports/ShortLinkIdGeneratorGateway";
import {
  prepareConnectedUserMagicShortLinkMaker,
  prepareConventionMagicShortLinkMaker,
  prepareEmailAuthCodeShortLinkMaker,
} from "../../../short-link/ShortLink";
import type { TimeGateway } from "../../../time-gateway/ports/TimeGateway";
import type { UnitOfWork } from "../../../unit-of-work/ports/UnitOfWork";
import { useCaseBuilder } from "../../../useCaseBuilder";

export type RenewExpiredJwt = ReturnType<typeof makeRenewExpiredJwt>;

type Deps = {
  generateConventionMagicLinkUrl: GenerateConventionMagicLinkUrl;
  generateConnectedUserLoginUrl: GenerateConnectedUserLoginUrl;
  generateEmailAuthCodeUrl: GenerateEmailAuthCodeUrl;
  config: AppConfig;
  timeGateway: TimeGateway;
  shortLinkIdGeneratorGateway: ShortLinkIdGeneratorGateway;
  saveNotificationAndRelatedEvent: SaveNotificationAndRelatedEvent;
  createNewEvent: CreateNewEvent;
};

export const makeRenewExpiredJwt = useCaseBuilder("RenewExpiredJwt")
  .withInput(renewExpiredJwtRequestSchema)
  .withDeps<Deps>()
  .build(async ({ inputParams, uow, deps }) => {
    if (inputParams.kind === "conventionFromShortLink")
      return onConventionFromShortLink(
        uow,
        inputParams.shortLinkId,
        inputParams.expiredJwt,
        deps,
      );

    const appSupportedJwtPayload = extractJwtPayloadFromExpiredJwt(
      deps.config,
      inputParams.expiredJwt,
    );

    if (
      "applicationId" in appSupportedJwtPayload &&
      "originalUrl" in inputParams
    )
      return onConventionDomainJwtPayload(
        uow,
        appSupportedJwtPayload,
        inputParams.originalUrl,
        deps,
      );

    if ("emailAuthCode" in appSupportedJwtPayload && "state" in inputParams) {
      // à partir d'un jwt emailAuthCode, un utilisateur peut piffer des states ids : faille de sécu ?
      return onEmailAuthCodeDomainJwtPayload({
        state: inputParams.state,
        uow,
        deps,
      });
    }

    if ("userId" in appSupportedJwtPayload)
      return onConnectedUserDomainJwtPayload({
        uow,
        jwtPayload: appSupportedJwtPayload,
        deps,
      });

    throw errors.user.unsupportedJwtPayload();
  });

const onConventionFromShortLink = async (
  uow: UnitOfWork,
  shortLinkId: ShortLinkId,
  expiredJwt: string,
  deps: Deps,
): Promise<void> => {
  const shortLink = await uow.shortLinkQuery.getById(shortLinkId);
  if (!shortLink) throw errors.shortLink.notFound({ shortLinkId });
  const appSupportedJwtPayload = extractJwtPayloadFromExpiredJwt(
    deps.config,
    expiredJwt,
  );
  if (!("applicationId" in appSupportedJwtPayload))
    throw errors.user.unsupportedJwtPayload();
  return onConventionDomainJwtPayload(
    uow,
    appSupportedJwtPayload,
    shortLink.url,
    deps,
  );
};

const onEmailAuthCodeDomainJwtPayload = async ({
  state,
  uow,
  deps,
}: {
  state: OAuthState;
  uow: UnitOfWork;
  deps: Deps;
}): Promise<void> => {
  const ongoingOAuth = await uow.ongoingOAuthRepository.findByState(state);

  if (!ongoingOAuth) throw errors.auth.missingOAuth({ state });
  if (ongoingOAuth.provider !== "email")
    throw errors.auth.otherRenewalNotSupported(ongoingOAuth.provider);

  return ongoingOAuth.usedAt
    ? uow.outboxRepository.save(
        deps.createNewEvent({
          topic: "UserAuthenticationByEmailRequested",
          payload: {
            email: ongoingOAuth.email,
            redirectUri: ongoingOAuth.fromUri,
          },
        }),
      )
    : sendTokenRenewal({
        uow,
        email: ongoingOAuth.email,
        params: {
          magicLink: await prepareEmailAuthCodeShortLinkMaker({
            uow,
            config: deps.config,
            generateEmailAuthCodeLoginUrl: deps.generateEmailAuthCodeUrl,
            shortLinkIdGeneratorGateway: deps.shortLinkIdGeneratorGateway,
          })({
            email: ongoingOAuth.email,
            now: deps.timeGateway.now(),
            state: ongoingOAuth.state,
            targetRoute: "magicLinkInterstitial",
          }),
        },
        deps,
      });
};

const onConnectedUserDomainJwtPayload = async ({
  uow,
  jwtPayload: { userId },
  deps,
}: {
  uow: UnitOfWork;
  jwtPayload: ConnectedUserDomainJwtPayload;
  deps: Deps;
}): Promise<void> => {
  const user = await uow.userRepository.getById(userId);

  if (!user) throw errors.user.notFound({ userId });

  const ongoingOAuth = await uow.ongoingOAuthRepository.findByUserId(user.id);

  if (!ongoingOAuth) throw errors.auth.missingOAuth({});
  if (!ongoingOAuth.usedAt) throw errors.auth.unusedOAuth();
  if (ongoingOAuth.provider !== "email")
    throw errors.auth.otherRenewalNotSupported(ongoingOAuth.provider);

  await sendTokenRenewal({
    deps,
    uow,
    email: user.email,
    params: {
      magicLink: await prepareConnectedUserMagicShortLinkMaker({
        uow,
        config: deps.config,
        shortLinkIdGeneratorGateway: deps.shortLinkIdGeneratorGateway,
        generateConnectedUserLoginUrl: deps.generateConnectedUserLoginUrl,
      })({
        user,
        ongoingOAuth,
        now: deps.timeGateway.now(),
      }),
    },
  });
};

const onConventionDomainJwtPayload = async (
  uow: UnitOfWork,
  conventionJwt: ConventionDomainJwtPayload,
  originalUrl: string,
  deps: Deps,
): Promise<void> => {
  const { agency, convention } = await retrieveConventionWithAgency(
    uow,
    conventionJwt.applicationId,
  );

  const emails = conventionEmailsByRole(
    convention,
    await agencyWithRightToAgencyDto(uow, agency),
  )(conventionJwt.role);

  const emailMatchingEmailHash = emails.find(
    (email) => makeEmailHash(email) === conventionJwt.emailHash,
  );

  if (!emailMatchingEmailHash)
    throw errors.convention.magicLinkNotAssociatedToConvention();

  const makeConventionMagicShortLink = prepareConventionMagicShortLinkMaker({
    uow,
    config: deps.config,
    generateConventionMagicLinkUrl: deps.generateConventionMagicLinkUrl,
    shortLinkIdGeneratorGateway: deps.shortLinkIdGeneratorGateway,
    conventionMagicLinkPayload: {
      id: convention.id,
      role: conventionJwt.role,
      email: emailMatchingEmailHash,
      now: deps.timeGateway.now(),
    },
  });

  const routeToRenew: GenerateConventionMagicLinkRouteName =
    findRouteToRenew(originalUrl);

  await sendTokenRenewal({
    uow,
    email: emailMatchingEmailHash,
    params: {
      internshipKind: convention.internshipKind,
      magicLink: await makeConventionMagicShortLink({
        targetRoute: routeToRenew,
        lifetime: "1Month",
      }),
      conventionId: convention.id,
    },
    deps,
  });
};

const sendTokenRenewal = async ({
  uow,
  email,
  params,
  deps,
}: {
  uow: UnitOfWork;
  email: string;
  params: MagicLinkRenewalParams;
  deps: Deps;
}): Promise<void> => {
  await deps.saveNotificationAndRelatedEvent(
    uow,
    {
      kind: "email",
      templatedContent: {
        kind: "MAGIC_LINK_RENEWAL",
        recipients: [email],
        params,
      },
      followedIds: {
        conventionId: params.conventionId,
      },
    },
    { priority: 2 },
  );
};

const findRouteToRenew = (
  originalUrl: string,
): GenerateConventionMagicLinkRouteName => {
  const supportedRenewRoutesByRouteName: Record<
    GenerateConventionMagicLinkRouteName,
    string
  > = {
    conventionToSign: frontRoutes.conventionToSign({ jwt: "" }).href,
    manageConvention: frontRoutes.manageConvention({ jwt: "" }).href,
    assessment: frontRoutes.assessment({ jwt: "" }).href,
    assessmentDocument: frontRoutes.assessmentDocument({ jwt: "" }).href,
    conventionImmersion: frontRoutes.conventionImmersion({ jwt: "" }).href,
    unregisterEstablishmentLead: frontRoutes.unregisterEstablishmentLead({
      jwt: "",
    }).href,
    conventionDocument: frontRoutes.conventionDocument({ jwt: "" }).href,
  };

  const supportedRouteToRenew = keys(supportedRenewRoutesByRouteName).find(
    (routeName) =>
      decodeURIComponent(originalUrl).includes(
        removeAllParamsFromUrl(supportedRenewRoutesByRouteName[routeName]),
      ),
  );

  if (!supportedRouteToRenew)
    throw errors.convention.unsupportedRenewRoute({
      supportedRenewRoutes: values(supportedRenewRoutesByRouteName),
      originalUrl,
    });
  return supportedRouteToRenew;
};

const extractJwtPayloadFromExpiredJwt = (
  config: AppConfig,
  expiredJwt: AppSupportedJwt,
): AppSupportedDomainJwtPayload => {
  const { verifyJwt, verifyDeprecatedJwt } = verifyJwtConfig(config);
  let payloadToExtract: AppSupportedDomainJwtPayload | undefined;
  try {
    // If the following doesn't throw, we're dealing with a JWT that we signed, so it's
    // probably expired or an old version.
    payloadToExtract = verifyJwt(expiredJwt) as AppSupportedDomainJwtPayload;
  } catch (err) {
    // If this JWT is signed by us but expired, deal with it.
    if (err instanceof TokenExpiredError) {
      payloadToExtract = decode(expiredJwt) as AppSupportedDomainJwtPayload;
    } else {
      // Perhaps this is a JWT that is signed by a compromised key.
      try {
        verifyDeprecatedJwt(expiredJwt);
        // If the above didn't throw, this is a JWT that we issued. Renew it.
        // However, we cannot trust the contents of it, as the private key was potentially
        // compromised. Therefore, only use the convention ID and the role from it, and fill
        // the remaining data from the database to prevent a hacker from getting magic links
        // for any convention form.
        payloadToExtract = decode(expiredJwt) as AppSupportedDomainJwtPayload;
      } catch (_) {
        // We don't want to renew this JWT.
        throw new ForbiddenError();
      }
    }
  }
  // Convention JWT payload is not validated
  if (payloadToExtract) return payloadToExtract;
  throw errors.convention.malformedExpiredJwt();
};
