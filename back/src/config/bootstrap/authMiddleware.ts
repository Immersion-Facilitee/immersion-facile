import Bottleneck from "bottleneck";
import type { NextFunction, Request, RequestHandler, Response } from "express";
import jwt, { TokenExpiredError } from "jsonwebtoken";
import {
  type ApiConsumer,
  castError,
  currentJwtVersions,
  type ExtractFromExisting,
  errors,
  expiredJwtErrorMessage,
  type PayloadKind,
  unsupportedMagicLinkErrorMessage,
} from "shared";
import type { GetApiConsumerById } from "../../domains/core/api-consumer/ports/ApiConsumerRepository";
import { type JwtKind, makeVerifyJwtES256 } from "../../domains/core/jwt";
import type { TimeGateway } from "../../domains/core/time-gateway/ports/TimeGateway";
import { createLogger } from "../../utils/logger";
import type { AppConfig } from "./appConfig";
import { invalidTokenMessage } from "./connectedUserAuthMiddleware";

const logger = createLogger(__filename);

const convertRouteToLog = (originalUrl: string) => {
  const [_domain, ...rest] = originalUrl.split("/");
  return rest.join("/").split("?")[0];
};

export type AuthorisationStatus =
  | "authorised"
  | "unauthorisedId"
  | "incorrectJwt"
  | "expiredToken"
  | "consumerNotFound"
  | "consumerRevoked"
  | "keyRenewed"
  | "tooManyRequests"
  | "unauthenticated";

type LogApiConsumerParams = {
  apiConsumer: ApiConsumer | null;
  authorisationStatus: AuthorisationStatus;
};

const createApiConsumerLogger =
  (req: Request) =>
  ({ apiConsumer, authorisationStatus }: LogApiConsumerParams) => {
    const route = convertRouteToLog(req.originalUrl);
    logger.info({
      apiConsumerCall: {
        consumerName: apiConsumer?.name,
        consumerId: apiConsumer?.id,
        route: {
          method: req.method,
          url: route,
        },
        authorisationStatus,
      },
    });
  };

const responseError = (
  res: Response,
  message: string,
  status = 403,
): Response<any, Record<string, any>> =>
  res.status(status).json({ status, message: `forbidden: ${message}` });

export const makeMagicLinkAuthMiddleware = (
  config: AppConfig,
  payloadKey: ExtractFromExisting<PayloadKind, "convention">,
): RequestHandler => {
  const { verifyJwt, verifyDeprecatedJwt } =
    verifyJwtConfig<"convention">(config);
  return (req, res, next) => {
    const maybeJwt = req.headers.authorization;
    if (!maybeJwt) {
      return responseError(res, "unauthenticated", 401);
    }
    try {
      const payload = verifyJwt(maybeJwt);
      // TODO : check that if exp > now, it throws 401
      const currentJwtVersion = currentJwtVersions[payloadKey];

      if (!payload.version || payload.version < currentJwtVersion) {
        return sendNeedsRenewedLinkError(
          res,
          new TokenExpiredError(
            "Token corresponds to an old version, please renew",
            new Date(currentJwtVersions[payloadKey]),
          ),
        );
      }

      if (!("applicationId" in payload) && !("userId" in payload))
        return sendAuthenticationError(res, errors.user.invalidJwt());

      req.payloads = { [payloadKey]: payload };

      next();
    } catch (err) {
      const castedError = castError(err);

      if (err instanceof TokenExpiredError) {
        const unsafePayload = jwt.decode(maybeJwt);
        return unsafePayload
          ? sendNeedsRenewedLinkError(res, err)
          : sendAuthenticationError(res, err);
      }

      try {
        verifyDeprecatedJwt(maybeJwt);
        return sendNeedsRenewedLinkError(res, castedError);
      } catch (error) {
        return sendAuthenticationError(res, castError(error));
      }
    }
  };
};

const sendAuthenticationError = (res: Response, error: Error) => {
  logger.error({ error, message: "authentication failed" });
  res.status(401);
  return res.json({
    status: 401,
    message: invalidTokenMessage,
  });
};

