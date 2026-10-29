import type { Flavor, OAuthState, ShortLinkId } from "..";
import type { PayloadKind } from "./payload.dto";

export type ApiConsumerJwt = Flavor<string, "ApiConsumerJwt">;
export type ConventionJwt = Flavor<string, "ConventionJwt">;
export type ConnectedUserJwt = Flavor<string, "ConnectedUserJwt">;
export type EmailAuthCodeJwt = Flavor<string, "EmailAuthCodeJwt">;
export type VisitorOtpJwt = Flavor<string, "VisitorOtpJwt">;

export type AppSupportedJwt =
  | ApiConsumerJwt
  | ConventionJwt
  | ConnectedUserJwt
  | EmailAuthCodeJwt
  | VisitorOtpJwt;

export type ConventionSupportedJwt = ConventionJwt | ConnectedUserJwt;

export const currentJwtVersions: Record<PayloadKind, number> = {
  convention: 1,
  connectedUser: 1,
  currentUser: 1, // useless, just for typecheck
  emailAuthCode: 1,
  visitorOtp: 1,
};

export type JwtDto = {
  jwt: AppSupportedJwt;
};

export const expiredJwtErrorTitle = "Votre lien de connexion a expiré";
export const expiredJwtErrorMessage = "Le lien magique est périmé";
export const unsupportedMagicLinkErrorMessage =
  "Le lien magique est n'est pas valide";

export type RenewExpiredJwtRequestDto =
  | {
      kind: "convention";
      originalUrl: string;
      expiredJwt: ConventionJwt;
    }
  | {
      kind: "conventionFromShortLink";
      shortLinkId: ShortLinkId;
      expiredJwt: ConventionJwt;
    }
  | {
      kind: "connectedUser";
      expiredJwt: ConnectedUserJwt;
    }
  | { kind: "emailAuthCode"; state: OAuthState; expiredJwt: EmailAuthCodeJwt };
