import type { NextFunction, Request, RequestHandler, Response } from "express";
import {
  errors,
  type GetVisitorSessionQueryParams,
  makeVisitorSessionCookieName,
} from "shared";
import { match } from "ts-pattern";
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
      const cookieScope = getVisitorSessionCookieScope(req);
      const sessionId = cookieScope
        ? req.cookies?.[makeVisitorSessionCookieName(cookieScope)]
        : undefined;

      if (!cookieScope || !sessionId)
        throw errors.visitorSession.unauthorized();

      await deps.uowPerformer.perform(async (uow) => {
        const visitorSession =
          await uow.visitorSessionRepository.getById(sessionId);
        const now = deps.timeGateway.now();

        if (
          !visitorSession ||
          visitorSession.revokedAt ||
          new Date(visitorSession.expiresAt) <= now
        )
          throw errors.visitorSession.unauthorized();

        match(cookieScope)
          .with({ purpose: "manageConvention" }, ({ conventionId }) => {
            if (
              visitorSession.purpose !== "manageConvention" ||
              visitorSession.subject.conventionId !== conventionId
            )
              throw errors.visitorSession.unauthorized();

            const { role, emailHash } = visitorSession.subject;
            req.payloads = {
              convention: {
                applicationId: conventionId,
                role,
                emailHash,
              },
            };
          })
          .exhaustive();
      });

      next();
    } catch (error) {
      handleHttpJsonResponseError(req, res, error);
    }
  };

const getVisitorSessionCookieScope = (
  req: Request,
): GetVisitorSessionQueryParams | undefined => {
  const conventionId =
    req.params.conventionId ?? req.body?.conventionId ?? req.query.conventionId;
  if (typeof conventionId !== "string") return undefined;

  const purpose = req.query.purpose;
  if (purpose !== undefined && purpose !== "manageConvention") return undefined;

  return { purpose: "manageConvention", conventionId };
};
