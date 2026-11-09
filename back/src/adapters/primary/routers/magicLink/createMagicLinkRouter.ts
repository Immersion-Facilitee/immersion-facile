import { Router } from "express";
import {
  type ConventionRelatedJwtPayload,
  conventionMagicLinkRoutes,
  errors,
  type JwtPayloads,
} from "shared";
import { createExpressSharedRouter } from "shared-routes/express";
import { match, P } from "ts-pattern";
import type { AppDependencies } from "../../../../config/bootstrap/createAppDependencies";
import { sendHttpResponse } from "../../../../config/helpers/sendHttpResponse";
import { getGenericAuthOrThrow } from "../../../../domains/core/authentication/connected-user/entities/user.helper";

export const createMagicLinkRouter = (deps: AppDependencies) => {
  const expressRouter = Router({ mergeParams: true });

  const sharedRouter = createExpressSharedRouter(
    conventionMagicLinkRoutes,
    expressRouter,
  );

  sharedRouter.createAssessment(
    deps.conventionMagicLinkOrVisitorSessionAuthMiddleware,
    (req, res) =>
      sendHttpResponse(req, res.status(201), () =>
        deps.useCases.createAssessment.execute(
          req.body,
          req.payloads?.convention,
        ),
      ),
  );

  sharedRouter.getAssessmentByConventionId(
    deps.conventionMagicLinkOrVisitorSessionAuthMiddleware,
    (req, res) =>
      sendHttpResponse(req, res, () =>
        deps.useCases.getAssessmentByConventionId.execute(
          req.params,
          getConventionRelatedJwtPayload(req.payloads),
        ),
      ),
  );

  sharedRouter.getConvention(
    deps.conventionMagicLinkOrVisitorSessionAuthMiddleware,
    (req, res) =>
      sendHttpResponse(req, res, () =>
        deps.useCases.getConvention.execute(
          req.params,
          getConventionRelatedJwtPayload(req.payloads),
        ),
      ),
  );

  sharedRouter.updateConvention(
    deps.conventionMagicLinkOrVisitorSessionAuthMiddleware,
    (req, res) =>
      sendHttpResponse(req, res, () =>
        deps.useCases.updateConvention.execute(
          req.body,
          getConventionRelatedJwtPayload(req.payloads),
        ),
      ),
  );

  sharedRouter.updateConventionStatus(
    deps.conventionMagicLinkOrVisitorSessionAuthMiddleware,
    (req, res) =>
      sendHttpResponse(req, res, () =>
        deps.useCases.updateConventionStatus.execute(
          req.body,
          getConventionRelatedJwtPayload(req.payloads),
        ),
      ),
  );

  sharedRouter.signConvention(
    deps.conventionMagicLinkOrVisitorSessionAuthMiddleware,
    (req, res) =>
      sendHttpResponse(req, res, () =>
        deps.useCases.signConvention.execute(
          req.params,
          getConventionRelatedJwtPayload(req.payloads),
        ),
      ),
  );

  sharedRouter.signAssessment(
    deps.conventionMagicLinkOrVisitorSessionAuthMiddleware,
    (req, res) =>
      sendHttpResponse(req, res, () =>
        deps.useCases.signAssessment.execute(
          req.body,
          getConventionRelatedJwtPayload(req.payloads),
        ),
      ),
  );

  sharedRouter.getConventionStatusDashboard(
    deps.conventionMagicLinkOrVisitorSessionAuthMiddleware,
    (req, res) =>
      sendHttpResponse(req, res, () =>
        deps.useCases.getDashboard.execute(
          {
            ...req.params,
            name: "conventionStatus",
          },
          getGenericAuthOrThrow(req.payloads?.convention),
        ),
      ),
  );

  sharedRouter.editConventionWithFinalStatus(
    deps.conventionMagicLinkOrVisitorSessionAuthMiddleware,
    (req, res) =>
      sendHttpResponse(req, res, () =>
        deps.useCases.editConventionWithFinalStatus.execute(
          req.body,
          getConventionRelatedJwtPayload(req.payloads),
        ),
      ),
  );

  sharedRouter.sendSignatureLink(
    deps.conventionMagicLinkOrVisitorSessionAuthMiddleware,
    (req, res) =>
      sendHttpResponse(req, res, () =>
        deps.useCases.sendSignatureLink.execute(
          {
            conventionId: req.body.conventionId,
            signatoryRole: req.body.signatoryRole,
            notificationKind: req.body.notificationKind,
          },
          getConventionRelatedJwtPayload(req.payloads),
        ),
      ),
  );

  sharedRouter.sendAssessmentLink(
    deps.conventionMagicLinkOrVisitorSessionAuthMiddleware,
    (req, res) =>
      sendHttpResponse(req, res, () =>
        deps.useCases.sendAssessmentLink.execute(
          req.body,
          getConventionRelatedJwtPayload(req.payloads),
        ),
      ),
  );

  sharedRouter.sendAssessmentSignatureReminder(
    deps.conventionMagicLinkOrVisitorSessionAuthMiddleware,
    (req, res) =>
      sendHttpResponse(req, res, () =>
        deps.useCases.sendAssessmentSignatureReminder.execute(
          req.body,
          getConventionRelatedJwtPayload(req.payloads),
        ),
      ),
  );

  return expressRouter;
};

const getConventionRelatedJwtPayload = (
  payloads?: JwtPayloads,
): ConventionRelatedJwtPayload =>
  match(payloads)
    .with({ convention: P.not(P.nullish) }, ({ convention }) => convention)
    .with(
      { connectedUser: P.not(P.nullish) },
      ({ connectedUser }) => connectedUser,
    )
    .otherwise(() => {
      throw errors.user.unauthorized();
    });
