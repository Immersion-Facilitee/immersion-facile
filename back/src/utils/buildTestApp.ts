import supertest from "supertest";
import type { AppConfig } from "../config/bootstrap/appConfig";
import type { Gateways } from "../config/bootstrap/createGateways";
import { createApp } from "../config/bootstrap/server";
import type { InMemoryFranceTravailGateway } from "../domains/convention/adapters/france-travail-gateway/InMemoryFranceTravailGateway";
import type { InMemoryAddressGateway } from "../domains/core/address/adapters/InMemoryAddressGateway";
import type { InMemorySubscribersGateway } from "../domains/core/api-consumer/adapters/InMemorySubscribersGateway";
import type { InMemoryProConnectOAuthGateway } from "../domains/core/authentication/connected-user/adapters/oauth-gateway/InMemoryOAuthGateway";
import type { InMemoryFtConnectGateway } from "../domains/core/authentication/ft-connect/adapters/ft-connect-gateway/InMemoryFtConnectGateway";
import type { WithCache } from "../domains/core/caching-gateway/port/WithCache";
import type { StubDashboardGateway } from "../domains/core/dashboard/adapters/StubDashboardGateway";
import type { InMemoryEmailValidationGateway } from "../domains/core/email-validation/adapters/InMemoryEmailValidationGateway";
import type { BasicEventCrawler } from "../domains/core/events/adapters/EventCrawlerImplementations";
import type { InMemoryDocumentGateway } from "../domains/core/file-storage/adapters/InMemoryDocumentGateway";
import type {
  GenerateApiConsumerJwt,
  GenerateConnectedUserJwt,
  GenerateConventionJwt,
} from "../domains/core/jwt";
import type { InMemoryNotificationGateway } from "../domains/core/notifications/adapters/InMemoryNotificationGateway";
import type { InMemoryPdfGeneratorGateway } from "../domains/core/pdf-generation/adapters/InMemoryPdfGeneratorGateway";
import type { InMemoryAppellationsGateway } from "../domains/core/rome/adapters/InMemoryAppellationsGateway";
import type { DeterministShortLinkIdGeneratorGateway } from "../domains/core/short-link/adapters/short-link-generator-gateway/DeterministShortLinkIdGeneratorGateway";
import type { InMemorySiretGateway } from "../domains/core/sirene/adapters/InMemorySiretGateway";
import type { InMemoryCrispApi } from "../domains/core/support/adapters/InMemoryCrispApi";
import type { CustomTimeGateway } from "../domains/core/time-gateway/adapters/CustomTimeGateway";
import type {
  InMemoryOutOfTransactionQueries,
  InMemoryUnitOfWork,
} from "../domains/core/unit-of-work/adapters/createInMemoryUow";
import type { UuidGenerator } from "../domains/core/uuid-generator/ports/UuidGenerator";
import type { InMemoryLaBonneBoiteGateway } from "../domains/establishment/adapters/la-bonne-boite/InMemoryLaBonneBoiteGateway";
import type { InMemoryPassEmploiGateway } from "../domains/establishment/adapters/pass-emploi/InMemoryPassEmploiGateway";
import type { InMemoryEstablishmentMarketingGateway } from "../domains/marketing/adapters/establishmentMarketingGateway/InMemoryEstablishmentMarketingGateway";
import { AppConfigBuilder } from "./AppConfigBuilder";

export type InMemoryGateways = {
  disconnectCache: () => Promise<void>;
  withCache: WithCache;
  notification: InMemoryNotificationGateway;
  ftConnectGateway: InMemoryFtConnectGateway;
  siret: InMemorySiretGateway;
  pdfGeneratorGateway: InMemoryPdfGeneratorGateway;
  laBonneBoiteGateway: InMemoryLaBonneBoiteGateway;
  passEmploiGateway: InMemoryPassEmploiGateway;
  franceTravailGateway: InMemoryFranceTravailGateway;
  proConnectOAuthGateway: InMemoryProConnectOAuthGateway;
  ftConnectOAuthGateway: InMemoryFtConnectGateway;
  documentGateway: InMemoryDocumentGateway;
  dashboardGateway: StubDashboardGateway;
  addressApi: InMemoryAddressGateway;
  timeGateway: CustomTimeGateway;
  emailValidationGateway: InMemoryEmailValidationGateway;
  shortLinkGenerator: DeterministShortLinkIdGeneratorGateway;
  subscribersGateway: InMemorySubscribersGateway;
  appellationsGateway: InMemoryAppellationsGateway;
  establishmentMarketingGateway: InMemoryEstablishmentMarketingGateway;
  crispGateway: InMemoryCrispApi;
};

