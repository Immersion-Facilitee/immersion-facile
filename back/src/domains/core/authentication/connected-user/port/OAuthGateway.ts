import type { AbsoluteUrl, Email, ExternalId, SiretDto } from "shared";
import type { IdToken, OAuthJwt } from "../entities/OngoingOAuth";

export type GetAccessTokenParams = {
  code: string;
};

export type ProConnectGetAccessTokenPayload = {
  nonce: string;
  sub: ExternalId;
  firstName: string;
  lastName: string;
  email: Email;
  structure_pe?: string;
  siret: SiretDto;
};

export type FTConnectGetAccessTokenPayload = {
  nonce: string;
};

type AccessTokenResultCommon = {
  expire: number;
  accessToken: OAuthJwt;
  idToken: IdToken;
};

export type FTConnectAccessTokenResult = AccessTokenResultCommon & {
  payload: FTConnectGetAccessTokenPayload;
  type: "ftConnect";
};

export type ProConnectAccessTokenResult = AccessTokenResultCommon & {
  payload: ProConnectGetAccessTokenPayload;
  type: "proConnect";
};

export type GetAccessTokenResult =
  | FTConnectAccessTokenResult
  | ProConnectAccessTokenResult;

export type GetLoginUrlParams = {
  nonce: string;
  state: string;
};

export type GetLogoutUrlParams = {
  idToken: IdToken;
  state: string;
};

export interface OAuthGateway {
  getLoginUrl(params: GetLoginUrlParams): Promise<AbsoluteUrl>;
  getAccessToken: (
    params: GetAccessTokenParams,
  ) => Promise<GetAccessTokenResult>;
  getLogoutUrl(params: GetLogoutUrlParams): Promise<AbsoluteUrl>;
}
