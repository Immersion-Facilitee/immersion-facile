import { Router } from "express";
import {
  authenticatedConventionRoutes,
  flatParamsToGetConventionsForAgencyUserParams,
  flatParamsToGetConventionsWithErroredBroadcastFeedbackParams,
  flatParamsToGetConventionsWithUnfinalizedAssessmentParams,
  unauthenticatedConventionRoutes,
} from "shared";
import { createExpressSharedRouter } from "shared-routes/express";
import type { AppDependencies } from "../../../../config/bootstrap/createAppDependencies";
import { sendHttpResponse } from "../../../../config/helpers/sendHttpResponse";
import { getGenericAuthOrThrow } from "../../../../domains/core/authentication/connected-user/entities/user.helper";

export const createConventionRouter = (deps: AppDependencies) => {
  const expressRouter = Router();

  const unauthenticatedConventionSharedRouter = createExpressSharedRouter(
    unauthenticatedConventionRoutes,
    expressRouter,
  );

  const authenticatedConventionSharedRouter = createExpressSharedRouter(
    authenticatedConventionRoutes,
    expressRouter,
  );

  unauthenticatedConventionSharedRouter.saveConventionDraft((req, res) =>
    sendHttpResponse(req, res, () =>
      deps.useCases.saveConventionDraft.execute(req.body),
    ),
  );

  unauthenticatedConventionSharedRouter.getConventionDraft((req, res) =>
    sendHttpResponse(req, res, () =>
      deps.useCases.getConventionDraftById.execute(
        req.params.conventionDraftId,
      ),
    ),
  );

  unauthenticatedConventionSharedRouter.createConvention((req, res) =>
    sendHttpResponse(req, res, () =>
      deps.useCases.addConvention.execute(req.body),
    ),
  );

  unauthenticatedConventionSharedRouter.findSimilarConventions((req, res) =>
    sendHttpResponse(req, res, () =>
      deps.useCases.findSimilarConventions.execute(req.query),
    ),
  );

  authenticatedConventionSharedRouter.fetchArchivedConventionRequestToReviewList(
    deps.connectedUserAuthMiddleware,
    (req, res) =>
      sendHttpResponse(req, res, () =>
        deps.useCases.fetchArchivedConventionRequestToReviewList.execute(
          undefined,
          getGenericAuthOrThrow(req.payloads?.currentUser),
        ),
      ),
  );

  authenticatedConventionSharedRouter.getApiConsumersByConvention(
    deps.connectedUserAuthMiddleware,
    (req, res) =>
      sendHttpResponse(req, res, () =>
        deps.useCases.getApiConsumersByConvention.execute(
          req.params,
          getGenericAuthOrThrow(req.payloads?.currentUser),
        ),
      ),
  );

  authenticatedConventionSharedRouter.getBeneficiaryConventionList(
    deps.connectedUserAuthMiddleware,
    (req, res) =>
      sendHttpResponse(req, res, () =>
        deps.useCases.getBeneficiaryConventionList.execute(
          undefined,
          getGenericAuthOrThrow(req.payloads?.currentUser),
        ),
      ),
  );

  authenticatedConventionSharedRouter.getConventionsForAgencyUser(
    deps.connectedUserAuthMiddleware,
    (req, res) =>
      sendHttpResponse(req, res, () =>
        deps.useCases.getConventionsForAgencyUser.execute(
          flatParamsToGetConventionsForAgencyUserParams(req.query),
          getGenericAuthOrThrow(req.payloads?.currentUser),
        ),
      ),
  );

  authenticatedConventionSharedRouter.getConventionsWithErroredBroadcastFeedbackForAgencyUser(
    deps.connectedUserAuthMiddleware,
    (req, res) =>
      sendHttpResponse(req, res, () =>
        deps.useCases.getConventionsWithErroredBroadcastFeedback.execute(
          flatParamsToGetConventionsWithErroredBroadcastFeedbackParams(
            req.query,
          ),
          getGenericAuthOrThrow(req.payloads?.currentUser),
        ),
      ),
  );

  authenticatedConventionSharedRouter.getConventionsWithUnfinalizedAssessment(
    deps.connectedUserAuthMiddleware,
    (req, res) =>
      sendHttpResponse(req, res, () =>
        deps.useCases.getConventionsWithUnfinalizedAssessment.execute(
          flatParamsToGetConventionsWithUnfinalizedAssessmentParams(req.query),
          getGenericAuthOrThrow(req.payloads?.currentUser),
        ),
      ),
  );

  authenticatedConventionSharedRouter.markPartnersErroredConventionAsHandled(
    deps.connectedUserAuthMiddleware,
    (req, res) =>
      sendHttpResponse(req, res, () =>
        deps.useCases.markPartnersErroredConventionAsHandled.execute(
          req.body,
          getGenericAuthOrThrow(req.payloads?.connectedUser),
        ),
      ),
  );

  authenticatedConventionSharedRouter.broadcastConventionAgain(
    deps.connectedUserAuthMiddleware,
    (req, res) =>
      sendHttpResponse(req, res, () =>
        deps.useCases.broadcastConventionAgain.execute(
          req.body,
          getGenericAuthOrThrow(req.payloads?.currentUser),
        ),
      ),
  );

  authenticatedConventionSharedRouter.getConventionLastBroadcastFeedback(
    deps.connectedUserAuthMiddleware,
    (req, res) =>
      sendHttpResponse(req, res, () =>
        deps.useCases.getLastBroadcastFeedback.execute(
          req.params.conventionId,
          getGenericAuthOrThrow(req.payloads?.currentUser),
        ),
      ),
  );

  authenticatedConventionSharedRouter.getConventionTemplatesForCurrentUser(
    deps.connectedUserAuthMiddleware,
    (req, res) =>
      sendHttpResponse(req, res, () =>
        deps.useCases.getConventionTemplatesForCurrentUser.execute(
          undefined,
          getGenericAuthOrThrow(req.payloads?.currentUser),
        ),
      ),
  );

  authenticatedConventionSharedRouter.createOrUpdateConventionTemplate(
    deps.connectedUserAuthMiddleware,
    (req, res) =>
      sendHttpResponse(req, res, () =>
        deps.useCases.createOrUpdateConventionTemplate.execute(
          req.body,
          getGenericAuthOrThrow(req.payloads?.currentUser),
        ),
      ),
  );

  authenticatedConventionSharedRouter.deleteConventionTemplate(
    deps.connectedUserAuthMiddleware,
    (req, res) =>
      sendHttpResponse(req, res, () =>
        deps.useCases.deleteConventionTemplate.execute(
          { conventionTemplateId: req.params.conventionTemplateId },
          getGenericAuthOrThrow(req.payloads?.currentUser),
        ),
      ),
  );

  return expressRouter;
};
