import type { ApiConsumerId } from "../apiConsumer/ApiConsumer";
import type { ConventionId } from "../convention/convention.dto";
import type { ConventionActorRole } from "../role/role.dto";
import type { Flavor } from "../typeFlavors";
import type { ConnectedUser, UserId } from "../user/user.dto";

export type CommonJwtPayload = {
  iat?: number; // number of seconds from 1970-01-01T00:00:00Z UTC until the specified UTC date/time, ignoring leap seconds
  exp?: number; // number of seconds from 1970-01-01T00:00:00Z UTC until the specified UTC date/time, ignoring leap seconds
  version: number;
};

export type PayloadKind =
  | "convention"
  | "connectedUser"
  | "currentUser"
  | "emailAuthCode";

export type JwtPayloads = {
  convention?: ConventionJwtPayload;
  connectedUser?: ConnectedUserJwtPayload;
  emailAuthCode?: EmailAuthCodeJwtPayload;
  currentUser?: ConnectedUser;
};

export type AppSupportedJwtPayload =
  | ConventionJwtPayload
  | ConnectedUserJwtPayload
  | EmailAuthCodeJwtPayload
  | ConnectedUser;

export type AppSupportedDomainJwtPayload =
  | ApiConsumerDomainJwtPayload
  | ConventionDomainJwtPayload
  | ConnectedUserDomainJwtPayload
  | EmailAuthCodeDomainJwtPayload;

export type ConnectedUserDomainJwtPayload = { userId: UserId };
export type ConnectedUserJwtPayload = CommonJwtPayload &
  ConnectedUserDomainJwtPayload;

export type EmailHash = Flavor<string, "EmailHash">;

export type ConventionDomainJwtPayload = {
  applicationId: ConventionId;
  role: ConventionActorRole;
  emailHash: EmailHash; //< md5 of email
  sub?: string;
};

export type ApiConsumerDomainJwtPayload = {
  id: ApiConsumerId;
};

export type EmailAuthCodeDomainJwtPayload = { emailAuthCode: true };

export type EmailAuthCodeJwtPayload = CommonJwtPayload &
  EmailAuthCodeDomainJwtPayload;

export type ApiConsumerJwtPayload = CommonJwtPayload &
  ApiConsumerDomainJwtPayload;

export type ConventionJwtPayload = CommonJwtPayload &
  ConventionDomainJwtPayload;

export type ConventionRelatedJwtPayload =
  | ConventionDomainJwtPayload
  | ConnectedUserDomainJwtPayload;
