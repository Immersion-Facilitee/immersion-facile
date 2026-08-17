import type {
  Email,
  ExternalId,
  ExtractFromExisting,
  FederatedIdentityProvider,
  Flavor,
  OAuthState,
} from "shared";

export type OAuthJwt = Flavor<string, "OAuthJwt">;
export type OAuthNonce = Flavor<string, "OAuthNonce">;
export type IdToken = Flavor<string, "IdToken">;

type OngoingAuthCommon = {
  userId?: string;
  state: OAuthState;
  nonce: OAuthNonce;
  usedAt: Date | null;
  fromUri: string;
  updatedAt?: Date;
};

export type EmailOrProConnectOngoingAuth =
  | EmailOngoingAuth
  | ProConnectOngoingAuth;

export type EmailOngoingAuth = OngoingAuthCommon & {
  provider: ExtractFromExisting<FederatedIdentityProvider, "email">;
  email: Email;
};
export type ProConnectOngoingAuth = OngoingAuthCommon & {
  provider: ExtractFromExisting<FederatedIdentityProvider, "proConnect">;
  externalId?: ExternalId;
  accessToken?: OAuthJwt; //TODO Pourquoi on le stocke en DB (on ne fait que le save)
  idToken: IdToken | null;
};
export type FTConnectOngoingAuth = OngoingAuthCommon & {
  provider: ExtractFromExisting<FederatedIdentityProvider, "ftConnect">;
  externalId?: ExternalId;
  accessToken?: OAuthJwt;
  idToken: IdToken | null;
};

export type OngoingOAuth =
  | ProConnectOngoingAuth
  | EmailOngoingAuth
  | FTConnectOngoingAuth;
