import { Router } from "express";
import { establishmentRoutes, formCompletionRoutes } from "shared";
import { createExpressSharedRouter } from "shared-routes/express";
import type { AppDependencies } from "../../../../config/bootstrap/createAppDependencies";
import { sendHttpResponse } from "../../../../config/helpers/sendHttpResponse";
import { getGenericAuthOrThrow } from "../../../../domains/core/authentication/connected-user/entities/user.helper";

export const createEstablishmentRouter = (deps: AppDependencies) => {
  const establishmentRouter = Router({ mergeParams: true });

  //TODO: Move this route to createFormCompletionRouter OR move isSiretAlreadySaved route on EstablishmentRoutes
  const sharedSiretRouter = createExpressSharedRouter(
    formCompletionRoutes,
    establishmentRouter,
  );

  sharedSiretRouter.isSiretAlreadySaved((req, res) =>
    sendHttpResponse(req, res, () =>
      deps.useCases.isFormEstablishmentWithSiretAlreadySaved.execute(
        req.params.siret,
      ),
    ),
  );

  const establishmentSharedRouter = createExpressSharedRouter(
    establishmentRoutes,
    establishmentRouter,
  );

  establishmentSharedRouter.addFormEstablishment(
    deps.connectedUserAuthMiddleware,
    (req, res) =>
      sendHttpResponse(req, res, () =>
        deps.useCases.insertEstablishmentAggregateFromForm.execute(
          {
            formEstablishment: req.body,
          },
          getGenericAuthOrThrow(req.payloads?.currentUser),
        ),
      ),
  );

  establishmentSharedRouter.getFormEstablishment(
    deps.connectedUserAuthMiddleware,
    (req, res) =>
      sendHttpResponse(req, res, () =>
        deps.useCases.retrieveFormEstablishmentFromAggregates.execute(
          req.params.siret,
          getGenericAuthOrThrow(req.payloads?.connectedUser),
        ),
      ),
  );

  establishmentSharedRouter.getEstablishmentNameAndAdmins(
    deps.connectedUserAuthMiddleware,
    (req, res) =>
      sendHttpResponse(req, res, () =>
        deps.useCases.getEstablishmentNameAndAdmins.execute(
          req.params,
          getGenericAuthOrThrow(req.payloads?.currentUser),
        ),
      ),
  );

  establishmentSharedRouter.updateFormEstablishment(
    deps.connectedUserAuthMiddleware,
    (req, res) =>
      sendHttpResponse(req, res, () =>
        deps.useCases.updateEstablishmentAggregateFromForm.execute(
          { formEstablishment: req.body },
          getGenericAuthOrThrow(req.payloads?.connectedUser),
        ),
      ),
  );

  establishmentSharedRouter.deleteEstablishment(
    deps.connectedUserAuthMiddleware,
    (req, res) =>
      sendHttpResponse(req, res.status(204), () => {
        const currentUser = getGenericAuthOrThrow(req.payloads?.currentUser);
        return deps.useCases.deleteEstablishment.execute(
          {
            siret: req.params.siret,
            triggeredBy: {
              kind: "connected-user",
              userId: currentUser.id,
            },
          },
          currentUser,
        );
      }),
  );

  establishmentSharedRouter.getDiscussionById(
    deps.connectedUserAuthMiddleware,
    (req, res) =>
      sendHttpResponse(req, res, () =>
        deps.useCases.getDiscussionById.execute(
          req.params.discussionId,
          getGenericAuthOrThrow(req.payloads?.connectedUser),
        ),
      ),
  );

  establishmentSharedRouter.getDiscussionEstablishmentContactInfo(
    deps.connectedUserAuthMiddleware,
    (req, res) =>
      sendHttpResponse(req, res, () =>
        deps.useCases.getDiscussionEstablishmentContactInfo.execute(
          req.params.discussionId,
          getGenericAuthOrThrow(req.payloads?.connectedUser),
        ),
      ),
  );

  establishmentSharedRouter.getDiscussions(
    deps.connectedUserAuthMiddleware,
    (req, res) =>
      sendHttpResponse(req, res, () =>
        deps.useCases.getDiscussions.execute(
          req.query,
          getGenericAuthOrThrow(req.payloads?.currentUser),
        ),
      ),
  );

  establishmentSharedRouter.updateDiscussionStatus(
    deps.connectedUserAuthMiddleware,
    (req, res) =>
      sendHttpResponse(req, res, () =>
        deps.useCases.updateDiscussionStatusByEstablishment.execute(
          {
            discussionId: req.params.discussionId,
            ...req.body,
          },
          getGenericAuthOrThrow(req.payloads?.currentUser),
        ),
      ),
  );

  establishmentSharedRouter.closeDiscussionByCandidate(
    deps.connectedUserAuthMiddleware,
    (req, res) =>
      sendHttpResponse(req, res, () =>
        deps.useCases.closeDiscussionByCandidate.execute(
          { discussionId: req.params.discussionId },
          getGenericAuthOrThrow(req.payloads?.currentUser),
        ),
      ),
  );

  establishmentSharedRouter.replyToDiscussion(
    deps.connectedUserAuthMiddleware,
    (req, res) =>
      sendHttpResponse(req, res, () =>
        deps.useCases.addExchangeToDiscussion
          .execute(
            {
              source: "dashboard",
              messageInputs: [
                {
                  ...req.body,
                  discussionId: req.params.discussionId,
                  attachments: [],
                },
              ],
            },
            req.payloads?.currentUser,
          )
          .then((result) => {
            if ("reason" in result) {
              res.status(202);
            }
            return result;
          }),
      ),
  );

  establishmentSharedRouter.getEstablishmentPublicOptionsByFilters(
    deps.connectedUserAuthMiddleware,
    (req, res) =>
      sendHttpResponse(req, res, () =>
        deps.useCases.getEstablishmentPublicOptionsByFilters.execute(
          req.query,
          getGenericAuthOrThrow(req.payloads?.currentUser),
        ),
      ),
  );

  establishmentSharedRouter.registerUserOnEstablishment(
    deps.connectedUserAuthMiddleware,
    (req, res) =>
      sendHttpResponse(req, res.status(201), () =>
        deps.useCases.registerUserOnEstablishment.execute(
          {
            siret: req.params.siret,
            userRight: req.body,
          },
          getGenericAuthOrThrow(req.payloads?.currentUser),
        ),
      ),
  );

  return establishmentRouter;
};
