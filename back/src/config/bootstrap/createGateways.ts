import type { AxiosInstance } from "axios";
import { exhaustiveCheck, immersionFacileNoReplyEmailSender } from "shared";
import type { UnknownSharedRoute } from "shared-routes";
import { createAxiosSharedClient } from "shared-routes/axios";
import { createFetchSharedClient } from "shared-routes/fetch";
import { createFranceTravailRoutes } from "../../domains/convention/adapters/france-travail-gateway/FranceTravailRoutes";
import { HttpFranceTravailGateway } from "../../domains/convention/adapters/france-travail-gateway/HttpFranceTravailGateway";
import { InMemoryFranceTravailGateway } from "../../domains/convention/adapters/france-travail-gateway/InMemoryFranceTravailGateway";
import { HttpAddressGateway } from "../../domains/core/address/adapters/HttpAddressGateway";
import { addressesExternalRoutes } from "../../domains/core/address/adapters/HttpAddressGateway.routes";
import { InMemoryAddressGateway } from "../../domains/core/address/adapters/InMemoryAddressGateway";
import { HttpSubscribersGateway } from "../../domains/core/api-consumer/adapters/HttpSubscribersGateway";
import { InMemorySubscribersGateway } from "../../domains/core/api-consumer/adapters/InMemorySubscribersGateway";
import { InMemoryProConnectOAuthGateway } from "../../domains/core/authentication/connected-user/adapters/oauth-gateway/InMemoryOAuthGateway";
import { ProConnectOAuthGateway } from "../../domains/core/authentication/connected-user/adapters/oauth-gateway/ProConnectOAuthGateway";
import { makeProConnectRoutes } from "../../domains/core/authentication/connected-user/adapters/oauth-gateway/proConnect.routes";
import type { OAuthGateway } from "../../domains/core/authentication/connected-user/port/OAuthGateway";
import { makeFtConnectExternalRoutes } from "../../domains/core/authentication/ft-connect/adapters/ft-connect-gateway/ftConnectApi.routes";
import { HttpFtConnectGateway } from "../../domains/core/authentication/ft-connect/adapters/ft-connect-gateway/HttpFtConnectGateway";
import { InMemoryFtConnectGateway } from "../../domains/core/authentication/ft-connect/adapters/ft-connect-gateway/InMemoryFtConnectGateway";
import type { FtConnectGateway } from "../../domains/core/authentication/ft-connect/port/FtConnectGateway";
import { CryptoOtpCodeGeneratorGateway } from "../../domains/core/authentication/otp-challenge/adapters/otp-code-generator-gateway/CryptoOtpCodeGeneratorGateway";
import { DeterministicOtpCodeGeneratorGateway } from "../../domains/core/authentication/otp-challenge/adapters/otp-code-generator-gateway/DeterministicOtpCodeGeneratorGateway";
import { MetabaseDashboardGateway } from "../../domains/core/dashboard/adapters/MetabaseDashboardGateway";
import { StubDashboardGateway } from "../../domains/core/dashboard/adapters/StubDashboardGateway";
import type { DashboardGateway } from "../../domains/core/dashboard/port/DashboardGateway";
import { EmailableEmailValidationGateway } from "../../domains/core/email-validation/adapters/EmailableEmailValidationGateway";
import { emailableValidationRoutes } from "../../domains/core/email-validation/adapters/EmailableEmailValidationGateway.routes";
import { InMemoryEmailValidationGateway } from "../../domains/core/email-validation/adapters/InMemoryEmailValidationGateway";
import { InMemoryDocumentGateway } from "../../domains/core/file-storage/adapters/InMemoryDocumentGateway";
import { S3DocumentGateway } from "../../domains/core/file-storage/adapters/S3DocumentGateway";
import type { DocumentGateway } from "../../domains/core/file-storage/port/DocumentGateway";
import { BrevoNotificationGateway } from "../../domains/core/notifications/adapters/BrevoNotificationGateway";
import { brevoNotificationGatewayRoutes } from "../../domains/core/notifications/adapters/BrevoNotificationGateway.routes";
import { InMemoryNotificationGateway } from "../../domains/core/notifications/adapters/InMemoryNotificationGateway";
import type { NotificationGateway } from "../../domains/core/notifications/ports/NotificationGateway";
import { InMemoryPdfGeneratorGateway } from "../../domains/core/pdf-generation/adapters/InMemoryPdfGeneratorGateway";
import {
  makeScalingoPdfGeneratorRoutes,
  ScalingoPdfGeneratorGateway,
} from "../../domains/core/pdf-generation/adapters/ScalingoPdfGeneratorGateway";
import type { PdfGeneratorGateway } from "../../domains/core/pdf-generation/ports/PdfGeneratorGateway";
import { noRetries } from "../../domains/core/retry-strategy/ports/RetryStrategy";
import { DiagorienteAppellationsGateway } from "../../domains/core/rome/adapters/DiagorienteAppellationsGateway";
import { diagorienteAppellationsRoutes } from "../../domains/core/rome/adapters/DiagorienteAppellationsGateway.routes";
import { InMemoryAppellationsGateway } from "../../domains/core/rome/adapters/InMemoryAppellationsGateway";
import { DeterministShortLinkIdGeneratorGateway } from "../../domains/core/short-link/adapters/short-link-generator-gateway/DeterministShortLinkIdGeneratorGateway";
import { NanoIdShortLinkIdGeneratorGateway } from "../../domains/core/short-link/adapters/short-link-generator-gateway/NanoIdShortLinkIdGeneratorGateway";
import { AnnuaireDesEntreprisesSiretGateway } from "../../domains/core/sirene/adapters/AnnuaireDesEntreprisesSiretGateway";
import { annuaireDesEntreprisesSiretRoutes } from "../../domains/core/sirene/adapters/AnnuaireDesEntreprisesSiretGateway.routes";
import { InMemorySiretGateway } from "../../domains/core/sirene/adapters/InMemorySiretGateway";
import { InseeSiretGateway } from "../../domains/core/sirene/adapters/InseeSiretGateway";
import { inseeExternalRoutes } from "../../domains/core/sirene/adapters/InseeSiretGateway.routes";
import { crispRoutes } from "../../domains/core/support/adapters/crispRoutes";
import { HttpCrispGateway } from "../../domains/core/support/adapters/HttpCrispGateway";
import { InMemoryCrispApi } from "../../domains/core/support/adapters/InMemoryCrispApi";
import type { CrispGateway } from "../../domains/core/support/ports/CrispGateway";
import { CustomTimeGateway } from "../../domains/core/time-gateway/adapters/CustomTimeGateway";
import { RealTimeGateway } from "../../domains/core/time-gateway/adapters/RealTimeGateway";
import type { TimeGateway } from "../../domains/core/time-gateway/ports/TimeGateway";
import type { UuidGenerator } from "../../domains/core/uuid-generator/ports/UuidGenerator";
import { HttpLaBonneBoiteGateway } from "../../domains/establishment/adapters/la-bonne-boite/HttpLaBonneBoiteGateway";
import { InMemoryLaBonneBoiteGateway } from "../../domains/establishment/adapters/la-bonne-boite/InMemoryLaBonneBoiteGateway";
import { createLbbRoutes } from "../../domains/establishment/adapters/la-bonne-boite/LaBonneBoite.routes";
import { HttpPassEmploiGateway } from "../../domains/establishment/adapters/pass-emploi/HttpPassEmploiGateway";
import { InMemoryPassEmploiGateway } from "../../domains/establishment/adapters/pass-emploi/InMemoryPassEmploiGateway";
import { brevoContactRoutes } from "../../domains/marketing/adapters/establishmentMarketingGateway/BrevoContact.routes";
import { BrevoEstablishmentMarketingGateway } from "../../domains/marketing/adapters/establishmentMarketingGateway/BrevoEstablishmentMarketingGateway";
import { InMemoryEstablishmentMarketingGateway } from "../../domains/marketing/adapters/establishmentMarketingGateway/InMemoryEstablishmentMarketingGateway";
import { makeAxiosInstances } from "../../utils/axiosUtils";
import { createLogger } from "../../utils/logger";
import { type AppConfig, makeEmailAllowListPredicate } from "./appConfig";
import { getWithCache } from "./cache";
import {
  type LogInputCbOnSuccess,
  logPartnerResponses,
} from "./logPartnerResponses";
import { partnerNames } from "./partnerNames";

