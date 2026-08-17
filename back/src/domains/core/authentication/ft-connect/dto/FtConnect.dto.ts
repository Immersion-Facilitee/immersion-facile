import {
  type Beneficiary,
  type DateString,
  dateRegExp,
  type FederatedIdentityProvider,
  type FtConnectToken,
  type FtExternalId,
  type InternshipKind,
  type PhoneNumber,
} from "shared";
import type { EntityFromDto } from "../../../../../utils/EntityFromDto";
import type { IdToken } from "../../connected-user/entities/OngoingOAuth";
import type { FtConnectImmersionAdvisorDto } from "./FtConnectAdvisor.dto";
import type { FtConnectUserDto } from "./FtConnectUserDto";

export type ConventionFtUserAdvisorDto = {
  ftExternalId: FtExternalId;
  conventionId: string;
  advisor?: FtConnectImmersionAdvisorDto;
};

export type ConventionFtUserAdvisorEntity = EntityFromDto<
  ConventionFtUserAdvisorDto,
  "ConventionFranceTravailAdvisor"
>;

type BeneficiaryBasicIdentity = Pick<
  Beneficiary<InternshipKind>,
  "email" | "firstName" | "lastName" | "birthdate"
>;

export type ConventionFtConnectFields = BeneficiaryBasicIdentity & {
  fedId: FtConnectToken;
  fedIdProvider: FederatedIdentityProvider;
  fedIdToken: IdToken;
  phone?: PhoneNumber;
};

export type FtUserAndAdvisor = {
  advisor: FtConnectImmersionAdvisorDto | undefined;
  user: FtConnectUserDto;
};

export const toPartialConventionDtoWithFtIdentity = (
  ftConnectUserInfo: FtConnectUserDto,
  ftConnectIdToken: IdToken,
): ConventionFtConnectFields => ({
  email: ftConnectUserInfo.email || "",
  firstName: ftConnectUserInfo.firstName,
  lastName: ftConnectUserInfo.lastName,
  birthdate: ftConnectUserInfo.birthdate,
  phone: ftConnectUserInfo.phone,
  fedId: ftConnectUserInfo.ftExternalId,
  fedIdProvider: "ftConnect",
  fedIdToken: ftConnectIdToken,
});

export const ftconnectBeneficiaryBirthdateToIfBeneficiaryBirthdate = (
  birthdate: DateString,
): DateString => {
  const dateOnly = birthdate.split("T")[0];
  if (!dateOnly.match(dateRegExp)) throw new Error("Invalid date value");
  return dateOnly;
};
