import type {
  AbsoluteUrl,
  ShortLinkId,
  WithAcquisitionQueryParams,
} from "shared";
import type { AppConfig } from "../../../config/bootstrap/appConfig";
import type {
  ConventionMagicLinkLifetime,
  GenerateConnectedUserLoginUrl,
  GenerateConnectedUserLoginUrlParams,
  GenerateConventionMagicLinkRouteName,
  GenerateConventionMagicLinkUrl,
  GenerateEmailAuthCodeUrl,
  GenerateEmailAuthCodeUrlParams,
} from "../../../config/bootstrap/magicLinkUrl";
import type { CreateConventionMagicLinkPayloadProperties } from "../../../utils/jwt";
import type { UnitOfWork } from "../unit-of-work/ports/UnitOfWork";
import type { ShortLinkIdGeneratorGateway } from "./ports/ShortLinkIdGeneratorGateway";

export const makeShortLinkUrl = (
  config: AppConfig,
  shortLinkId: ShortLinkId,
): AbsoluteUrl => `${config.immersionFacileBaseUrl}/api/to/${shortLinkId}`;

type MakeMagicLinkAndProvidesShortLinkProperties = {
  conventionMagicLinkPayload: CreateConventionMagicLinkPayloadProperties;
  uow: UnitOfWork;
  generateConventionMagicLinkUrl: GenerateConventionMagicLinkUrl;
  shortLinkIdGeneratorGateway: ShortLinkIdGeneratorGateway;
  config: AppConfig;
};

type ProvidesShortLinkProperties = {
  uow: UnitOfWork;
  shortLinkIdGeneratorGateway: ShortLinkIdGeneratorGateway;
  config: AppConfig;
  longLink: AbsoluteUrl;
};

export const prepareConventionMagicShortLinkMaker =
  ({
    conventionMagicLinkPayload,
    uow,
    generateConventionMagicLinkUrl,
    shortLinkIdGeneratorGateway,
    config,
  }: MakeMagicLinkAndProvidesShortLinkProperties) =>
  async ({
    targetRoute,
    lifetime,
    extraQueryParams,
  }: {
    extraQueryParams?: WithAcquisitionQueryParams;
    targetRoute: GenerateConventionMagicLinkRouteName;
    lifetime: ConventionMagicLinkLifetime;
  }): Promise<AbsoluteUrl> =>
    makeShortLink({
      uow,
      shortLinkIdGeneratorGateway,
      config,
      longLink: generateConventionMagicLinkUrl({
        ...conventionMagicLinkPayload,
        targetRoute,
        lifetime,
        extraQueryParams,
      }),
    });

export const prepareConnectedUserMagicShortLinkMaker =
  ({
    uow,
    config,
    shortLinkIdGeneratorGateway,
    generateConnectedUserLoginUrl,
  }: {
    uow: UnitOfWork;
    config: AppConfig;
    shortLinkIdGeneratorGateway: ShortLinkIdGeneratorGateway;
    generateConnectedUserLoginUrl: GenerateConnectedUserLoginUrl;
  }) =>
  (params: GenerateConnectedUserLoginUrlParams): Promise<AbsoluteUrl> =>
    makeShortLink({
      uow,
      config,
      shortLinkIdGeneratorGateway,
      longLink: generateConnectedUserLoginUrl(params),
    });

export const prepareEmailAuthCodeShortLinkMaker =
  ({
    uow,
    config,
    shortLinkIdGeneratorGateway,
    generateEmailAuthCodeLoginUrl,
  }: {
    uow: UnitOfWork;
    config: AppConfig;
    shortLinkIdGeneratorGateway: ShortLinkIdGeneratorGateway;
    generateEmailAuthCodeLoginUrl: GenerateEmailAuthCodeUrl;
  }) =>
  (params: GenerateEmailAuthCodeUrlParams): Promise<AbsoluteUrl> =>
    makeShortLink({
      uow,
      config,
      shortLinkIdGeneratorGateway,
      longLink: generateEmailAuthCodeLoginUrl(params),
    });

export const makeShortLink = async ({
  uow,
  shortLinkIdGeneratorGateway,
  config,
  longLink,
}: ProvidesShortLinkProperties): Promise<AbsoluteUrl> => {
  const shortlinkId: ShortLinkId = shortLinkIdGeneratorGateway.generate();

  await uow.shortLinkRepository.save({
    id: shortlinkId,
    url: longLink,
    lastUsedAt: null,
  });

  return makeShortLinkUrl(config, shortlinkId);
};
