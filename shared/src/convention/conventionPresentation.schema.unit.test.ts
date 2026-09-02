import { reasonableSchedule } from "../schedule/ScheduleUtils";
import { expectToEqual } from "../test.helpers";
import { replaceEmptyValuesByUndefinedFromObject } from "../utils";
import { ConventionDtoBuilder } from "./ConventionDtoBuilder";
import type { ConventionDto, InternshipKind } from "./convention.dto";
import type {
  ConventionFormInitialValues,
  CreateConventionTemplatePresentationInitialValues,
} from "./conventionPresentation.dto";
import { makeConventionPresentationSchemaWithNormalizedInput } from "./conventionPresentation.schema";

const validConventionId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

describe("makeConventionPresentationSchemaWithNormalizedInput", () => {
  describe("when isTemplateForm is true", () => {
    const schema = makeConventionPresentationSchemaWithNormalizedInput({
      isTemplateForm: true,
    });

    it.each([
      {
        id: validConventionId,
        name: "Modèle immersion",
        internshipKind: "immersion",
      } satisfies CreateConventionTemplatePresentationInitialValues,
      {
        id: validConventionId,
        name: "Template avec département vide",
        internshipKind: "immersion" as InternshipKind,
        agencyDepartment: "",
      } satisfies CreateConventionTemplatePresentationInitialValues,
      {
        id: validConventionId,
        name: "Modèle mini-stage",
        internshipKind: "mini-stage-cci",
      } satisfies CreateConventionTemplatePresentationInitialValues,
      {
        id: validConventionId,
        name: "Modèle mini-stage",
        internshipKind: "mini-stage-cci",
        signatories: {
          beneficiary: {
            levelOfEducation: "3ème",
            schoolName: "Lycée Victor Hugo",
            schoolPostcode: "75000",
            address: {
              streetNumberAndAddress: "17 rue de la paix, 75000 Paris",
              postcode: "75000",
              departmentCode: "75",
              city: "Paris",
            },
          },
        },
      } satisfies CreateConventionTemplatePresentationInitialValues,
      {
        id: validConventionId,
        name: "Modèle mini-stage avec département vide",
        internshipKind: "mini-stage-cci" as InternshipKind,
        agencyDepartment: "",
        signatories: {
          beneficiary: { schoolName: "Lycée Victor Hugo" },
        },
      } satisfies CreateConventionTemplatePresentationInitialValues,
    ])(
      "accepts valid convention template",
      (conventionTemplate: CreateConventionTemplatePresentationInitialValues) => {
        expectToEqual(
          schema.parse(conventionTemplate),
          replaceEmptyValuesByUndefinedFromObject(conventionTemplate),
        );
      },
    );

    it.each([
      {
        id: validConventionId,
        name: "",
        internshipKind: "immersion" as InternshipKind,
        signatories: {
          beneficiary: { email: "beneficiary@test.com" },
        },
      },
      {
        id: "not-a-uuid",
        name: "Valid name",
        internshipKind: "immersion" as InternshipKind,
        signatories: {
          beneficiary: { email: "beneficiary@test.com" },
        },
      },
    ])("throws on invalid data", (conventionTemplate) => {
      expect(() => schema.parse(conventionTemplate)).toThrow();
    });
  });

  describe("when isTemplateForm is false", () => {
    const schema = makeConventionPresentationSchemaWithNormalizedInput({
      isTemplateForm: false,
    });

    const buildConventionInitialValuesFromConventionDto = (
      convention: ConventionDto,
    ): ConventionFormInitialValues => {
      return {
        ...convention,
        agencyDepartment: "",
      };
    };

    it.each([
      buildConventionInitialValuesFromConventionDto(
        new ConventionDtoBuilder()
          .withInternshipKind("immersion")
          .withBeneficiary({
            firstName: "benef",
            lastName: "beneficiary",
            email: "benef@r.com",
            phone: "+33112233445",
            role: "beneficiary",
            birthdate: "1990-02-21T00:00:00.000Z",
            emergencyContact: "Billy",
            emergencyContactPhone: "+33112233445",
            emergencyContactEmail: "billy@emergencycontact.com",
            signedAt: new Date().toISOString(),
            isRqth: false,
          })
          .build(),
      ),
      buildConventionInitialValuesFromConventionDto(
        new ConventionDtoBuilder()
          .withInternshipKind("mini-stage-cci")
          .withDateStart(new Date("2023-01-02").toISOString())
          .withDateEnd(new Date("2023-01-06").toISOString())
          .withSchedule(reasonableSchedule)
          .withBeneficiary({
            firstName: "benef",
            lastName: "beneficiary",
            email: "benef@r.com",
            phone: "+33112233445",
            role: "beneficiary",
            birthdate: "1990-02-21T00:00:00.000Z",
            emergencyContact: "Billy",
            emergencyContactPhone: "+33112233445",
            emergencyContactEmail: "billy@emergencycontact.com",
            signedAt: new Date().toISOString(),
            isRqth: false,
            levelOfEducation: "3ème",
            schoolName: "Lycée Victor Hugo",
            schoolPostcode: "75000",
            address: {
              streetNumberAndAddress: "17 rue de la paix, 75000 Paris",
              postcode: "75000",
              departmentCode: "75",
              city: "Paris",
            },
          })
          .build(),
      ),
    ])(
      "accepts valid convention form",
      (conventionForm: ConventionFormInitialValues) => {
        expectToEqual(schema.parse(conventionForm), conventionForm);
      },
    );

    it.each([
      buildConventionInitialValuesFromConventionDto(
        new ConventionDtoBuilder()
          .withInternshipKind("immersion")
          .withBeneficiary({
            firstName: "",
            lastName: "",
            email: "",
            phone: "",
            role: "beneficiary",
            birthdate: "",
            emergencyContact: "",
            emergencyContactPhone: "",
            emergencyContactEmail: "",
            isRqth: false,
          })
          .build(),
      ),
      buildConventionInitialValuesFromConventionDto(
        new ConventionDtoBuilder()
          .withInternshipKind("mini-stage-cci")
          .withDateStart(new Date("2023-01-02").toISOString())
          .withDateEnd(new Date("2023-01-06").toISOString())
          .withSchedule(reasonableSchedule)
          .withBeneficiary({
            firstName: "",
            lastName: "",
            email: "",
            phone: "",
            role: "beneficiary",
            birthdate: "",
            emergencyContact: "",
            emergencyContactPhone: "",
            emergencyContactEmail: "",
            isRqth: false,
            levelOfEducation: "3ème",
            schoolName: "",
            schoolPostcode: "",
            address: {
              streetNumberAndAddress: "",
              postcode: "",
              departmentCode: "",
              city: "",
            },
          })
          .build(),
      ),
    ])(
      "throws on invalid data",
      (conventionForm: ConventionFormInitialValues) => {
        expect(() => schema.parse(conventionForm)).toThrow();
      },
    );
  });
});
