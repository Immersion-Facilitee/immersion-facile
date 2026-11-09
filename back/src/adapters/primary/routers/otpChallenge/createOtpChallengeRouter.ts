import { Router } from "express";
import { makeVisitorSessionCookieName, otpChallengeRoutes } from "shared";
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
      sendHttpResponse(req, res, () =>
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
          await deps.useCases.verifyOtpChallenge.execute(
            {
              otpChallengeId: req.params.otpChallengeId,
              otpCode: req.body.otpCode,
            },
            visitorOtp,
          );
        res.cookie(
          makeVisitorSessionCookieName({
            purpose: visitorOtp.purpose,
            conventionId: visitorOtp.subject.conventionId,
          }),
          id,
          {
            httpOnly: true,
            secure: true,
            sameSite: "lax",
            path: "/",
            maxAge: new Date(expiresAt).getTime() - Date.now(),
          },
        );
      }),
  );

  sharedOtpChallengeRouter.getVisitorSession(
    deps.visitorSessionAuthMiddleware,
    (req, res) =>
      sendHttpResponse(req, res, () => {
        const sessionId = req.cookies[makeVisitorSessionCookieName(req.query)];
        return deps.useCases.getVisitorSession.execute({
          ...req.query,
          sessionId,
        });
      }),
  );

  return expressRouter;
};
