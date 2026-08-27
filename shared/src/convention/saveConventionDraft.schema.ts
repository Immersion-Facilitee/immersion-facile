import { z } from "zod";
import { agencyKindSchema } from "../agency/agency.schema";
import { emailSchema } from "../email/email.schema";
import { getNestedValue, isObject } from "../utils";
import { zStringMinLength1Max1024 } from "../utils/string.schema";
import type { ZodSchemaWithInputMatchingOutput } from "../zodUtils";
import {
  immersionConventionSchema,
  miniStageConventionSchema,
} from "./convention.schema";
import { conventionDraftIdSchema } from "./conventionDraftId";
import {
  type ConventionDraftDto,
  type SaveConventionDraftDto,
  type SaveConventionDraftFromConventionDto,
  type SaveConventionDraftFromConventionTemplateDto,
  saveConventionDraftModes,
} from "./saveConventionDraft.dto";

export const makeConventionDeepPartialSchema = (
  schema: z.ZodTypeAny,
): z.ZodTypeAny => {
  if (schema.def.type === "object") {
    const newShape: Record<string, z.ZodTypeAny> = {};
    for (const [key, value] of Object.entries(
      (schema as unknown as z.ZodObject<any>).shape,
    )) {
      newShape[key] = makeConventionDeepPartialSchema(
        value as z.ZodTypeAny,
      ).optional();
    }
    return z.object(newShape);
  }

  if (schema.def.type === "array") {
    return z.array(
      makeConventionDeepPartialSchema(
        (schema as unknown as z.ZodArray<any>).element,
      ),
    );
  }

  if (schema.def.type === "optional") {
    return makeConventionDeepPartialSchema(
      (schema as unknown as z.ZodOptional<any>).unwrap(),
    ).optional();
  }

  if (schema.def.type === "nullable") {
    return makeConventionDeepPartialSchema(
      (schema as unknown as z.ZodNullable<any>).unwrap(),
    ).nullable();
  }

  if (schema.def.type === "union") {
    const unionSchema = schema as unknown as z.ZodUnion<any>;
    return z.union(
      unionSchema.options.map((option: z.ZodTypeAny) =>
        makeConventionDeepPartialSchema(option),
      ),
    );
  }

  if (schema.def.type === "intersection") {
    const def = schema.def as unknown as {
      left: z.ZodTypeAny;
      right: z.ZodTypeAny;
    };
    return z.intersection(
      makeConventionDeepPartialSchema(def.left),
      makeConventionDeepPartialSchema(def.right),
    );
  }

  return schema;
};

const miniStageBeneficiaryFields = [
  "levelOfEducation",
  "schoolName",
  "schoolPostcode",
  "address",
] as const;

const validateImmersionBeneficiary = (input: unknown): void => {
  if (!isObject(input) || input.internshipKind !== "immersion") return;

  const beneficiary = getNestedValue(input, "signatories", "beneficiary");
  if (!isObject(beneficiary)) return;

  for (const field of miniStageBeneficiaryFields) {
    if (beneficiary[field] !== undefined) {
      throw new z.ZodError([
        {
          code: "custom",
          input: beneficiary[field],
          message: `${field} is not allowed for immersion conventions`,
          path: ["signatories", "beneficiary", field],
        },
      ]);
    }
  }
};

// DepartmentCode Schema ?
const agencyDepartmentSchema = z.string();

const baseConventionDraftSchema = makeConventionDeepPartialSchema(
  immersionConventionSchema,
)
  .or(makeConventionDeepPartialSchema(miniStageConventionSchema))
  .and(
    z.object({
      id: conventionDraftIdSchema,
      agencyKind: agencyKindSchema.optional(),
      agencyDepartment: agencyDepartmentSchema.optional(),
    }),
  );

export const conventionDraftSchema: ZodSchemaWithInputMatchingOutput<ConventionDraftDto> =
  z.preprocess((input) => {
    validateImmersionBeneficiary(input);
    return input;
  }, baseConventionDraftSchema) as unknown as ZodSchemaWithInputMatchingOutput<ConventionDraftDto>;

export const conventionDraftDetailSchema = zStringMinLength1Max1024;

export const saveConventionDraftFromConventionSchema: ZodSchemaWithInputMatchingOutput<SaveConventionDraftFromConventionDto> =
  z.object({
    senderEmail: emailSchema,
    recipientEmail: emailSchema.optional(),
    details: conventionDraftDetailSchema.optional(),
    conventionDraft: conventionDraftSchema,
    mode: z.enum(saveConventionDraftModes),
  });

export const saveConventionDraftFromConventionTemplateSchema: ZodSchemaWithInputMatchingOutput<SaveConventionDraftFromConventionTemplateDto> =
  z.object({
    recipientEmail: emailSchema,
    details: conventionDraftDetailSchema.optional(),
    conventionDraft: conventionDraftSchema,
    mode: z.enum(saveConventionDraftModes),
  });

export const saveConventionDraftSchema: ZodSchemaWithInputMatchingOutput<SaveConventionDraftDto> =
  saveConventionDraftFromConventionSchema
    .or(saveConventionDraftFromConventionTemplateSchema)
    .or(
      z
        .object({
          conventionDraft: conventionDraftSchema,
          mode: z.enum(saveConventionDraftModes),
        })
        .strict(),
    );
