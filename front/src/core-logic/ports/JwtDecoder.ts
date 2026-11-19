import type {
  ConnectedUserJwtPayload,
  ConventionJwtPayload,
  EmailAuthCodeJwtPayload,
  OtpJwtPayload,
} from "../../../../shared/src/tokens/payload.dto";

export type SupportedDecodedJwt =
  | ConventionJwtPayload
  | ConnectedUserJwtPayload
  | EmailAuthCodeJwtPayload
  | OtpJwtPayload;

export interface JwtValidator {
  decodeJwt(jwt: string): SupportedDecodedJwt;
}
