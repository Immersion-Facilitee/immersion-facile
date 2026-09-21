import type { AbsoluteUrl, DateString, PhoneNumber } from "shared";
import { defineRoute, defineRoutes } from "shared-routes";
import { z } from "zod";
import type { FTConnectAccessTokenResult } from "../../../connected-user/port/OAuthGateway";
import type { FtConnectAdvisorDto } from "../../dto/FtConnectAdvisor.dto";
import type { FtConnectUserDto } from "../../dto/FtConnectUserDto";
import {
  type ExternalAccessToken,
  type ExternalFtConnectAdvisor,
  type ExternalFtConnectUser,
  ftConnectAccessTokenHeadersSchema,
} from "./ftConnectApi.dto";
import { ftConnectHeadersSchema } from "./ftConnectApi.schema";

export const ftConnectNeededScopesForAllUsedApi = (clientId: string): string =>
  [
    `application_${clientId}`,
    "api_peconnect-individuv1",
    "api_peconnect-conseillersv1",
    "api_peconnect-statutv1",
    "individu",
    "openid",
    "profile",
    "email",
    "statut",
    "api_peconnect-datenaissancev1",
    "datenaissance",
    "api_peconnect-coordonneesv1",
    "coordonnees",
  ].join(" ");

type FtConnectRoutesConfig = {
  ftApiUrl: AbsoluteUrl;
  ftAuthCandidatUrl: AbsoluteUrl;
};

export type FtConnectExternalRoutes = ReturnType<
  typeof makeFtConnectExternalRoutes
>;

const _forceUnknownResponseBody = (responseBody: unknown): unknown =>
  responseBody;
// forceUnknownResponseBody is to avoid changing all the behavior related to peResponses being validated in the gateways
// TODO : move the validation here, and adapt the gateways
// explicitely : replace forceUnknownResponseBody by validation code made actually on adapter

export const makeFtConnectExternalRoutes = ({
  ftApiUrl,
  ftAuthCandidatUrl,
}: FtConnectRoutesConfig) =>
  defineRoutes({
    getAdvisorsInfo: defineRoute({
      method: "get",
      url: `${ftApiUrl}/partenaire/peconnect-conseillers/v1/contactspe/conseillers`,
      headersSchema: ftConnectHeadersSchema,
      responses: { 200: z.any() },
    }),
    getUserInfo: defineRoute({
      method: "get",
      url: `${ftApiUrl}/partenaire/peconnect-individu/v1/userinfo`,
      headersSchema: ftConnectHeadersSchema,
      responses: { 200: z.any() },
    }),
    getUserBirthDate: defineRoute({
      method: "get",
      url: `${ftApiUrl}/partenaire/peconnect-datenaissance/v1/etat-civil`,
      headersSchema: ftConnectHeadersSchema,
      responses: { 200: z.any() },
    }),
    getUserContactDetails: defineRoute({
      method: "get",
      url: `${ftApiUrl}/partenaire/peconnect-coordonnees/v1/coordonnees`,
      headersSchema: ftConnectHeadersSchema,
      responses: { 200: z.any() },
    }),
    getUserStatutInfo: defineRoute({
      method: "get",
      url: `${ftApiUrl}/partenaire/peconnect-statut/v1/statut`,
      headersSchema: ftConnectHeadersSchema,
      responses: { 200: z.any() },
    }),
    exchangeCodeForAccessToken: defineRoute({
      method: "post",
      url: `${ftAuthCandidatUrl}/connexion/oauth2/access_token?realm=%2Findividu`,
      requestBodySchema: z.string(),
      headersSchema: ftConnectAccessTokenHeadersSchema,
      responses: { 200: z.any() },
    }),
  });

export const toFtConnectAdvisorDto = (
  fromApi: ExternalFtConnectAdvisor,
): FtConnectAdvisorDto => ({
  email: fromApi.mail,
  firstName: fromApi.prenom,
  lastName: fromApi.nom,
  type: fromApi.type,
});

export const toFtConnectUserDto = (
  externalFtConnectUser: ExternalFtConnectUser & {
    isUserJobseeker: boolean;
    birthdate: DateString;
    phone?: PhoneNumber;
  },
): FtConnectUserDto => ({
  isJobseeker: externalFtConnectUser.isUserJobseeker,
  email: externalFtConnectUser.email,
  firstName: externalFtConnectUser.given_name,
  lastName: externalFtConnectUser.family_name,
  birthdate: externalFtConnectUser.birthdate,
  phone: externalFtConnectUser.phone,
  ftExternalId: externalFtConnectUser.idIdentiteExterne,
});

export const toAccessToken = (
  externalAccessToken: ExternalAccessToken,
): FTConnectAccessTokenResult => {
  const { access_token, expires_in, id_token, ...payload } =
    externalAccessToken;

  return {
    type: "ftConnect",
    payload,
    accessToken: access_token,
    expire: expires_in,
    idToken: id_token,
  };
};
