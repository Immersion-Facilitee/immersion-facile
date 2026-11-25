import { Router } from "express";
import {
  errors,
  type OtpSessionId,
  otpChallengeRoutes,
  otpSessionCookieName,
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
    deps.otpAuthMiddleware,
    (req, res) =>
      sendHttpResponse(req, res, () =>
        deps.useCases.getMaskedOtpRecipients.execute(
          undefined,
          getGenericAuthOrThrow(req.payloads?.otp),
        ),
      ),
  );

  sharedOtpChallengeRouter.requestOtpChallenge(
    deps.otpAuthMiddleware,
    (req, res) =>
      sendHttpResponse(req, res.status(201), () =>
        deps.useCases.requestOtpChallenge.execute(
          req.body,
          getGenericAuthOrThrow(req.payloads?.otp),
        ),
      ),
  );

  sharedOtpChallengeRouter.verifyOtpChallenge(
    deps.otpAuthMiddleware,
    (req, res) =>
      sendHttpResponse(req, res, async () => {
        const otpJwtPayload = getGenericAuthOrThrow(req.payloads?.otp);
        const { id, session } = await deps.useCases.verifyOtpChallenge.execute(
          req.body,
          otpJwtPayload,
        );
        res.cookie(otpSessionCookieName, id, {
          httpOnly: true,
          secure:
            deps.config.envType === "production" ||
            deps.config.envType === "staging",
          sameSite: "lax",
          path: "/",
          expires: new Date(session.expiresAt),
        });
        return session;
      }),
  );

  sharedOtpChallengeRouter.getOtpSession((req, res) =>
    sendHttpResponse(req, res, () => {
      const sessionId: OtpSessionId | undefined =
        req.cookies?.[otpSessionCookieName];
      if (!sessionId) throw errors.otpSession.unauthorized();

      return deps.useCases.getOtpSession.execute(req.query, { sessionId });
    }),
  );

  return expressRouter;
};
