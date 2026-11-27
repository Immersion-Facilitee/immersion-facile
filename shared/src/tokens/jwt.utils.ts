import { decode } from "js-base64";
import { safeParseJson } from "../utils/json";
import type {
  AppSupportedJwtPayload,
  ConnectedUserJwtPayload,
  ConventionJwtPayload,
  EmailAuthCodeJwtPayload,
  OtpJwtPayload,
} from "./payload.dto";

// handle unicode parsing issues between atob and JWT base64 format
const toBase64 = (input: string): string =>
  input.replace("-", "+").replace("_", "/");

export const decodeJwtWithoutSignatureCheck = <T>(jwtToken: string): T => {
  try {
    const [_header, payload, _authentication] = jwtToken.split(".");
    return JSON.parse(decode(toBase64(payload)));
  } catch (error) {
    console.error(decodeMagicLinkJwtWithoutSignatureCheck, error);
    throw new Error("401 Malformed JWT payload");
  }
};

export const decodeMagicLinkJwtWithoutSignatureCheck = <
  T extends AppSupportedJwtPayload,
>(
  jwtToken: string,
): T => decodeJwtWithoutSignatureCheck<T>(jwtToken);

export const isOtpJwtPayload = (payload: object): payload is OtpJwtPayload =>
  "purpose" in payload;

export const isConventionJwtPayload = (
  payload: object,
): payload is ConventionJwtPayload => "applicationId" in payload;

export const isConnectedUserJwtPayload = (
  payload: object,
): payload is ConnectedUserJwtPayload => "userId" in payload;

export const isEmailAuthCodeJwtPayload = (
  payload: object,
): payload is EmailAuthCodeJwtPayload => "emailAuthCode" in payload;

export const getJwtExpiredSinceInSeconds = (jwt: string, now: Date) => {
  const decoded = decodeJwtWithoutSignatureCheck<{ exp: number }>(jwt);
  const expiredSinceSeconds = Math.floor(now.getTime() / 1000) - decoded.exp;
  return expiredSinceSeconds > 0 ? expiredSinceSeconds : undefined;
};

export const handleJWTStringPossiblyContainingJsonError = (
  // JWT errors are wrongly formatted as JSON strings in back/src/utils/jwt.ts
  errorMessagePossiblyContainingJson: string,
) => {
  const parsedMessage = safeParseJson(errorMessagePossiblyContainingJson);
  const isMessageJsonError =
    parsedMessage !== null &&
    typeof parsedMessage === "object" &&
    "message" in parsedMessage;
  return isMessageJsonError
    ? (parsedMessage.message as string)
    : errorMessagePossiblyContainingJson;
};
