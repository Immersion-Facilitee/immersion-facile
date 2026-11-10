import { keys } from "shared";
import type {
  FormConventionFieldsLabels,
  FormFieldKeys,
  FormFieldKeysWithoutUi,
} from "src/app/contents/forms/convention/formConvention";
import type { NumberOfSteps } from "src/core-logic/domain/convention/convention.slice";

export type ConventionEmailValidationRole =
  | "Bénéficiaire"
  | "Responsable d'entreprise"
  | "Tuteur de l'entreprise"
  | "Représentant légal du bénéficiaire"
  | "Employeur actuel du bénéficiaire";

export type ConventionErrorSummarySection = {
  step: NumberOfSteps;
  firstFieldId: string;
};

const emailFieldPathByRole: Record<
  ConventionEmailValidationRole,
  FormFieldKeys
> = {
  Bénéficiaire: "signatories.beneficiary.email",
  "Responsable d'entreprise": "signatories.establishmentRepresentative.email",
  "Tuteur de l'entreprise": "establishmentTutor.email",
  "Représentant légal du bénéficiaire":
    "signatories.beneficiaryRepresentative.email",
  "Employeur actuel du bénéficiaire":
    "signatories.beneficiaryCurrentEmployer.email",
};

const conventionFormSteps: NumberOfSteps[] = [1, 2, 3, 4, 5];

type FieldOutsideConventionSteps =
  | FormFieldKeysWithoutUi
  | "agencyRefersTo"
  | "name"
  | "signatories.beneficiary.federatedIdentity";

type ConventionStepField = Exclude<FormFieldKeys, FieldOutsideConventionSteps>;

const stepByFieldInDisplayOrder: Record<ConventionStepField, NumberOfSteps> = {
  agencyDepartment: 1,
  agencyKind: 1,
  agencyId: 1,
  "agencyReferent.firstname": 1,
  "agencyReferent.lastname": 1,

  "signatories.beneficiary.firstName": 2,
  "signatories.beneficiary.lastName": 2,
  "signatories.beneficiary.birthdate": 2,
  "signatories.beneficiary.email": 2,
  "signatories.beneficiary.phone": 2,
  "signatories.beneficiary.address": 2,
  "signatories.beneficiary.levelOfEducation": 2,
  "signatories.beneficiary.schoolName": 2,
  "signatories.beneficiary.schoolPostcode": 2,
  "signatories.beneficiary.financiaryHelp": 2,
  isMinor: 2,
  "signatories.beneficiaryRepresentative.firstName": 2,
  "signatories.beneficiaryRepresentative.lastName": 2,
  "signatories.beneficiaryRepresentative.email": 2,
  "signatories.beneficiaryRepresentative.phone": 2,
  "signatories.beneficiary.isRqth": 2,
  "signatories.beneficiary.emergencyContact": 2,
  "signatories.beneficiary.emergencyContactPhone": 2,
  "signatories.beneficiary.emergencyContactEmail": 2,
  isCurrentEmployer: 2,
  "signatories.beneficiaryCurrentEmployer.businessSiret": 2,
  "signatories.beneficiaryCurrentEmployer.businessName": 2,
  "signatories.beneficiaryCurrentEmployer.businessAddress": 2,
  "signatories.beneficiaryCurrentEmployer.firstName": 2,
  "signatories.beneficiaryCurrentEmployer.lastName": 2,
  "signatories.beneficiaryCurrentEmployer.job": 2,
  "signatories.beneficiaryCurrentEmployer.phone": 2,
  "signatories.beneficiaryCurrentEmployer.email": 2,

  siret: 3,
  businessName: 3,
  businessNameCustomized: 3,
  "signatories.establishmentRepresentative.firstName": 3,
  "signatories.establishmentRepresentative.lastName": 3,
  "signatories.establishmentRepresentative.phone": 3,
  "signatories.establishmentRepresentative.email": 3,
  isEstablishmentTutorIsEstablishmentRepresentative: 3,
  "establishmentTutor.firstName": 3,
  "establishmentTutor.lastName": 3,
  "establishmentTutor.phone": 3,
  "establishmentTutor.email": 3,
  "establishmentTutor.job": 3,

  remoteWorkMode: 4,
  immersionAddress: 4,
  dateStart: 4,
  dateEnd: 4,
  schedule: 4,

  individualProtection: 5,
  individualProtectionDescription: 5,
  sanitaryPrevention: 5,
  sanitaryPreventionDescription: 5,
  immersionObjective: 5,
  immersionAppellation: 5,
  workConditions: 5,
  businessAdvantages: 5,
  immersionActivities: 5,
  immersionSkills: 5,
};

const fieldsInDisplayOrder = keys(stepByFieldInDisplayOrder);

const fieldToFocus = (
  fieldInError: FormFieldKeys,
  canSelectAgency: boolean,
): FormFieldKeys => {
  if (fieldInError === "agencyId" && !canSelectAgency)
    return "agencyDepartment";
  if (fieldInError === "businessName") return "siret";
  return fieldInError;
};

const isSameOrNestedPath = (path: string, parentPath: string): boolean =>
  path === parentPath || path.startsWith(`${parentPath}.`);

export const makeConventionErrorSummary = ({
  errorPaths,
  rejectedEmailRoles,
  canSelectAgency,
  fieldsLabels,
}: {
  errorPaths: string[];
  rejectedEmailRoles: ConventionEmailValidationRole[];
  canSelectAgency: boolean;
  fieldsLabels: FormConventionFieldsLabels;
}): ConventionErrorSummarySection[] => {
  const pathsInError = [
    ...errorPaths,
    ...rejectedEmailRoles.map((role) => emailFieldPathByRole[role]),
  ];

  return conventionFormSteps.flatMap((step) => {
    const firstFieldInError = fieldsInDisplayOrder.find(
      (field) =>
        stepByFieldInDisplayOrder[field] === step &&
        pathsInError.some(
          (errorPath) =>
            isSameOrNestedPath(errorPath, field) ||
            isSameOrNestedPath(field, errorPath),
        ),
    );
    return firstFieldInError
      ? [
          {
            step,
            firstFieldId:
              fieldsLabels[fieldToFocus(firstFieldInError, canSelectAgency)].id,
          },
        ]
      : [];
  });
};
