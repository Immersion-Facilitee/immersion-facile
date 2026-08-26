import { Router } from "express";
import { adminRoutes, agencyRoutes, errors } from "shared";
import { createExpressSharedRouter } from "shared-routes/express";
import type { AppDependencies } from "../../../../config/bootstrap/createAppDependencies";
import { sendHttpResponse } from "../../../../config/helpers/sendHttpResponse";
import { getGenericAuthOrThrow } from "../../../../domains/core/authentication/connected-user/entities/user.helper";

export const createAdminRouter = (deps: AppDependencies): Router => {
  const expressRouter = Router({ mergeParams: true });

  const sharedAdminRouter = createExpressSharedRouter(
    adminRoutes,
    expressRouter,
  );

  const sharedAgencyRouter = createExpressSharedRouter(
    agencyRoutes,
    expressRouter,
  );

  sharedAdminRouter.getDashboardUrl(
    deps.connectedUserAuthMiddleware,
    (req, res) =>
      sendHttpResponse(req, res, () => {
        if (req.params.dashboardName === "agency" && !req.query.agencyId)
          throw errors.agency.missingParamAgencyId();

        return deps.useCases.getDashboard.execute(
          {
            name: req.params.dashboardName as any,
            ...(req.query.agencyId ? req.query : {}),
          },
          getGenericAuthOrThrow(req.payloads?.currentUser),
        );
      }),
  );

  sharedAdminRouter.getLastNotifications(
    deps.connectedUserAuthMiddleware,
    (req, res) =>
      sendHttpResponse(req, res, () =>
        deps.useCases.getLastNotifications.execute(
          undefined,
          getGenericAuthOrThrow(req.payloads?.currentUser),
        ),
      ),
  );

  sharedAdminRouter.updateFeatureFlags(
    deps.connectedUserAuthMiddleware,
    (req, res) =>
      sendHttpResponse(req, res.status(201), () =>
        deps.useCases.setFeatureFlag.execute(
          req.body,
          getGenericAuthOrThrow(req.payloads?.currentUser),
        ),
      ),
  );

  sharedAdminRouter.addFormEstablishmentBatch(
    deps.connectedUserAuthMiddleware,
    (req, res) => {
      return sendHttpResponse(req, res, () =>
        deps.useCases.addFormEstablishmentBatch.execute(
          req.body,
          getGenericAuthOrThrow(req.payloads?.currentUser),
        ),
      );
    },
  );

  sharedAdminRouter.updateUserRoleForAgency(
    deps.connectedUserAuthMiddleware,
    (req, res) =>
      sendHttpResponse(req, res.status(201), () =>
        deps.useCases.updateUserForAgency.execute(
          req.body,
          getGenericAuthOrThrow(req.payloads?.currentUser),
        ),
      ),
  );

  sharedAdminRouter.createUserForAgency(
    deps.connectedUserAuthMiddleware,
    (req, res) =>
      sendHttpResponse(req, res, () =>
        deps.useCases.createUserForAgency.execute(
          req.body,
          getGenericAuthOrThrow(req.payloads?.currentUser),
        ),
      ),
  );

  sharedAdminRouter.rejectIcUserForAgency(
    deps.connectedUserAuthMiddleware,
    (req, res) =>
      sendHttpResponse(req, res.status(201), () =>
        deps.useCases.rejectUserForAgency.execute(
          req.body,
          getGenericAuthOrThrow(req.payloads?.currentUser),
        ),
      ),
  );

  sharedAdminRouter.saveApiConsumer(
    deps.connectedUserAuthMiddleware,
    (req, res) =>
      sendHttpResponse(req, res, () =>
        deps.useCases.saveApiConsumer.execute(
          req.body,
          getGenericAuthOrThrow(req.payloads?.currentUser),
        ),
      ),
  );

  sharedAdminRouter.getAllApiConsumers(
    deps.connectedUserAuthMiddleware,
    (req, res) =>
      sendHttpResponse(req, res, () =>
        deps.useCases.getAllApiConsumers.execute(
          undefined,
          getGenericAuthOrThrow(req.payloads?.currentUser),
        ),
      ),
  );

  sharedAdminRouter.revokeApiConsumer(
    deps.connectedUserAuthMiddleware,
    (req, res) =>
      sendHttpResponse(req, res, () =>
        deps.useCases.revokeApiConsumer.execute(
          req.params.consumerId,
          req.payloads?.currentUser,
        ),
      ),
  );

  sharedAdminRouter.renewApiConsumerKey(
    deps.connectedUserAuthMiddleware,
    (req, res) =>
      sendHttpResponse(req, res, () =>
        deps.useCases.renewApiConsumerKey.execute(
          req.params.consumerId,
          getGenericAuthOrThrow(req.payloads?.currentUser),
        ),
      ),
  );

  sharedAdminRouter.getUsers(deps.connectedUserAuthMiddleware, (req, res) =>
    sendHttpResponse(req, res, () =>
      deps.useCases.getUsers.execute(
        req.query,
        getGenericAuthOrThrow(req.payloads?.currentUser),
      ),
    ),
  );

  sharedAdminRouter.updateUserPreventToDelete(
    deps.connectedUserAuthMiddleware,
    (req, res) =>
      sendHttpResponse(req, res, () =>
        deps.useCases.updateUserPreventToDelete.execute(
          {
            userId: req.params.userId,
            preventToDelete: req.body.preventToDelete,
          },
          getGenericAuthOrThrow(req.payloads?.currentUser),
        ),
      ),
  );

  sharedAdminRouter.banEstablishment(
    deps.connectedUserAuthMiddleware,
    (req, res) =>
      sendHttpResponse(req, res.status(201), () =>
        deps.useCases.banEstablishment.execute(
          req.body,
          getGenericAuthOrThrow(req.payloads?.currentUser),
        ),
      ),
  );

  sharedAgencyRouter.getAgencyById(
    deps.connectedUserAuthMiddleware,
    (req, res) =>
      sendHttpResponse(req, res, () =>
        deps.useCases.getAgencyById.execute(
          req.params.agencyId,
          getGenericAuthOrThrow(req.payloads?.currentUser),
        ),
      ),
  );

  sharedAgencyRouter.updateAgency(
    deps.connectedUserAuthMiddleware,
    (req, res) =>
      sendHttpResponse(req, res, () => {
        if (req.body.id !== req.params.agencyId)
          throw errors.agency.routeIdMismatch({
            routeAgencyId: req.params.agencyId,
            bodyAgencyId: req.body.id,
          });

        return deps.useCases.updateAgency.execute(
          req.body,
          getGenericAuthOrThrow(req.payloads?.currentUser),
        );
      }),
  );

  sharedAgencyRouter.closeAgencyAndTransfertConventions(
    deps.connectedUserAuthMiddleware,
    (req, res) =>
      sendHttpResponse(req, res, () =>
        deps.useCases.closeAgencyAndTransfertConventions.execute(
          req.body,
          getGenericAuthOrThrow(req.payloads?.currentUser),
        ),
      ),
  );

  return expressRouter;
};
