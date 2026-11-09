import type { NextFunction, Request, RequestHandler, Response } from "express";
import jwt from "jsonwebtoken";
import { errors } from "shared";
import { handleHttpJsonResponseError } from "../helpers/handleHttpJsonResponseError";

export const makeConventionMagicLinkOrVisitorSessionAuthMiddleware =
  (deps: {
    magicLinkAuthMiddleware: RequestHandler;
    visitorSessionAuthMiddleware: RequestHandler;
  }): RequestHandler =>
  (req: Request, res: Response, next: NextFunction) => {
    const authorization = req.headers.authorization;
    if (!authorization)
      return deps.visitorSessionAuthMiddleware(req, res, next);

    const unsafePayload = jwt.decode(authorization);
    if (
      unsafePayload &&
      typeof unsafePayload === "object" &&
      "purpose" in unsafePayload
    )
      return handleHttpJsonResponseError(
        req,
        res,
        errors.visitorSession.unauthorized(),
      );

    return deps.magicLinkAuthMiddleware(req, res, next);
  };