const sendNeedsRenewedLinkError = (res: Response, error: Error) => {
  logger.info({ error, message: "unsupported or expired magic link used" });
  res.status(403);
  return error instanceof Error
    ? res.json({
        message:
          error.message === "jwt expired"
            ? expiredJwtErrorMessage
            : unsupportedMagicLinkErrorMessage,
        needsNewMagicLink: true,
      })
    : res.json({ message: JSON.stringify(error), needsNewMagicLink: true });
};

export const verifyJwtConfig = <K extends JwtKind>(config: AppConfig) => {
  const verifyJwt = makeVerifyJwtES256<K>(config.jwtPublicKey);

  const verifyDeprecatedJwt = config.previousJwtPublicKey
    ? makeVerifyJwtES256<K>(config.previousJwtPublicKey)
    : () => {
        throw errors.user.missingPreviousJwtPublicKey();
      };

  return { verifyJwt, verifyDeprecatedJwt };
};

const responseErrorForV2 = (res: Response, message: string, status = 403) =>
  res.status(status).json({ message, status });

export const makeConsumerMiddleware = (
  getApiConsumerById: GetApiConsumerById,
  timeGateway: TimeGateway,
  config: AppConfig,
) => {
  const verifyJwt = makeVerifyJwtES256<"apiConsumer">(config.apiJwtPublicKey);
  const consumerMiddlewareLimiter = new Bottleneck.Group({
    highWater: 0,
    strategy: Bottleneck.strategy.BLOCK,
    reservoir: config.maxApiConsumerCallsPerSecond,
    reservoirRefreshInterval: 1000,
    reservoirRefreshAmount: config.maxApiConsumerCallsPerSecond,
  });

  return async (
    req: Request<any, any, any, any>,
    res: Response,
    next: NextFunction,
  ) => {
    const log = createApiConsumerLogger(req);
    if (!req.headers.authorization) {
      log({ apiConsumer: null, authorisationStatus: "unauthenticated" });
      return responseErrorForV2(res, "unauthenticated", 401);
    }

    try {
      const jwtPayload = verifyJwt(req.headers.authorization);
      const { id } = jwtPayload;

      const apiConsumer = await getApiConsumerById(id);

      if (!apiConsumer) {
        log({
          apiConsumer: null,
          authorisationStatus: "consumerNotFound",
        });
        return responseErrorForV2(res, "consumer not found", 401);
      }

      if (apiConsumer.revokedAt) {
        log({
          apiConsumer,
          authorisationStatus: "consumerRevoked",
        });
        return responseErrorForV2(res, "api consumer revoked", 401);
      }

      if (jwtPayload.iat) {
        const jwtIssuedAt = new Date(jwtPayload.iat * 1000);
        const currentKeyIssuedAt = new Date(apiConsumer.currentKeyIssuedAt);
        if (jwtIssuedAt < currentKeyIssuedAt) {
          log({
            apiConsumer,
            authorisationStatus: "keyRenewed",
          });
          return responseErrorForV2(res, "api key has been renewed", 401);
        }
      }

      if (new Date(apiConsumer.expirationDate) < timeGateway.now()) {
        log({
          apiConsumer,
          authorisationStatus: "expiredToken",
        });
        return responseErrorForV2(res, "expired token", 401);
      }

      // only if the OAuth is known, and the id authorized, not revoked, key valid, and not expired we add apiConsumer payload to the request:
      log({
        apiConsumer,
        authorisationStatus: "authorised",
      });

      const userLimiter = consumerMiddlewareLimiter.key(apiConsumer.id);

      req.apiConsumer = apiConsumer;

      return await userLimiter

        .schedule(async () => next())
        .catch((error) => {
          logger.error({
            error,
          });
          log({
            apiConsumer,
            authorisationStatus: "tooManyRequests",
          });
          return responseErrorForV2(
            res,
            "Too many requests, please try again later.",
            429,
          );
        });
    } catch (error) {
      const castedError = castError(error);
      logger.error({
        error: castedError,
        message: `makeApiKeyAuthMiddlewareV2 : ${castedError.message}`,
      });
      log({
        apiConsumer: null,
        authorisationStatus: "incorrectJwt",
      });
      return responseErrorForV2(res, "incorrect Jwt", 401);
    }
  };
};
