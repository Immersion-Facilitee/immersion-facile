import type { NextFunction, Request, RequestHandler, Response } from "express";
import jwt from "jsonwebtoken";
import { errors, isOtpJwtPayload, otpSessionCookieName } from "shared";
import { handleHttpJsonResponseError } from "../helpers/handleHttpJsonResponseError";

const isOtpJwt = (authorization: string): boolean => {
  const unsafePayload = jwt.decode(authorization);
  return (
    unsafePayload !== null &&
    typeof unsafePayload === "object" &&
    isOtpJwtPayload(unsafePayload)
  );
};

export const makeConventionMagicLinkOrOtpSessionAuthMiddleware =
  (deps: {
    magicLinkAuthMiddleware: RequestHandler;
    otpSessionAuthMiddleware: RequestHandler;
  }): RequestHandler =>
  (req: Request, res: Response, next: NextFunction) => {
    const authorization = req.headers.authorization;
    if (!authorization && !req.cookies?.[otpSessionCookieName])
      return handleHttpJsonResponseError(
        req,
        res,
        errors.auth.missingAuthentication(),
      );

    if (!authorization || isOtpJwt(authorization))
      return deps.otpSessionAuthMiddleware(req, res, next);

    return deps.magicLinkAuthMiddleware(req, res, next);
  };
