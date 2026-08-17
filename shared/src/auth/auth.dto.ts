import type { AbsoluteUrl } from "../AbsoluteUrl";
import type { Email } from "../email/email.dto";
import type { FederatedIdentityProvider } from "../federatedIdentities/federatedIdentity.dto";
import { frontRoutes } from "../routes/routes";
import type { EmailAuthCodeJwt } from "../tokens/jwt.dto";
import type { Flavor } from "../typeFlavors";
import type { ExtractFromExisting } from "../utils";

export type AllowedLoginSource = ExtractFromExisting<
  keyof typeof frontRoutes,
  | "admin"
  | "addAgency"
  | "agencyDashboard"
  | "agencyDashboardAgencyDetails"
  | "archivedConventionRequest"
  | "beneficiaryDashboard"
  | "beneficiaryDashboardDiscussions"
  | "beneficiaryDashboardConventions"
  | "conventionTemplate"
  | "establishmentDashboard"
  | "establishmentDashboardDiscussions"
  | "formEstablishment"
  | "manageConventionConnectedUser"
  | "myAccount"
>;

export type AllowedFtRedirectRoute = ExtractFromExisting<
  keyof typeof frontRoutes,
  "conventionImmersion"
>;

export type AllowedRedirectUri = ReturnType<
  (typeof frontRoutes)[AllowedLoginSource]
>["href"];

export const allowedLoginSources: Record<
  AllowedLoginSource,
  (typeof frontRoutes)[AllowedLoginSource]
> = {
  admin: frontRoutes.admin,
  addAgency: frontRoutes.addAgency,
  agencyDashboard: frontRoutes.agencyDashboard,
  agencyDashboardAgencyDetails: frontRoutes.agencyDashboardAgencyDetails,
  archivedConventionRequest: frontRoutes.archivedConventionRequest,
  beneficiaryDashboard: frontRoutes.beneficiaryDashboard,
  beneficiaryDashboardConventions: frontRoutes.beneficiaryDashboardConventions,
  beneficiaryDashboardDiscussions: frontRoutes.beneficiaryDashboardDiscussions,
  conventionTemplate: frontRoutes.conventionTemplate,
  establishmentDashboard: frontRoutes.establishmentDashboard,
  establishmentDashboardDiscussions:
    frontRoutes.establishmentDashboardDiscussions,
  formEstablishment: frontRoutes.formEstablishment,
  manageConventionConnectedUser: frontRoutes.manageConventionConnectedUser,
  myAccount: frontRoutes.myAccount,
};

export type ExternalId = Flavor<string, "ExternalId">;

export type IdentityProvider = Extract<
  FederatedIdentityProvider,
  "proConnect" | "email"
>;
export type OAuthState = Flavor<string, "OAuthState">;
export type OAuthCode = Flavor<string, "OAuthCode">;

export type OAuthSuccessLoginParams = {
  state: OAuthState;
  code: OAuthCode | EmailAuthCodeJwt;
};

export type AlreadyAuthenticatedUserQueryParams = {
  alreadyUsedAuthentication: boolean;
};

export type WithRedirectUri = {
  redirectUri: AllowedRedirectUri;
};

export type OAuthProviderForLogin = Exclude<FederatedIdentityProvider, "email">;
export const oAuthProvidersForLogin = [
  "proConnect",
  "ftConnect",
] as const satisfies OAuthProviderForLogin[];

export type InitiateLoginByOAuthParams = WithRedirectUri & {
  provider: OAuthProviderForLogin;
};

export type InitiateLoginByEmailParams = WithRedirectUri & {
  email: Email;
};

export type AfterOAuthSuccessRedirectionResponse = {
  provider: FederatedIdentityProvider;
  redirectUri: AbsoluteUrl;
};

export const authExpiredBaseMessage =
  "Le lien d'authentification fourni a expiré";

export const authExpiredMessage = (durationInMinutes?: number) =>
  durationInMinutes
    ? `${authExpiredBaseMessage} depuis ${durationInMinutes} minute${durationInMinutes > 1 ? "s" : ""}.`
    : `${authExpiredBaseMessage}.`;
