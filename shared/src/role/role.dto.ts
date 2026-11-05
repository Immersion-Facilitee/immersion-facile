import type { Signatories } from "../convention/convention.dto";
import type { ExtractFromExisting } from "../utils";

export type Role = (typeof allRoles)[number];
export type SignatoryRole = (typeof allSignatoryRoles)[number];
export type AgencyModifierRole = (typeof agencyModifierRoles)[number];
export type ModifierRole = (typeof allModifierRoles)[number];

export type ConventionEstablishmentRole =
  (typeof conventionEstablishmentsRoles)[number];
export const allRoles = [
  "beneficiary",
  "beneficiary-representative",
  "beneficiary-current-employer",
  "establishment-representative",
  "establishment-tutor",
  "counsellor",
  "validator",
  "back-office",
  "agency-admin",
  "to-review",
  "agency-viewer",
  "establishment-admin",
  "establishment-contact",
] as const;

export type ConventionRole = ExtractFromExisting<
  Role,
  | "beneficiary"
  | "beneficiary-current-employer"
  | "beneficiary-representative"
  | "establishment-representative"
  | "establishment-tutor"
  | "counsellor"
  | "validator"
>;

export const allSignatoryRoles = [
  "beneficiary",
  "beneficiary-representative",
  "beneficiary-current-employer",
  "establishment-representative",
] as const satisfies ReadonlyArray<
  Required<Signatories>[keyof Required<Signatories>]["role"]
>;

export const conventionActorRoles = [
  ...allSignatoryRoles,
  "establishment-tutor",
] as const;

export type ConventionActorRole = (typeof conventionActorRoles)[number];

export const conventionEstablishmentsRoles = [
  "establishment-representative",
  "establishment-tutor",
] as const;

export const agencyModifierRoles = ["counsellor", "validator"] as const;

export const allowedRolesToEditConventionWithFinalStatus = [
  ...agencyModifierRoles,
  "agency-admin",
  "establishment-representative",
  "back-office",
] as const;

export const allModifierRoles = [
  ...allSignatoryRoles,
  ...agencyModifierRoles,
  "back-office",
] as const;

export const allowedRolesToCreateAssessment = [
  "establishment-tutor",
  "validator",
  "counsellor",
] as const;

export const allowedRolesToAccessAssessment = [
  ...allowedRolesToCreateAssessment,
  "back-office",
  "establishment-representative",
  "establishment-admin",
  "establishment-contact",
  "beneficiary",
  "beneficiary-representative",
  "agency-admin",
  "agency-viewer",
] as const;

export const establishmentsRoles = [
  "establishment-admin",
  "establishment-contact",
] as const;

export type EstablishmentRole = (typeof establishmentsRoles)[number];

export type AgencyRole = (typeof allAgencyRoles)[number];
export const allAgencyRoles = [
  "counsellor",
  "validator",
  "agency-admin",
  "to-review",
  "agency-viewer",
] as const;

export const assessmentSignatureReminderAuthorizedRoles: Role[] = [
  "establishment-representative",
  "establishment-tutor",
  "establishment-admin",
  "establishment-contact",
  "counsellor",
  "validator",
  "agency-admin",
  "agency-viewer",
  "back-office",
] as const;

export type AssessmentSignatureReminderAuthorizedRole =
  (typeof assessmentSignatureReminderAuthorizedRoles)[number];
