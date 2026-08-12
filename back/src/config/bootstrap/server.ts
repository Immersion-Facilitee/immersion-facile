import bodyParser from "body-parser";
import express, { type Express } from "express";
import type { HttpError } from "http-errors";
import PinoHttp from "pino-http";
import qs from "qs";
import { createAddressRouter } from "../../adapters/primary/routers/address/createAddressRouter";
import { createAdminRouter } from "../../adapters/primary/routers/admin/createAdminRouter";
import { createAgenciesRouter } from "../../adapters/primary/routers/agencies/createAgenciesRouter";
import { createApiKeyAuthRouterV2 } from "../../adapters/primary/routers/apiKeyAuthRouter/createApiKeyAuthRouter.v2";
import { createApiKeyAuthRouterV3 } from "../../adapters/primary/routers/apiKeyAuthRouter/createApiKeyAuthRouter.v3";
import { createAuthRouter } from "../../adapters/primary/routers/auth/createAuthRouter";
import { createConventionRouter } from "../../adapters/primary/routers/convention/createConventionRouter";
import { createEstablishmentRouter } from "../../adapters/primary/routers/establishment/createEstablishmentRouter";
import { createEstablishmentLeadRouter } from "../../adapters/primary/routers/establishmentLead/createEstablishmentLeadRouter";
import { createFormCompletionRouter } from "../../adapters/primary/routers/formCompletion/createFormCompletionRouter";
import { createMagicLinkRouter } from "../../adapters/primary/routers/magicLink/createMagicLinkRouter";
import { createNafRouter } from "../../adapters/primary/routers/naf/createNafRouter";
import { createRootApiRouter } from "../../adapters/primary/routers/rootApi/createRootApiRouter";
import { createSearchRouter } from "../../adapters/primary/routers/search/createSearchRouter";
import { createTechnicalRouter } from "../../adapters/primary/routers/technical/createTechnicalRouter";
import type { EventCrawler } from "../../domains/core/events/ports/EventCrawler";
import type {
  GenerateApiConsumerJwt,
  GenerateConnectedUserJwt,
  GenerateConventionJwt,
} from "../../domains/core/jwt";
import type { InMemoryUnitOfWork } from "../../domains/core/unit-of-work/adapters/createInMemoryUow";
import type { OutOfTransactionQueries } from "../../domains/core/unit-of-work/ports/UnitOfWork";
import type { UuidGenerator } from "../../domains/core/uuid-generator/ports/UuidGenerator";
import { legacyCreateLogger } from "../../utils/logger";
import type { AppConfig } from "./appConfig";
import { makeCorsPolicy } from "./corsPolicy";
import { createAppDependencies } from "./createAppDependencies";
import type { Gateways } from "./createGateways";
import { detectHtmlInParamsMiddleware } from "./detectHtmlInParamsMiddleware";
import { startCrawler } from "./startCrawler";

const logger = legacyCreateLogger(__filename);

type CreateAppProperties = {
  app: Express;
  gateways: Gateways;
  eventCrawler: EventCrawler;
  generateApiConsumerJwt: GenerateApiConsumerJwt;
  generateConventionJwt: GenerateConventionJwt;
  generateConnectedUserJwt: GenerateConnectedUserJwt;
  uuidGenerator: UuidGenerator;
  inMemoryUow?: InMemoryUnitOfWork;
  queries: OutOfTransactionQueries;
};

export const createApp = async (
  config: AppConfig,
): Promise<CreateAppProperties> => {
  const app = express();
  const corsPolicy = makeCorsPolicy(config);

  app.set("query parser", (str: string) =>
    qs.parse(str, {
      allowPrototypes: true,
      arrayLimit: 500,
    }),
  );

  app.use(
    PinoHttp({
      logger,
    }),
  );

  app.use((req, res, next) => {
    bodyParser.json({ limit: "800kb" })(req, res, (httpError?: HttpError) => {
      if (httpError) {
        const { expose: _, ...rest } = httpError;
        logger.error({
          key: "bodyParser",
          url: req.url,
          headers: req.headers,
          ...rest,
        });
        res.status(httpError.statusCode).json({
          url: req.url,
          headers: req.headers,
          ...rest,
        });
      } else next();
    });
  });
  app.use(detectHtmlInParamsMiddleware);
  const deps = await createAppDependencies(config);

  app.use(createSearchRouter(deps));

  // Those routes must be defined BEFORE the others
  app.use(createRootApiRouter());
  app.use(createMagicLinkRouter(deps));
  app.use(createAdminRouter(deps));
  app.use(createApiKeyAuthRouterV2(deps));
  app.use(createApiKeyAuthRouterV3(deps));
  // ----
  app.use(corsPolicy, createFormCompletionRouter(deps));
  app.use(corsPolicy, createNafRouter(deps));
  app.use(createTechnicalRouter(deps, config.inboundEmailAllowedIps));
  app.use(corsPolicy, createAddressRouter(deps));
  app.use(createConventionRouter(deps));
  app.use(createAgenciesRouter(deps));
  app.use(createAuthRouter(deps));
  // Auth issues below this last router
  app.use(createEstablishmentRouter(deps));
  app.use(createEstablishmentLeadRouter(deps));

  if (config.nodeEnv !== "production") startCrawler(deps);

  return {
    app,
    gateways: deps.gateways,
    inMemoryUow: deps.inMemoryUow,
    eventCrawler: deps.eventCrawler,
    generateApiConsumerJwt: deps.generateApiConsumerJwt,
    generateConventionJwt: deps.generateConventionJwt,
    generateConnectedUserJwt: deps.generateConnectedUserJwt,
    uuidGenerator: deps.uuidGenerator,
    queries: deps.queries,
  };
};
