import { keys, values } from "ramda";
import {
  type ConnectedUserDomainJwtPayload,
  type ConnectedUserJwt,
  type ConventionDomainJwtPayload,
  type ConventionJwt,
  type EmailAuthCodeJwt,
  errors,
  type FollowedIds,
  frontRoutes,
  type LinkRenewalParams,
  type OAuthState,
  type OtpDomainJwtPayload,
  type OtpJwt,
  otpDomainJwtPayloadSchema,
  removeAllParamsFromUrl,
  renewExpiredJwtRequestSchema,
  type ShortLinkId,
} from "shared";
import { match } from "ts-pattern";
import type { AppConfig } from "../../../../../config/bootstrap/appConfig";
import type {
  GenerateConnectedUserLoginUrl,
  GenerateConventionMagicLinkRouteName,
  GenerateConventionMagicLinkUrl,
  GenerateEmailAuthCodeUrl,
  GenerateOtpLinkUrl,
} from "../../../../../config/bootstrap/magicLinkUrl";
import {
  conventionEmailsByRole,
  throwIfRoleHasNoMagicLink,
} from "../../../../../utils/convention";
import { getConventionActorMatchingEmailHashOrThrow } from "../../../../../utils/emailHash";
import {
  extractJwtPayloadFromExpiredJwt,
  makeEmailHash,
} from "../../../../../utils/jwt";
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
  generateOtpLinkUrl: GenerateOtpLinkUrl;
  config: AppConfig;
  timeGateway: TimeGateway;
  shortLinkIdGeneratorGateway: ShortLinkIdGeneratorGateway;
  saveNotificationAndRelatedEvent: SaveNotificationAndRelatedEvent;
  createNewEvent: CreateNewEvent;
};

export const makeRenewExpiredJwt = useCaseBuilder("RenewExpiredJwt")
  .withInput(renewExpiredJwtRequestSchema)
  .withDeps<Deps>()
  .build(async ({ inputParams, uow, deps }) =>
    match(inputParams)
      .with({ kind: "convention" }, ({ expiredJwt, originalUrl }) =>
        onConventionDomainJwtPayload(
          uow,
          extractConventionDomainJwtPayloadOrThrow(deps.config, expiredJwt),
          originalUrl,
          deps,
        ),
      )
      .with(
        { kind: "conventionFromShortLink" },
        ({ shortLinkId, expiredJwt }) =>
          onConventionFromShortLink(uow, shortLinkId, expiredJwt, deps),
      )
      .with({ kind: "connectedUser" }, ({ expiredJwt }) =>
        onConnectedUserDomainJwtPayload({
          uow,
          jwtPayload: extractConnectedUserDomainJwtPayloadOrThrow(
            deps.config,
            expiredJwt,
          ),
          deps,
        }),
      )
      .with({ kind: "emailAuthCode" }, ({ expiredJwt, state }) => {
        throwIfNotEmailAuthCodeDomainJwtPayload(deps.config, expiredJwt);
        // à partir d'un jwt emailAuthCode, un utilisateur peut piffer des states ids : faille de sécu ?
        return onEmailAuthCodeDomainJwtPayload({ state, uow, deps });
      })
      .with({ kind: "otp" }, ({ expiredJwt }) =>
        onOtpDomainJwtPayload({
          uow,
          jwtPayload: extractOtpDomainJwtPayloadOrThrow(
            deps.config,
            expiredJwt,
          ),
          deps,
        }),
      )
      .exhaustive(),
  );

const extractConventionDomainJwtPayloadOrThrow = (
  config: AppConfig,
  expiredJwt: ConventionJwt,
): ConventionDomainJwtPayload => {
  const jwtPayload = extractJwtPayloadFromExpiredJwt(config, expiredJwt);
  if (!("applicationId" in jwtPayload))
    throw errors.user.unsupportedJwtPayload();
  return jwtPayload;
};

const extractConnectedUserDomainJwtPayloadOrThrow = (
  config: AppConfig,
  expiredJwt: ConnectedUserJwt,
): ConnectedUserDomainJwtPayload => {
  const jwtPayload = extractJwtPayloadFromExpiredJwt(config, expiredJwt);
  if (!("userId" in jwtPayload)) throw errors.user.unsupportedJwtPayload();
  return jwtPayload;
};