const logger = createLogger(__filename);

export type Gateways =
  ReturnType<typeof createGateways> extends Promise<infer T> ? T : never;

export const createFetchHttpClientForExternalAPIs = <
  R extends Record<string, UnknownSharedRoute>,
>({
  routes,
  partnerName,
  logInputCbOnSuccess,
  config,
}: {
  routes: R;
  partnerName: string;
  logInputCbOnSuccess?: LogInputCbOnSuccess;
  config: AppConfig;
}) =>
  createFetchSharedClient(routes, fetch, {
    timeout: config.externalAxiosTimeout,
    skipResponseValidation: true,
    onResponseSideEffect: logPartnerResponses({
      partnerName: partnerName,
      logInputCbOnSuccess,
    }),
  });

export const createGateways = async (
  config: AppConfig,
  uuidGenerator: UuidGenerator,
) => {
  //TODO: toujours nécéssaire de log ces configs d'adapters?
  logger.info({
    adapters: {
      notificationGateway: config.notificationGateway,
      repositories: config.repositories,
      romeRepository: config.romeRepository,
      siretGateway: config.siretGateway,
      apiAddress: config.apiAddress,
    },
  });

  const createLegacyAxiosHttpClientForExternalAPIs = <
    R extends Record<string, UnknownSharedRoute>,
  >({
    routes,
    partnerName,
    logInputCbOnSuccess,
    axiosInstance,
  }: {
    routes: R;
    partnerName: string;
    axiosInstance: AxiosInstance;
    logInputCbOnSuccess?: LogInputCbOnSuccess;
  }) =>
    createAxiosSharedClient(routes, axiosInstance, {
      skipResponseValidation: true,
      onResponseSideEffect: logPartnerResponses({
        partnerName,
        logInputCbOnSuccess,
      }),
    });

  const timeGateway =
    config.timeGateway === "CUSTOM"
      ? new CustomTimeGateway()
      : new RealTimeGateway();

  const { axiosWithValidateStatus, axiosWithoutValidateStatus } =
    makeAxiosInstances(config.externalAxiosTimeout);

  const { axiosWithValidateStatus: axiosWithValidateStatusForFranceTravail } =
    makeAxiosInstances(config.externalAxiosTimeoutForFranceTravail);

  const { withCache, disconnectCache } = await getWithCache(config);

  const franceTravailGateway =
    config.franceTravailGateway === "HTTPS"
      ? new HttpFranceTravailGateway(
          createLegacyAxiosHttpClientForExternalAPIs({
            partnerName: partnerNames.franceTravailApi,
            routes: createFranceTravailRoutes({
              ftApiUrl: config.ftApiUrl,
              ftEnterpriseUrl: config.ftEnterpriseUrl,
            }),
            axiosInstance: axiosWithValidateStatusForFranceTravail,
          }),
          withCache,
          config.ftApiUrl,
          config.franceTravailAccessTokenConfig,
          noRetries,
          createFranceTravailRoutes({
            ftApiUrl: config.ftApiUrl,
            ftEnterpriseUrl: config.ftEnterpriseUrl,
          }),
          config.envType === "dev",
        )
      : new InMemoryFranceTravailGateway();

  const ftConnectGateway: FtConnectGateway =
    config.ftConnectGateway === "HTTPS"
      ? new HttpFtConnectGateway(
          createLegacyAxiosHttpClientForExternalAPIs({
            partnerName: partnerNames.franceTravailConnect,
            routes: makeFtConnectExternalRoutes({
              ftApiUrl: config.ftApiUrl,
              ftAuthCandidatUrl: config.ftAuthCandidatUrl,
            }),
            axiosInstance: axiosWithoutValidateStatus,
          }),
          config.ftConnectConfig,
          config.ftConnectMaxRequestsPerInterval,
        )
      : new InMemoryFtConnectGateway();

  const proConnectOAuthGateway: OAuthGateway =
    config.proConnectGateway === "HTTPS"
      ? new ProConnectOAuthGateway(
          createLegacyAxiosHttpClientForExternalAPIs({
            partnerName: partnerNames.proConnect,
            routes: makeProConnectRoutes(
              config.proConnectConfig.providerBaseUri,
            ),
            axiosInstance: axiosWithoutValidateStatus,
          }),
          config.proConnectConfig,
        )
      : new InMemoryProConnectOAuthGateway(config.proConnectConfig);

  const createEmailValidationGateway = (config: AppConfig) =>
    ({
      IN_MEMORY: () => new InMemoryEmailValidationGateway(),
      EMAILABLE: () =>
        new EmailableEmailValidationGateway(
          createFetchHttpClientForExternalAPIs({
            partnerName: partnerNames.emailable,
            routes: emailableValidationRoutes,
            config,
          }),
          config.emailableApiKey,
          withCache,
        ),
    })[config.emailValidationGateway]();

  const appellationsGateway = (config: AppConfig) =>
    ({
      IN_MEMORY: () => new InMemoryAppellationsGateway(),
      DIAGORIENTE: () =>
        new DiagorienteAppellationsGateway(
          createFetchHttpClientForExternalAPIs({
            partnerName: partnerNames.diagoriente,
            routes: diagorienteAppellationsRoutes,
            config,
          }),
          {
            clientId: config.diagorienteApiClientId,
            clientSecret: config.diagorienteApiClientSecret,
          },
          withCache,
        ),
    })[config.appellationsGateway]();

  const addressGateway = {
    IN_MEMORY: () => new InMemoryAddressGateway(),
    OPEN_CAGE_DATA: () =>
      new HttpAddressGateway(
        createFetchHttpClientForExternalAPIs({
          partnerName: partnerNames.openCageData,
          routes: addressesExternalRoutes,
          config,
        }),
        config.apiKeyOpenCageDataGeocoding,
        config.apiKeyOpenCageDataGeosearch,
        withCache,
      ),
  }[config.apiAddress]();

  const createNotificationGateway = (
    config: AppConfig,
    timeGateway: TimeGateway,
  ): NotificationGateway => {
    if (config.notificationGateway === "IN_MEMORY")
      return new InMemoryNotificationGateway(timeGateway);

    const brevoNotificationGateway = new BrevoNotificationGateway(
      {
        httpClient: createFetchHttpClientForExternalAPIs({
          partnerName: partnerNames.brevoNotifications,
          routes: brevoNotificationGatewayRoutes,
          config,
        }),
        defaultSender: immersionFacileNoReplyEmailSender,
        emailAllowListPredicate: makeEmailAllowListPredicate({
          skipEmailAllowList: config.skipEmailAllowlist,
          emailAllowList: config.emailAllowList,
        }),
      },
      config.apiKeyBrevo,
    );

    if (config.notificationGateway === "BREVO") {
      return brevoNotificationGateway;
    }

    return exhaustiveCheck(config.notificationGateway, {
      variableName: "config.notificationGateway",
      throwIfReached: true,
    });
  };

  const getSiretGateway = (
    provider: AppConfig["siretGateway"],
    config: AppConfig,
    timeGateway: TimeGateway,
  ) => {
    const logQwhenExists: LogInputCbOnSuccess = (input) => {
      const queryParams = (input?.queryParams as Record<string, unknown>) ?? {};

      if ("q" in queryParams)
        return {
          queryParams: { q: queryParams.q },
        };

      return {};
    };

    const createInseeSiretGateway = () =>
      new InseeSiretGateway(
        config.inseeHttpConfig,
        createLegacyAxiosHttpClientForExternalAPIs({
          partnerName: partnerNames.inseeSiret,
          routes: inseeExternalRoutes,
          logInputCbOnSuccess: logQwhenExists,
          axiosInstance: axiosWithValidateStatus,
        }),
        timeGateway,
        noRetries,
        withCache,
      );

    const gatewayByProvider = {
      HTTPS: () => createInseeSiretGateway(),
      INSEE: () => createInseeSiretGateway(),
      IN_MEMORY: () => new InMemorySiretGateway(),
      ANNUAIRE_DES_ENTREPRISES: () =>
        new AnnuaireDesEntreprisesSiretGateway(
          createFetchHttpClientForExternalAPIs({
            partnerName: partnerNames.annuaireDesEntreprises,
            routes: annuaireDesEntreprisesSiretRoutes,
            logInputCbOnSuccess: logQwhenExists,
            config,
          }),
          createInseeSiretGateway(),
          withCache,
        ),
    };
    return gatewayByProvider[provider]();
  };

  const createPdfGeneratorGateway = (): PdfGeneratorGateway => {
    const gatewayByOption: Record<
      AppConfig["pdfGeneratorGateway"],
      () => PdfGeneratorGateway
    > = {
      IN_MEMORY: () => new InMemoryPdfGeneratorGateway(),
      SCALINGO: () =>
        new ScalingoPdfGeneratorGateway(
          createLegacyAxiosHttpClientForExternalAPIs({
            partnerName: partnerNames.pdfGenerator,
            routes: makeScalingoPdfGeneratorRoutes(config.pdfGenerator.baseUrl),
            axiosInstance: axiosWithValidateStatus,
          }),
          config.pdfGenerator.apiKey,
          uuidGenerator,
        ),
    };

    return gatewayByOption[config.pdfGeneratorGateway]();
  };

  const createCrispGateway = (config: AppConfig): CrispGateway => {
    const crispGatewayByKind: Record<
      AppConfig["crispGatewayKind"],
      () => CrispGateway
    > = {
      IN_MEMORY: () => new InMemoryCrispApi(),
      HTTP: () =>
        new HttpCrispGateway(
          createFetchSharedClient(crispRoutes, fetch),
          config.crispConfig,
        ),
      LOG_ONLY: () => ({
        initiateConversation: async () => {
          /* do nothing */
        },
      }),
    };

    return crispGatewayByKind[config.crispGatewayKind]();
  };

  return {
    crispGateway: createCrispGateway(config),
    disconnectCache: disconnectCache,
    withCache,
    addressApi: addressGateway,
    appellationsGateway: appellationsGateway(config),
    dashboardGateway: createDashboardGateway(config),
    documentGateway: createDocumentGateway(config),
    notification: createNotificationGateway(config, timeGateway),
    emailValidationGateway: createEmailValidationGateway(config),

    proConnectOAuthGateway,
    laBonneBoiteGateway:
      config.laBonneBoiteGateway === "HTTPS"
        ? new HttpLaBonneBoiteGateway(
            createFetchHttpClientForExternalAPIs({
              partnerName: partnerNames.laBonneBoite,
              routes: createLbbRoutes(config.ftApiUrl),
              config,
            }),
            franceTravailGateway,
            config.franceTravailClientId,
            withCache,
            createLbbRoutes(config.ftApiUrl),
          )
        : new InMemoryLaBonneBoiteGateway(),
    subscribersGateway:
      config.subscribersGateway === "HTTPS"
        ? new HttpSubscribersGateway(axiosWithoutValidateStatus)
        : new InMemorySubscribersGateway(),
    passEmploiGateway:
      config.passEmploiGateway === "HTTPS"
        ? new HttpPassEmploiGateway(config.passEmploiUrl, config.passEmploiKey)
        : new InMemoryPassEmploiGateway(),
    pdfGeneratorGateway: createPdfGeneratorGateway(),
    ftConnectGateway,
    franceTravailGateway,
    timeGateway,
    establishmentMarketingGateway:
      config.establishmentMarketingGateway === "BREVO"
        ? new BrevoEstablishmentMarketingGateway({
            apiKey: config.apiKeyBrevo,
            establishmentContactListId: config.brevoEstablishmentContactListId,
            httpClient: createLegacyAxiosHttpClientForExternalAPIs({
              partnerName: partnerNames.brevoEstablishmentMarketing,
              routes: brevoContactRoutes,
              axiosInstance: axiosWithValidateStatus,
            }),
          })
        : new InMemoryEstablishmentMarketingGateway(),
    siret: getSiretGateway(config.siretGateway, config, timeGateway),
    shortLinkGenerator:
      config.shortLinkIdGeneratorGateway === "NANO_ID"
        ? new NanoIdShortLinkIdGeneratorGateway()
        : new DeterministShortLinkIdGeneratorGateway(),
    otpCodeGeneratorGateway:
      config.otpCodeGeneratorGateway === "CRYPTO"
        ? new CryptoOtpCodeGeneratorGateway()
        : new DeterministicOtpCodeGeneratorGateway(),
  };
};

const createDocumentGateway = (config: AppConfig): DocumentGateway => {
  switch (config.documentGateway) {
    case "S3":
      return new S3DocumentGateway(config.cellarS3Params);
    case "IN_MEMORY":
      return new InMemoryDocumentGateway();
    default: {
      const exhaustiveCheck: never = config.documentGateway;
      logger.error({
        message: "Should not have been reached (Document Gateway declaration)",
      });
      return exhaustiveCheck;
    }
  }
};

const createDashboardGateway = (config: AppConfig): DashboardGateway =>
  config.dashboard === "METABASE"
    ? new MetabaseDashboardGateway(config.metabase)
    : new StubDashboardGateway();
