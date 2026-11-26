import type { NextFunction, Request, RequestHandler, Response } from "express";
import {
  errors,
  type GetOtpSessionQueryParams,
  type OtpSession,
  otpSessionCookieName,
} from "shared";
import { match } from "ts-pattern";
import { getActiveOtpSessionOrThrow } from "../../domains/core/authentication/otp-session/entities/otpSession.helper";
import type { TimeGateway } from "../../domains/core/time-gateway/ports/TimeGateway";
import type { UnitOfWorkPerformer } from "../../domains/core/unit-of-work/ports/UnitOfWorkPerformer";
import { handleHttpJsonResponseError } from "../helpers/handleHttpJsonResponseError";

type OtpSessionAuthMiddlewareDeps = {
  uowPerformer: UnitOfWorkPerformer;
  timeGateway: TimeGateway;
};

export const makeOtpSessionAuthMiddleware =
  (deps: OtpSessionAuthMiddlewareDeps): RequestHandler =>
  (req: Request, res: Response, next: NextFunction) =>
    getActiveOtpSessionOfRequest(req, deps)
      .then((otpSession) => {
        match(otpSession)
          .with({ purpose: "manageConvention" }, ({ subject }) => {
            const { conventionId, role, emailHash } = subject;
            req.payloads = {
              convention: {
                applicationId: conventionId,
                role,
                emailHash,
              },
            };
          })
          .exhaustive();

        next();
      })
      .catch((error) => handleHttpJsonResponseError(req, res, error));

const getActiveOtpSessionOfRequest = async (
  req: Request,
  deps: OtpSessionAuthMiddlewareDeps,
): Promise<OtpSession> => {
  const scope = getOtpSessionScope(req);
  const sessionId = req.cookies?.[otpSessionCookieName];

  if (!scope || !sessionId) throw errors.otpSession.unauthorized();

  return deps.uowPerformer.perform((uow) =>
    getActiveOtpSessionOrThrow({
      uow,
      sessionId,
      scope,
      now: deps.timeGateway.now(),
    }),
  );
};

const getOtpSessionScope = (
  req: Request,
): GetOtpSessionQueryParams | undefined => {
  const conventionId =
    req.params.conventionId ?? req.body?.conventionId ?? req.query.conventionId;
  if (typeof conventionId !== "string") return undefined;

  const purpose = req.query.purpose;
  if (purpose !== undefined && purpose !== "manageConvention") return undefined;

  return { purpose: "manageConvention", conventionId };
};