// following function only to type check that InMemoryRepositories is assignable to Repositories :
const _isAssignable = (inMemoryRepos: InMemoryGateways): Gateways =>
  inMemoryRepos;

export type TestAppAndDeps = {
  request: supertest.SuperTest<supertest.Test>;
  gateways: InMemoryGateways;
  eventCrawler: BasicEventCrawler;
  appConfig: AppConfig;
  generateApiConsumerJwt: GenerateApiConsumerJwt;
  generateConventionJwt: GenerateConventionJwt;
  generateConnectedUserJwt: GenerateConnectedUserJwt;
  uuidGenerator: UuidGenerator;
  inMemoryUow: InMemoryUnitOfWork;
  queries: InMemoryOutOfTransactionQueries;
};

export const buildTestApp = async (
  appConfigOverrides?: AppConfig,
): Promise<TestAppAndDeps> => {
  const appConfig = new AppConfigBuilder({
    ADDRESS_API_GATEWAY: "IN_MEMORY",
    APPELLATIONS_GATEWAY: "IN_MEMORY",
    EVENT_CRAWLER_PERIOD_MS: "0", // will not crawl automatically
    DOMAIN: "my-domain",
    NOTIFICATION_GATEWAY: "IN_MEMORY",
    ESTABLISHMENT_MARKETING_GATEWAY: "IN_MEMORY",
    ENABLE_ENTERPRISE_SIGNATURE: "TRUE",
    LA_BONNE_BOITE_GATEWAY: "IN_MEMORY",
    PASS_EMPLOI_GATEWAY: "IN_MEMORY",
    PE_CONNECT_GATEWAY: "IN_MEMORY",
    PDF_GENERATOR_GATEWAY: "IN_MEMORY",
    REPORTING_GATEWAY: "EXCEL",
    REPOSITORIES: "IN_MEMORY",
    SKIP_EMAIL_ALLOW_LIST: "TRUE",
    SIRENE_REPOSITORY: "IN_MEMORY",
    TIME_GATEWAY: "CUSTOM",
    EMAIL_VALIDATION_GATEWAY: "IN_MEMORY",
    SHORT_LINK_ID_GENERATOR_GATEWAY: "DETERMINIST",
    INBOUND_EMAIL_ALLOWED_IPS: "::ffff:127.0.0.1",
    MAX_API_CONSUMER_CALLS_PER_SECOND: "2",
    ...appConfigOverrides?.configParams,
  }).build();

  if (appConfig.shortLinkIdGeneratorGateway !== "DETERMINIST")
    throwNotSupportedError();
  if (appConfig.notificationGateway !== "IN_MEMORY") throwNotSupportedError();
  if (appConfig.repositories !== "IN_MEMORY") throwNotSupportedError();
  if (appConfig.siretGateway !== "IN_MEMORY") throwNotSupportedError();
  if (appConfig.timeGateway !== "CUSTOM") throwNotSupportedError();

  const {
    app,
    gateways,
    eventCrawler: rawEventCrawler,
    generateApiConsumerJwt,
    generateConventionJwt,
    generateConnectedUserJwt,
    uuidGenerator,
    inMemoryUow: uow,
    queries,
  } = await createApp(appConfig);

  const request = supertest(app);
  const eventCrawler = rawEventCrawler as BasicEventCrawler;

  // biome-ignore lint/style/noNonNullAssertion: <explanation>
  const inMemoryUow = uow!;

  return {
    request,
    gateways: gateways as InMemoryGateways,
    eventCrawler,
    appConfig,
    generateApiConsumerJwt,
    generateConventionJwt,
    generateConnectedUserJwt,
    uuidGenerator,
    inMemoryUow,
    queries: queries as InMemoryOutOfTransactionQueries,
  };
};

const throwNotSupportedError = () => {
  throw new Error("AppConfig not supported.");
};
