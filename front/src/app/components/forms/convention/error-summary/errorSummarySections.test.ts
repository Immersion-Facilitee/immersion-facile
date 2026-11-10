import {
  domElementIds,
  type InternshipKind,
  makeConventionPresentationSchemaWithNormalizedInput,
  makeEmptyConventionInitialValues,
} from "shared";
import { formConventionFieldsLabels } from "src/app/contents/forms/convention/formConvention";
import type { NumberOfSteps } from "src/core-logic/domain/convention/convention.slice";
import {
  type ConventionEmailValidationRole,
  makeConventionErrorSummary,
} from "./errorSummarySections";

const conventionImmersionIds = domElementIds.conventionImmersion;

const summarize = ({
  errorPaths = [],
  rejectedEmailRoles = [],
  canSelectAgency = false,
}: {
  errorPaths?: string[];
  rejectedEmailRoles?: ConventionEmailValidationRole[];
  canSelectAgency?: boolean;
}) =>
  makeConventionErrorSummary({
    errorPaths,
    rejectedEmailRoles,
    canSelectAgency,
    fieldsLabels: formConventionFieldsLabels({
      internshipKind: "immersion",
      isConventionTemplate: false,
    }),
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

describe("makeConventionErrorSummary", () => {
  it("groups an empty form into the five sections", () => {
    expect(
      summarize({ errorPaths: errorPathsFromEmptyConvention("immersion") }),
    ).toEqual([
      {
        step: 1,
        firstFieldId: conventionImmersionIds.conventionSection.agencyDepartment,
      },
      {
        step: 2,
        firstFieldId: conventionImmersionIds.beneficiarySection.firstName,
      },
      { step: 3, firstFieldId: conventionImmersionIds.conventionSection.siret },
      {
        step: 4,
        firstFieldId: conventionImmersionIds.conventionSection.remoteWorkMode,
      },
      {
        step: 5,
        firstFieldId:
          conventionImmersionIds.conventionSection.individualProtection,
      },
    ]);
  });

  it("returns only the section that has an error", () => {
    expect(
      summarize({ errorPaths: ["immersionActivities", "immersionSkills"] }),
    ).toEqual([
      {
        step: 5,
        firstFieldId:
          conventionImmersionIds.conventionSection.immersionActivities,
      },
    ]);
  });

  it.each<{
    role: ConventionEmailValidationRole;
    step: NumberOfSteps;
    firstFieldId: string;
  }>([
    {
      role: "Bénéficiaire",
      step: 2,
      firstFieldId: conventionImmersionIds.beneficiarySection.email,
    },
    {
      role: "Responsable d'entreprise",
      step: 3,
      firstFieldId:
        conventionImmersionIds.establishmentRepresentativeSection.email,
    },
    {
      role: "Tuteur de l'entreprise",
      step: 3,
      firstFieldId: conventionImmersionIds.establishmentTutorSection.email,
    },
    {
      role: "Représentant légal du bénéficiaire",
      step: 2,
      firstFieldId:
        conventionImmersionIds.beneficiaryRepresentativeSection.email,
    },
    {
      role: "Employeur actuel du bénéficiaire",
      step: 2,
      firstFieldId:
        conventionImmersionIds.beneficiaryCurrentEmployerSection.email,
    },
  ])(
    "keeps a rejected $role email in that role's section",
    ({ role, step, firstFieldId }) => {
      expect(summarize({ rejectedEmailRoles: [role] })).toEqual([
        { step, firstFieldId },
      ]);
    },
  );

  it("targets the department when no agency can be selected", () => {
    expect(summarize({ errorPaths: ["agencyId"] })).toEqual([
      {
        step: 1,
        firstFieldId: conventionImmersionIds.conventionSection.agencyDepartment,
      },
    ]);
  });

  it("targets the agency selector when an agency can be selected", () => {
    expect(
      summarize({
        errorPaths: ["agencyId"],
        canSelectAgency: true,
      }),
    ).toEqual([
      {
        step: 1,
        firstFieldId: conventionImmersionIds.conventionSection.agencyId,
      },
    ]);
  });

  it("targets the first representative field when the error is on the whole beneficiary representative", () => {
    expect(
      summarize({ errorPaths: ["signatories.beneficiaryRepresentative"] }),
    ).toEqual([
      {
        step: 2,
        firstFieldId:
          conventionImmersionIds.beneficiaryRepresentativeSection.firstName,
      },
    ]);
  });

  it("targets the siret when the disabled business name is in error", () => {
    expect(summarize({ errorPaths: ["businessName"] })).toEqual([
      { step: 3, firstFieldId: conventionImmersionIds.conventionSection.siret },
    ]);
  });
});
