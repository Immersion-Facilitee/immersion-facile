import type { NextFunction, Request, RequestHandler, Response } from "express";
import {
  errors,
  type GetVisitorSessionQueryParams,
  visitorSessionCookieName,
} from "shared";
import { match } from "ts-pattern";
import { getActiveVisitorSessionOrThrow } from "../../domains/core/authentication/visitor-session/entities/visitorSession.helper";
import type { TimeGateway } from "../../domains/core/time-gateway/ports/TimeGateway";
import type { UnitOfWorkPerformer } from "../../domains/core/unit-of-work/ports/UnitOfWorkPerformer";
import { handleHttpJsonResponseError } from "../helpers/handleHttpJsonResponseError";

export const makeVisitorSessionAuthMiddleware =
  (deps: {
    uowPerformer: UnitOfWorkPerformer;
    timeGateway: TimeGateway;
  }): RequestHandler =>
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const scope = getVisitorSessionScope(req);
      const sessionId = req.cookies?.[visitorSessionCookieName];

      if (!scope || !sessionId) throw errors.visitorSession.unauthorized();

      const visitorSession = await deps.uowPerformer.perform((uow) =>
        getActiveVisitorSessionOrThrow({
          uow,
          sessionId,
          scope,
          now: deps.timeGateway.now(),
        }),
      );

      match(visitorSession)
        .with({ purpose: "manageConvention" }, ({ subject }) => {
          const { conventionId, role, emailHash } = subject;
          req.payloads = {
            convention: {
              applicationId: conventionId,
              role,
              emailHash,
            },
            visitorSession: { sessionId },
          };
        })
        .exhaustive();

      next();
    } catch (error) {
      handleHttpJsonResponseError(req, res, error);
    }
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
