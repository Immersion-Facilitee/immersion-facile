import { oneDayInSecond, oneHourInSeconds, oneMinuteInSeconds } from "shared";
import { InMemoryEventBus } from "../../domains/core/events/adapters/InMemoryEventBus";
import {
  type GenerateApiConsumerJwt,
  type GenerateConnectedUserJwt,
  type GenerateConventionJwt,
  type GenerateEmailAuthCodeJwt,
  makeGenerateJwtES256,
  makeVerifyJwtES256,
  type VerifyJwtFn,
} from "../../domains/core/jwt";
import { createDbRelatedSystems } from "../../domains/core/unit-of-work/adapters/createDbRelatedSystems";
import { UuidV4Generator } from "../../domains/core/uuid-generator/adapters/UuidGeneratorImplementations";
import { createMakeProductionPgPool } from "../pg/pgPool";
import type { AppConfig } from "./appConfig";
import {
  makeConsumerMiddleware,
  makeMagicLinkAuthMiddleware,
} from "./authMiddleware";
import { makeConnectedUserAuthMiddleware } from "./connectedUserAuthMiddleware";
import { createEventCrawler } from "./createEventCrawler";
import { createGateways } from "./createGateways";
import { createUseCases } from "./createUseCases";

export type AppDependencies =
  ReturnType<typeof createAppDependencies> extends Promise<infer T> ? T : never;

export const createAppDependencies = async (config: AppConfig) => {
  const uuidGenerator = new UuidV4Generator();
  const getPgPoolFn = createMakeProductionPgPool(config);
  const gateways = await createGateways(config, uuidGenerator);

  const { uowPerformer, inMemoryUow, queries } = createDbRelatedSystems(
    config,
    getPgPoolFn,
  );

  const eventBus = new InMemoryEventBus(
    gateways.timeGateway,
    uowPerformer,
    config.nodeEnv === "test",
  );

  const generateApiConsumerJwt: GenerateApiConsumerJwt =
    makeGenerateJwtES256<"apiConsumer">(
      config.apiJwtPrivateKey,
      undefined, // no expiration
    );
  const generateConnectedUserJwt: GenerateConnectedUserJwt =
    makeGenerateJwtES256<"connectedUser">(
      config.jwtPrivateKey,
      config.connectedUserJwtDurationInHours * oneHourInSeconds,
    );
  const generateConventionJwt: GenerateConventionJwt =
    makeGenerateJwtES256<"convention">(
      config.jwtPrivateKey,
      config.conventionJwt1MonthDurationInDays * oneDayInSecond,
    );

  const generateEmailAuthCodeJwt: GenerateEmailAuthCodeJwt =
    makeGenerateJwtES256<"emailAuthCode">(
      config.jwtPrivateKey,
      config.emailAuthCodeJwtDurationInMinutes * oneMinuteInSeconds,
    );

  const verifyEmailAuthCodeJwt: VerifyJwtFn<"emailAuthCode"> =
    makeVerifyJwtES256<"emailAuthCode">(config.jwtPrivateKey);

  const useCases = createUseCases({
    config,
    gateways,
    deps: { uowPerformer, uuidGenerator, queries },
    jwt: {
      generateConventionJwt,
      generateConnectedUserJwt,
      generateApiConsumerJwt,
      generateEmailAuthCodeJwt,
      verifyEmailAuthCodeJwt,
    },
  });

  return {
    config,
    useCases,
    gateways,
    conventionMagicLinkAuthMiddleware: makeMagicLinkAuthMiddleware(
      config,
      "convention",
    ),
    apiConsumerMiddleware: makeConsumerMiddleware(
      useCases.getApiConsumerById.execute,
      gateways.timeGateway,
      config,
    ),
    connectedUserAuthMiddleware: await makeConnectedUserAuthMiddleware(
      config.jwtPublicKey,
      uowPerformer,
      gateways.dashboardGateway,
      gateways.timeGateway,
    ),
    generateConventionJwt,
    generateApiConsumerJwt,
    generateConnectedUserJwt,
    eventBus,
    eventCrawler: createEventCrawler(
      config,
      uowPerformer,
      eventBus,
      gateways.timeGateway,
    ),
    uuidGenerator,
    inMemoryUow,
    uowPerformer,
    getPgPoolFn,
    queries,
  };
};
