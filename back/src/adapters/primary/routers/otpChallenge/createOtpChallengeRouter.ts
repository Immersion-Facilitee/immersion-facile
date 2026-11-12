import { Router } from "express";
import {
  errors,
  otpChallengeRoutes,
  type VisitorSessionId,
  visitorSessionCookieName,
} from "shared";
import { createExpressSharedRouter } from "shared-routes/express";
import type { AppDependencies } from "../../../../config/bootstrap/createAppDependencies";
import { sendHttpResponse } from "../../../../config/helpers/sendHttpResponse";
import { getGenericAuthOrThrow } from "../../../../domains/core/authentication/connected-user/entities/user.helper";

export const createOtpChallengeRouter = (deps: AppDependencies): Router => {
  const expressRouter = Router();

  const sharedOtpChallengeRouter = createExpressSharedRouter(
    otpChallengeRoutes,
    expressRouter,
  );

  sharedOtpChallengeRouter.getMaskedOtpRecipient(
    deps.visitorOtpAuthMiddleware,
    (req, res) =>
      sendHttpResponse(req, res, () =>
        deps.useCases.getMaskedOtpRecipients.execute(
          undefined,
          getGenericAuthOrThrow(req.payloads?.visitorOtp),
        ),
      ),
  );

  sharedOtpChallengeRouter.requestOtpChallenge(
    deps.visitorOtpAuthMiddleware,
    (req, res) =>
      sendHttpResponse(req, res.status(204), () =>
        deps.useCases.requestOtpChallenge.execute(
          req.body,
          getGenericAuthOrThrow(req.payloads?.visitorOtp),
        ),
      ),
  );

  sharedOtpChallengeRouter.verifyOtpChallenge(
    deps.visitorOtpAuthMiddleware,
    (req, res) =>
      sendHttpResponse(req, res.status(204), async () => {
        const visitorOtp = getGenericAuthOrThrow(req.payloads?.visitorOtp);
        const { id, expiresAt } =
          await deps.useCases.verifyOtpChallenge.execute(req.body, visitorOtp);
        res.cookie(visitorSessionCookieName, id, {
          httpOnly: true,
          secure: true,
          sameSite: "lax",
          path: "/",
          expires: new Date(expiresAt),
        });
      }),
  );

  sharedOtpChallengeRouter.getVisitorSession((req, res) =>
    sendHttpResponse(req, res, () => {
      const sessionId: VisitorSessionId | undefined =
        req.cookies?.[visitorSessionCookieName];
      if (!sessionId) throw errors.visitorSession.unauthorized();

      return deps.useCases.getVisitorSession.execute(req.query, { sessionId });
    }),
  );

  return expressRouter;
};
