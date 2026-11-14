import {
  type InternshipKind,
  makeConventionPresentationSchemaWithNormalizedInput,
  makeEmptyConventionInitialValues,
} from "shared";
import { makeFormUiSections } from "src/app/contents/forms/convention/formConvention";
import type { NumberOfSteps } from "src/core-logic/domain/convention/convention.slice";
import {
  type ConventionEmailValidationRole,
  makeConventionStepsInError,
} from "./errorSummarySections";

const formUiSections = makeFormUiSections({
  internshipKind: "immersion",
  isConventionTemplate: false,
});

const stepsInError = ({
  errorPaths = [],
  rejectedEmailRoles = [],
}: {
  errorPaths?: string[];
  rejectedEmailRoles?: ConventionEmailValidationRole[];
}) =>
  makeConventionStepsInError({
    errorPaths,
    rejectedEmailRoles,
    formUiSections,
  });

const errorPathsFromEmptyConvention = (
  internshipKind: InternshipKind,
): string[] => {
  const parsed = makeConventionPresentationSchemaWithNormalizedInput({
    isTemplateForm: false,
  }).safeParse(makeEmptyConventionInitialValues({ internshipKind }));
  if (parsed.success) throw new Error("An empty convention form is invalid");

  return parsed.error.issues.map((issue) => issue.path.join("."));
};

describe("makeConventionStepsInError", () => {
  it.each<InternshipKind>(["immersion", "mini-stage-cci"])(
    "returns the five steps for an empty %s form",
    (internshipKind) => {
      expect(
        stepsInError({
          errorPaths: errorPathsFromEmptyConvention(internshipKind),
        }),
      ).toEqual([1, 2, 3, 4, 5]);
    },
  );

  it("returns only the step that has an error", () => {
    expect(
      stepsInError({ errorPaths: ["immersionActivities", "immersionSkills"] }),
    ).toEqual([5]);
  });

  it("returns no step when nothing is in error", () => {
    expect(stepsInError({})).toEqual([]);
  });

  it.each<{
    role: ConventionEmailValidationRole;
    step: NumberOfSteps;
  }>([
    { role: "Bénéficiaire", step: 2 },
    { role: "Responsable d'entreprise", step: 3 },
    { role: "Tuteur de l'entreprise", step: 3 },
    { role: "Représentant légal du bénéficiaire", step: 2 },
    { role: "Employeur actuel du bénéficiaire", step: 2 },
  ])("keeps a rejected $role email in step $step", ({ role, step }) => {
    expect(stepsInError({ rejectedEmailRoles: [role] })).toEqual([step]);
  });

  it("returns the step of a field nested in an error on a whole object", () => {
    expect(
      stepsInError({ errorPaths: ["signatories.beneficiaryRepresentative"] }),
    ).toEqual([2]);
  });

  it("returns the step of a field whose nested value is in error", () => {
    expect(
      stepsInError({
        errorPaths: ["signatories.beneficiary.address.postcode"],
      }),
    ).toEqual([2]);
  });
});
