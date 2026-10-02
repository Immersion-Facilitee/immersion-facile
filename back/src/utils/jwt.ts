import { createHash, generateKeyPairSync } from "node:crypto";
import {
  type ConnectedUserDomainJwtPayload,
  type ConnectedUserJwtPayload,
  type ConventionId,
  type ConventionJwtPayload,
  type ConventionRole,
  currentJwtVersions,
  type Email,
  type EmailAuthCodeDomainJwtPayload,
  type EmailAuthCodeJwtPayload,
  type EmailHash,
  errors,
  getJwtExpiredSinceInSeconds,
  oneDayInSecond,
  oneHourInSeconds,
  oneMinuteInSeconds,
} from "shared";
import type { JwtKind, VerifyJwtFn } from "../domains/core/jwt";
import type { TimeGateway } from "../domains/core/time-gateway/ports/TimeGateway";

export const generateES256KeyPair = (): {
  publicKey: string;
  privateKey: string;
} =>
  generateKeyPairSync("ec", {
    namedCurve: "prime256v1", // This is the P-256 curve
    publicKeyEncoding: {
      type: "spki", // SubjectPublicKeyInfo format
      format: "pem",
    },
    privateKeyEncoding: {
      type: "pkcs8", // Public-Key Cryptography Standards #8
      format: "pem",
    },
  });

export const makeThrowIfIncorrectJwt =
  <K extends JwtKind>(verifyJwt: VerifyJwtFn<K>, timeGateway: TimeGateway) =>
  (code: string) => {
    try {
      verifyJwt(code);
    } catch (error: any) {
      if (error?.message === "jwt expired") {
        const expiredSinceSeconds = getJwtExpiredSinceInSeconds(
          code,
          timeGateway.now(),
        );
        if (expiredSinceSeconds) {
          throw errors.user.expiredJwt(
            Math.ceil(expiredSinceSeconds / oneMinuteInSeconds),
          );
        }
      }
      throw errors.user.invalidJwt();
    }
  };

const stringToMd5 = (str: string) => {
  try {
    return createHash("md5").update(str).digest("hex");
  } catch (error) {
    Error.captureStackTrace(error as Error);
    throw error;
  }
};
export const makeEmailHash = (email: Email): string => stringToMd5(email);

export type CreateConventionMagicLinkPayloadProperties = {
  id: ConventionId;
  role: ConventionRole;
  email: string;
  now: Date;
  durationDays?: number;
  expOverride?: number;
};

export const createConventionMagicLinkPayload = ({
  id,
  role,
  email,
  now,
  durationDays = 31,
  expOverride,
}: CreateConventionMagicLinkPayloadProperties): ConventionJwtPayload => {
  const iat = Math.round(now.getTime() / 1000);
  const exp = expOverride ?? iat + durationDays * oneDayInSecond;

  return {
    version: currentJwtVersions.convention,
    applicationId: id, //TODO : replace applicationId by conventionId on convention magic link payload (applicationId was legacy name)
    role,
    iat,
    exp,
    emailHash: makeEmailHash(email),
  };
};

export type CreateConnectedUserJwtPayloadProperties = {
  durationHours: number;
  now: Date;
  expOverride?: number;
} & ConnectedUserDomainJwtPayload;

export const createConnectedUserJwtPayload = ({
  userId,
  durationHours,
  now,
  expOverride,
}: CreateConnectedUserJwtPayloadProperties): ConnectedUserJwtPayload => {
  const iat = Math.round(now.getTime() / 1000);
  const exp = expOverride ?? iat + durationHours * oneHourInSeconds;

  return {
    version: currentJwtVersions.connectedUser,
    userId,
    iat,
    exp,
  };
};

export type EmailAuthCodeJwtPayloadProperties = {
  now: Date;
  durationMinutes: number;
  expOverride?: number;
} & EmailAuthCodeDomainJwtPayload;

export const createEmailAuthCodeJwtPayload = ({
  now,
  durationMinutes,
  expOverride,
  emailAuthCode,
}: EmailAuthCodeJwtPayloadProperties): EmailAuthCodeJwtPayload & {
  iat: number;
  exp: number;
} => {
  const iat = Math.round(now.getTime() / 1000);
  const exp = expOverride ?? iat + durationMinutes * oneMinuteInSeconds;

  return {
    emailAuthCode,
    version: currentJwtVersions.emailAuthCode,
    iat,
    exp,
  };
};

export const isSomeEmailMatchingEmailHash = (
  emails: Email[],
  emailHash: EmailHash,
): boolean => emails.some((email) => makeEmailHash(email) === emailHash);