const throwIfNotEmailAuthCodeDomainJwtPayload = (
  config: AppConfig,
  expiredJwt: EmailAuthCodeJwt,
): void => {
  const jwtPayload = extractJwtPayloadFromExpiredJwt(config, expiredJwt);
  if (!("emailAuthCode" in jwtPayload))
    throw errors.user.unsupportedJwtPayload();
};

const extractOtpDomainJwtPayloadOrThrow = (
  config: AppConfig,
  expiredJwt: OtpJwt,
): OtpDomainJwtPayload => {
  const result = otpDomainJwtPayloadSchema.safeParse(
    extractJwtPayloadFromExpiredJwt(config, expiredJwt),
  );
  if (!result.success) throw errors.user.unsupportedJwtPayload();
  return result.data;
};

const onConventionFromShortLink = async (
  uow: UnitOfWork,
  shortLinkId: ShortLinkId,
  expiredJwt: ConventionJwt,
  deps: Deps,
): Promise<void> => {
  const shortLink = await uow.shortLinkQuery.getById(shortLinkId);
  if (!shortLink) throw errors.shortLink.notFound({ shortLinkId });
  return onConventionDomainJwtPayload(
    uow,
    extractConventionDomainJwtPayloadOrThrow(deps.config, expiredJwt),
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
        followedIds: {},
        params: {
          link: await prepareEmailAuthCodeShortLinkMaker({
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
    followedIds: { userId: user.id },
    params: {
      link: await prepareConnectedUserMagicShortLinkMaker({
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
  const role = throwIfRoleHasNoMagicLink(conventionJwt.role);

  const convention = await uow.conventionRepository.getById(
    conventionJwt.applicationId,
  );
  if (!convention)
    throw errors.convention.notFound({
      conventionId: conventionJwt.applicationId,
    });

  const emails = conventionEmailsByRole(convention)(role);

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
      role,
      email: emailMatchingEmailHash,
      now: deps.timeGateway.now(),
    },
  });

  const routeToRenew: GenerateConventionMagicLinkRouteName =
    findRouteToRenew(originalUrl);

  await sendTokenRenewal({
    uow,
    email: emailMatchingEmailHash,
    followedIds: {
      conventionId: convention.id,
      agencyId: convention.agencyId,
      establishmentSiret: convention.siret,
    },
    params: {
      internshipKind: convention.internshipKind,
      link: await makeConventionMagicShortLink({
        targetRoute: routeToRenew,
        lifetime: "1Month",
      }),
      conventionId: convention.id,
    },
    deps,
  });
};

const onOtpDomainJwtPayload = async ({
  uow,
  jwtPayload: { purpose, subject },
  deps,
}: {
  uow: UnitOfWork;
  jwtPayload: OtpDomainJwtPayload;
  deps: Deps;
}): Promise<void> =>
  match(purpose)
    .with("manageConvention", async (): Promise<void> => {
      const convention = await uow.conventionRepository.getById(
        subject.conventionId,
      );

      if (!convention)
        throw errors.convention.notFound({
          conventionId: subject.conventionId,
        });

      const actor = getConventionActorMatchingEmailHashOrThrow({
        convention,
        emailHash: subject.emailHash,
        role: subject.role,
      });

      await sendTokenRenewal({
        uow,
        email: actor.email,
        followedIds: {
          conventionId: convention.id,
          agencyId: convention.agencyId,
          establishmentSiret: convention.siret,
        },
        params: {
          conventionId: convention.id,
          internshipKind: convention.internshipKind,
          link: deps.generateOtpLinkUrl({
            purpose,
            subject,
            now: deps.timeGateway.now(),
          }),
        },
        deps,
      });
    })
    .exhaustive();

const sendTokenRenewal = async ({
  uow,
  email,
  followedIds,
  params,
  deps,
}: {
  uow: UnitOfWork;
  email: string;
  followedIds: FollowedIds;
  params: LinkRenewalParams;
  deps: Deps;
}): Promise<void> => {
  await deps.saveNotificationAndRelatedEvent(
    uow,
    {
      kind: "email",
      templatedContent: {
        kind: "LINK_RENEWAL",
        recipients: [email],
        params,
      },
      followedIds,
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
