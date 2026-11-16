import type { NextFunction, Request, RequestHandler, Response } from "express";
import {
  errors,
  type GetVisitorSessionQueryParams,
  type VisitorSession,
  visitorSessionCookieName,
} from "shared";
import { match } from "ts-pattern";
import { getActiveVisitorSessionOrThrow } from "../../domains/core/authentication/visitor-session/entities/visitorSession.helper";
import type { TimeGateway } from "../../domains/core/time-gateway/ports/TimeGateway";
import type { UnitOfWorkPerformer } from "../../domains/core/unit-of-work/ports/UnitOfWorkPerformer";
import { handleHttpJsonResponseError } from "../helpers/handleHttpJsonResponseError";

type VisitorSessionAuthMiddlewareDeps = {
  uowPerformer: UnitOfWorkPerformer;
  timeGateway: TimeGateway;
};

export const makeVisitorSessionAuthMiddleware =
  (deps: VisitorSessionAuthMiddlewareDeps): RequestHandler =>
  (req: Request, res: Response, next: NextFunction) =>
    getActiveVisitorSessionOfRequest(req, deps)
      .then((visitorSession) => {
        match(visitorSession)
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

const getActiveVisitorSessionOfRequest = async (
  req: Request,
  deps: VisitorSessionAuthMiddlewareDeps,
): Promise<VisitorSession> => {
  const scope = getVisitorSessionScope(req);
  const sessionId = req.cookies?.[visitorSessionCookieName];

  if (!scope || !sessionId) throw errors.visitorSession.unauthorized();

  return deps.uowPerformer.perform((uow) =>
    getActiveVisitorSessionOrThrow({
      uow,
      sessionId,
      scope,
      now: deps.timeGateway.now(),
    }),
  );
};

const getVisitorSessionScope = (
  req: Request,
): GetVisitorSessionQueryParams | undefined => {
  const conventionId =
    req.params.conventionId ?? req.body?.conventionId ?? req.query.conventionId;
  if (typeof conventionId !== "string") return undefined;

  const purpose = req.query.purpose;
  if (purpose !== undefined && purpose !== "manageConvention") return undefined;

  return { purpose: "manageConvention", conventionId };
};
