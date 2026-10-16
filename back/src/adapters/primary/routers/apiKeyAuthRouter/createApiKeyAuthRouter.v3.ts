import { Router } from "express";
import {
  type ApiConsumer,
  contactEstablishmentPublicV3Schema,
  contactEstablishmentPublicV3ToDomain,
  domainToSearchImmersionResultPublicV3,
  errors,
  isApiConsumerAllowed,
  pipeWithValue,
  publicApiV3SearchEstablishmentRoutes,
  type WithAcquisition,
} from "shared";
import { createExpressSharedRouter } from "shared-routes/express";
import type { AppDependencies } from "../../../../config/bootstrap/createAppDependencies";
import { sendHttpResponse } from "../../../../config/helpers/sendHttpResponse";
import { validateAndParseZodSchema } from "../../../../config/helpers/validateAndParseZodSchema";
import { createLogger } from "../../../../utils/logger";

const logger = createLogger(__filename);

export const createApiKeyAuthRouterV3 = (deps: AppDependencies) => {
  const v3ExpressRouter = Router({ mergeParams: true });

  const searchEstablishmentV3Router = createExpressSharedRouter(
    publicApiV3SearchEstablishmentRoutes,
    v3ExpressRouter,
  );

  searchEstablishmentV3Router.contactEstablishment(
    deps.apiConsumerMiddleware,
    (req, res) =>
      sendHttpResponse(req, res.status(201), () => {
        if (
          !req.apiConsumer ||
          !isApiConsumerAllowed({
            apiConsumer: req.apiConsumer,
            rightName: "searchEstablishment",
            consumerKind: "READ",
          })
        )
          throw errors.apiConsumer.forbidden();
        return pipeWithValue(
          validateAndParseZodSchema({
            schemaName: "contactEstablishmentPublicV3Schema",
            inputSchema: contactEstablishmentPublicV3Schema,
            schemaParsingInput: req.body,
            logger,
          }),
          contactEstablishmentPublicV3ToDomain,
          (contactRequest) =>
            deps.useCases.contactEstablishment.execute(
              addAcquisitionParams(contactRequest, req.apiConsumer),
            ),
        );
      }),
  );

  searchEstablishmentV3Router.getOffer(deps.apiConsumerMiddleware, (req, res) =>
    sendHttpResponse(req, res, () => {
      if (
        !req.apiConsumer ||
        !isApiConsumerAllowed({
          apiConsumer: req.apiConsumer,
          rightName: "searchEstablishment",
          consumerKind: "READ",
        })
      )
        throw errors.apiConsumer.forbidden();

      return deps.useCases.getSearchResultBySearchQuery
        .execute(req.params, req.apiConsumer)
        .then(domainToSearchImmersionResultPublicV3);
    }),
  );

  searchEstablishmentV3Router.getOffers(
    deps.apiConsumerMiddleware,
    (req, res) =>
      sendHttpResponse(req, res, () => {
        if (
          !req.apiConsumer ||
          !isApiConsumerAllowed({
            apiConsumer: req.apiConsumer,
            rightName: "searchEstablishment",
            consumerKind: "READ",
          })
        )
          throw errors.apiConsumer.forbidden();

        return deps.useCases.getOffers
          .execute(req.query, req.apiConsumer)
          .then(({ data, pagination }) => ({
            data: data.map(domainToSearchImmersionResultPublicV3),
            pagination,
          }));
      }),
  );

  return v3ExpressRouter;
};

const addAcquisitionParams = <T>(
  obj: T,
  apiConsumer: ApiConsumer | undefined,
): T & WithAcquisition => ({
  ...obj,
  ...(apiConsumer
    ? {
        acquisitionCampaign: "api-consumer",
        acquisitionKeyword: `${apiConsumer.id} - ${apiConsumer.name}`,
      }
    : {}),
});
