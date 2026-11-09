import type { NextFunction, Request, RequestHandler, Response } from "express";
import jwt from "jsonwebtoken";

const isVisitorOtpJwt = (authorization: string): boolean => {
  const unsafePayload = jwt.decode(authorization);
  return (
    unsafePayload !== null &&
    typeof unsafePayload === "object" &&
    "purpose" in unsafePayload
  );
};

export const makeConventionMagicLinkOrVisitorSessionAuthMiddleware =
  (deps: {
    magicLinkAuthMiddleware: RequestHandler;
    visitorSessionAuthMiddleware: RequestHandler;
  }): RequestHandler =>
  (req: Request, res: Response, next: NextFunction) => {
    const authorization = req.headers.authorization;
    if (!authorization || isVisitorOtpJwt(authorization))
      return deps.visitorSessionAuthMiddleware(req, res, next);

    return deps.magicLinkAuthMiddleware(req, res, next);
  };
