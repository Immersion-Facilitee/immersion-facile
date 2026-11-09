import type { NextFunction, Request, RequestHandler, Response } from "express";
import jwt from "jsonwebtoken";
import { errors } from "shared";
import { handleHttpJsonResponseError } from "../helpers/handleHttpJsonResponseError";

const isVisitorOtpJwt = (authorization: string): boolean => {
  const unsafePayload = jwt.decode(authorization);
  return (
    unsafePayload !== null &&
    typeof unsafePayload === "object" &&
    "purpose" in unsafePayload
  );
};

const hasVisitorSessionCookie = (req: Request): boolean =>
  Object.keys(req.cookies ?? {}).some((cookieName) =>
    cookieName.startsWith("if_visitor_"),
  );

export const makeConventionMagicLinkOrVisitorSessionAuthMiddleware =
  (deps: {
    magicLinkAuthMiddleware: RequestHandler;
    visitorSessionAuthMiddleware: RequestHandler;
  }): RequestHandler =>
  (req: Request, res: Response, next: NextFunction) => {
    const authorization = req.headers.authorization;
    if (!authorization && !hasVisitorSessionCookie(req))
      return handleHttpJsonResponseError(
        req,
        res,
        errors.auth.missingAuthentication(),
      );

    if (!authorization || isVisitorOtpJwt(authorization))
      return deps.visitorSessionAuthMiddleware(req, res, next);

    return deps.magicLinkAuthMiddleware(req, res, next);
  };
