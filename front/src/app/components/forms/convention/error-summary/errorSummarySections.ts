import type { FormFieldKeys } from "src/app/contents/forms/convention/formConvention";
import type { NumberOfSteps } from "src/core-logic/domain/convention/convention.slice";
import type { ConventionEmailValidationRole } from "../ConventionForm";

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

const isSameOrNestedPath = (path: string, parentPath: string): boolean =>
  path === parentPath || path.startsWith(`${parentPath}.`);

export const makeConventionStepsInError = ({
  errorPaths,
  rejectedEmailRoles,
  formUiSections,
}: {
  errorPaths: string[];
  rejectedEmailRoles: ConventionEmailValidationRole[];
  formUiSections: FormFieldKeys[][];
}): NumberOfSteps[] => {
  const pathsInError = [
    ...errorPaths,
    ...rejectedEmailRoles.map((role) => emailFieldPathByRole[role]),
  ];

  return conventionFormSteps.filter((step) =>
    (formUiSections[step - 1] ?? []).some((field) =>
      pathsInError.some(
        (errorPath) =>
          isSameOrNestedPath(errorPath, field) ||
          isSameOrNestedPath(field, errorPath),
      ),
    ),
  );
};
