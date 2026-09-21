import { intersection } from "ramda";
import type { AgencyId, AgencyRight } from "../agency/agency.dto";
import type { AssessmentMode } from "../assessment/assessment.dto";
import { isEstablishmentTutorIsEstablishmentRepresentative } from "../convention/convention";
import type { ConventionDto, Signatories } from "../convention/convention.dto";
import {
  agencyModifierRoles,
  allModifierRoles,
  allowedRolesToAccessAssessment,
  allowedRolesToCreateAssessment,
  type ModifierRole,
  type Role,
  type SignatoryRole,
} from "./role.dto";

export const titleByRole: Record<Role, string> = {
  "back-office": "back-office",
  beneficiary: "bénéficiaire",
  "beneficiary-representative": "représentant légal du bénéficiaire",
  "establishment-representative": "représentant de l'entreprise",
  "beneficiary-current-employer":
    "représentant de l'entreprise actuelle du candidat",
  "establishment-tutor": "tuteur de l'entreprise",
  "agency-admin": "administrateur de l'agence",
  "to-review": "à revoir",
  counsellor: "conseiller",
  validator: "valideur",
  "agency-viewer": "lecteur",
  "establishment-contact": "contact de l'entreprise",
  "establishment-admin": "administrateur de l'entreprise",
};

export const conventionSignatoryRoleBySignatoryKey: Record<
  SignatoryRole,
  keyof Signatories
> = {
  beneficiary: "beneficiary",
  "beneficiary-current-employer": "beneficiaryCurrentEmployer",
  "beneficiary-representative": "beneficiaryRepresentative",
  "establishment-representative": "establishmentRepresentative",
};

export const hasAllowedRoleOnAssessment = (
  userRolesOnConvention: Role[],
  mode: AssessmentMode,
  convention: ConventionDto,
): boolean => {
  const hasAllowedRoleToCreateAssessment =
    isEstablishmentTutorIsEstablishmentRepresentative(convention)
      ? intersection(
          [...allowedRolesToCreateAssessment, "establishment-representative"],
          userRolesOnConvention,
        ).length > 0
      : intersection(allowedRolesToCreateAssessment, userRolesOnConvention)
          .length > 0;
  const hasAllowedRoleToAccessAssessment =
    intersection(allowedRolesToAccessAssessment, userRolesOnConvention).length >
    0;

  return (
    userRolesOnConvention.length > 0 &&
    ((mode === "CreateAssessment" && hasAllowedRoleToCreateAssessment) ||
      (mode === "GetAssessment" && hasAllowedRoleToAccessAssessment))
  );
};

export const isModifierRole = (role: Role): role is ModifierRole =>
  allModifierRoles.includes(role as ModifierRole);

export const hasAllowedRolesToEditConvention = (
  userRolesOnConvention: Role[],
): boolean => {
  const hasAllowedRoleToEditConvention =
    intersection(allModifierRoles, userRolesOnConvention).length > 0;

  return userRolesOnConvention.length > 0 && hasAllowedRoleToEditConvention;
};

export const hasAgencyAllowedRolesToUpdateBeneficiaryBirthdateWithFinalStatus =
  ({
    agencyRights,
    agencyId,
  }: {
    agencyRights: AgencyRight[];
    agencyId: AgencyId;
  }): boolean =>
    agencyRights
      .find((agencyRight) => agencyRight.agency.id === agencyId)
      ?.roles.some((role) =>
        [...agencyModifierRoles, "agency-admin"].includes(role),
      ) ?? false;
