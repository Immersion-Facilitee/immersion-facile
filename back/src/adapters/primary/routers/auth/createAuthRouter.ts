import type { NextFunction, Request, Response } from "express";
import { Router } from "express";
import { authRoutes, FTConnectError, ManagedFTConnectError } from "shared";
import { createExpressSharedRouter } from "shared-routes/express";
import type { AppDependencies } from "../../../../config/bootstrap/createAppDependencies";
import { makeRedirectErrorUrl } from "../../../../config/helpers/makeRedirectErrorUrl";
import { sendHttpResponse } from "../../../../config/helpers/sendHttpResponse";
import { sendRedirectResponse } from "../../../../config/helpers/sendRedirectResponse";
import { getGenericAuthOrThrow } from "../../../../domains/core/authentication/connected-user/entities/user.helper";

export const createAuthRouter = (deps: AppDependencies) => {
  const router = Router({ mergeParams: true });

  const authSharedRouter = createExpressSharedRouter(authRoutes, router);

  authSharedRouter.initiateLoginByOAuth((req, res) =>
    sendRedirectResponse(req, res, () =>
      deps.useCases.initiateLoginByOAuth.execute(req.query),
    ),
  );

  authSharedRouter.afterEmailOrProConnectOAuthLogin(async (req, res) => {
    return sendHttpResponse(req, res, async () => {
      const useCaseResult =
        await deps.useCases.afterOAuthSuccessRedirection.execute(req.query);
      if (useCaseResult.provider === "proConnect") {
        return res.status(302).redirect(useCaseResult.redirectUri);
      }
      return useCaseResult;
    });
  });

  authSharedRouter.afterFTConnectOAuthLogin(async (req, res) => {
    return sendHttpResponse(req, res, async () => {
      return deps.useCases.afterOAuthSuccessRedirection
        .execute(req.query)
        .then((result) => {
          return res.status(302).redirect(result.redirectUri);
        })
        .catch((error) => {
          if (error instanceof ManagedFTConnectError)
            return res.redirect(makeRedirectErrorUrl({}, deps.config));
          if (error instanceof FTConnectError)
            return res.redirect(
              makeRedirectErrorUrl(
                { title: error.title, message: error.message },
                deps.config,
              ),
            );

          throw error;
        });
    });
  });

  authSharedRouter.initiateLoginByEmail((req, res) =>
    sendHttpResponse(req, res, () =>
      deps.useCases.initiateLoginByEmail.execute(req.body),
    ),
  );

  authSharedRouter.getOAuthLogoutUrl(
    (req: Request<any, any, any, any>, res: Response, next: NextFunction) =>
      deps.connectedUserAuthMiddleware(req, res, next),
    (req, res) =>
      sendHttpResponse(req, res, () =>
        deps.useCases.getOAuthLogoutUrl.execute(
          undefined,
          getGenericAuthOrThrow(req.payloads?.currentUser),
        ),
      ),
  );

  authSharedRouter.getConnectedUser(
    deps.connectedUserAuthMiddleware,
    (req, res) =>
      sendHttpResponse(req, res, () =>
        deps.useCases.getConnectedUser.execute(
          req.query,
          getGenericAuthOrThrow(req.payloads?.currentUser),
        ),
      ),
  );

  authSharedRouter.getConnectedUsers(
    deps.connectedUserAuthMiddleware,
    (req, res) =>
      sendHttpResponse(req, res, () =>
        deps.useCases.getConnectedUsers.execute(
          req.query,
          getGenericAuthOrThrow(req.payloads?.currentUser),
        ),
      ),
  );

  authSharedRouter.renewExpiredJwt((req, res) =>
    sendHttpResponse(req, res, () =>
      deps.useCases.renewExpiredJwt.execute(req.query),
    ),
  );

  return router;
};
