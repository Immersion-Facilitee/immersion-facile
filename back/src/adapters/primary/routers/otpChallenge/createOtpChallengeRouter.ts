import { Router } from "express";
import { otpChallengeRoutes, type VisitorOtpJwtPayload } from "shared";
import { createExpressSharedRouter } from "shared-routes/express";
import { match } from "ts-pattern";
import type { AppDependencies } from "../../../../config/bootstrap/createAppDependencies";
import { sendHttpResponse } from "../../../../config/helpers/sendHttpResponse";
import { getGenericAuthOrThrow } from "../../../../domains/core/authentication/connected-user/entities/user.helper";

const visitorSessionCookieName = ({
  purpose,
  subject,
}: VisitorOtpJwtPayload): string =>
  match(purpose)
    .with("manageConvention", () => `if_visitor_${subject.conventionId}`)
    .exhaustive();

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
        res.cookie(visitorSessionCookieName(visitorOtp), id, {
          httpOnly: true,
          secure: true,
          sameSite: "lax",
          path: "/",
          maxAge: new Date(expiresAt).getTime() - Date.now(),
        });
      }),
  );

  return expressRouter;
};
