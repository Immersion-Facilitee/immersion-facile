import { z } from "zod";
import type { ConventionReadDto } from "../convention/convention.dto";
import { conventionIdSchema } from "../convention/convention.schema";
import { errors } from "../errors/errors";
import { calculateTotalImmersionHoursBetweenDateComplex } from "../schedule/ScheduleUtils";
import { dateTimeIsoStringSchema, makeDateStringSchema } from "../utils/date";
import {
  zStringMinLength1Max1024,
  zStringMinLength1Max3000,
  zStringMinLength1Max6000,
  zStringMinLength1Max9200,
} from "../utils/string.schema";
import {
  localization,
  type ZodSchemaWithInputMatchingOutput,
  zEnumValidation,
} from "../zodUtils";
import {
  type AssessmentDto,
  type AssessmentFormDto,
  type DeleteAssessmentRequestDto,
  type LegacyAssessmentDto,
  type PartiallyCompletedAssessmentDetails,
  type SignAssessmentRequestDto,
  typeOfContracts,
  type WithAssessmentDto,
  type WithEndedWithAJob,
  type WithEstablishmentComments,
} from "./assessment.dto";
import {
  getAssessmentEffectiveEndDate,
  hasPartialCompletionDetails,
} from "./assessment.helpers";

const withAssessmentStatusSchema = z.discriminatedUnion(
  "status",
  [
    z.object({
      status: z.enum(["COMPLETED", "DID_NOT_SHOW"], {
        error: localization.invalidEnum,
      }),
    }),
    z.object({
      status: z.literal("PARTIALLY_COMPLETED"),
      lastDayOfPresence: makeDateStringSchema(),
      numberOfMissedHours: z.number(),
    }),
  ],
  {
    error: (error) => {
      if (error.code === "invalid_union")
        return {
          message: "Veuillez selectionner une option",
        };

      return { message: error.message ?? "no message provided" };
    },
  },
);

const withEstablishmentCommentsSchema: ZodSchemaWithInputMatchingOutput<WithEstablishmentComments> =
  z.object({
    establishmentFeedback: zStringMinLength1Max9200,
    establishmentAdvices: zStringMinLength1Max6000,
  });

const withEndedWithAJobSchema: ZodSchemaWithInputMatchingOutput<WithEndedWithAJob> =
  z.discriminatedUnion(
    "endedWithAJob",
    [
      z.object({
        endedWithAJob: z.literal(true),
        typeOfContract: zEnumValidation(typeOfContracts, localization.required),
        contractStartDate: makeDateStringSchema(),
      }),
      z.object({
        endedWithAJob: z.literal(false),
      }),
    ],
    { error: "Veuillez sélectionnez une option" },
  );

export const assessmentDtoSchema: ZodSchemaWithInputMatchingOutput<AssessmentDto> =
  z
    .object({
      conventionId: z.string(),
    })
    .and(withAssessmentStatusSchema)
    .and(withEstablishmentCommentsSchema)
    .and(withEndedWithAJobSchema)
    .and(
      z.object({
        beneficiaryAgreement: z.boolean().nullable(),
        beneficiaryFeedback: zStringMinLength1Max3000.nullable(),
        signedAt: makeDateStringSchema().nullable(),
        createdAt: dateTimeIsoStringSchema,
      }),
    );

const partialCompletionDetailsFormValuesSchema: ZodSchemaWithInputMatchingOutput<PartiallyCompletedAssessmentDetails> =
  z.object({
    lastDayOfPresence: makeDateStringSchema().nullable(),
    numberOfMissedHours: z.number().nullable(),
    numberOfMissedMinutes: z.number().nullable(),
  });

const assessmentFormStatusSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("COMPLETED"),
  }),
  z.object({
    status: z.literal("DID_NOT_SHOW"),
  }),
  z.object({
    status: z.literal("PARTIALLY_COMPLETED"),
    partialCompletionDetails: partialCompletionDetailsFormValuesSchema,
  }),
]);

const assessmentFormValuesBaseSchema: ZodSchemaWithInputMatchingOutput<AssessmentFormDto> =
  z
    .object({
      conventionId: z.string(),
      endedWithAJob: z.boolean().nullable(),
      typeOfContract: zEnumValidation(
        typeOfContracts,
        localization.required,
      ).nullable(),
      contractStartDate: makeDateStringSchema().nullable(),
      establishmentFeedback: zStringMinLength1Max9200,
      establishmentAdvices: zStringMinLength1Max6000,
    })
    .and(
      z.union([
        z.object({
          status: z.null(),
        }),
        assessmentFormStatusSchema,
      ]),
    );

const toFormMissedHours = ({
  numberOfMissedHours,
  numberOfMissedMinutes,
}: PartiallyCompletedAssessmentDetails): number =>
  (numberOfMissedHours ?? 0) + (numberOfMissedMinutes ?? 0) / 60;

export const assessmentFormSchema = (
  convention: ConventionReadDto,
): ZodSchemaWithInputMatchingOutput<AssessmentFormDto> =>
  assessmentFormValuesBaseSchema
    .superRefine((formValues, ctx) => {
      if (formValues.status === null)
        ctx.addIssue({
          code: "custom",
          message: localization.expectRadioButtonSelected,
          path: ["status"],
        });
    })
    .superRefine((formValues, ctx) => {
      if (formValues.status !== "PARTIALLY_COMPLETED") return;

      if (!hasPartialCompletionDetails(formValues.partialCompletionDetails))
        ctx.addIssue({
          code: "custom",
          message: errors.assessment.partialCompletionDetailsRequired().message,
          path: ["partialCompletionDetails"],
        });
    })
    .superRefine((formValues, ctx) => {
      if (formValues.status !== "PARTIALLY_COMPLETED") return;

      const missedHours = toFormMissedHours(
        formValues.partialCompletionDetails,
      );
      const effectiveEndDate = getAssessmentEffectiveEndDate({
        lastDayOfPresence:
          formValues.partialCompletionDetails.lastDayOfPresence,
        conventionDateEnd: convention.dateEnd,
      });
      const scheduledHoursInPresencePeriod =
        calculateTotalImmersionHoursBetweenDateComplex({
          complexSchedule: convention.schedule.complexSchedule,
          dateStart: convention.dateStart,
          dateEnd: effectiveEndDate,
        });

      if (missedHours > scheduledHoursInPresencePeriod)
        ctx.addIssue({
          code: "custom",
          message:
            errors.assessment.numberOfMissedHoursExceedsScheduled().message,
          path: ["partialCompletionDetails", "numberOfMissedHours"],
        });
    })
    .superRefine((formValues, ctx) => {
      if (formValues.endedWithAJob === null)
        ctx.addIssue({
          code: "custom",
          message: localization.expectRadioButtonSelected,
          path: ["endedWithAJob"],
        });

      if (formValues.endedWithAJob !== true) return;

      if (formValues.typeOfContract === null)
        ctx.addIssue({
          code: "custom",
          message: localization.required,
          path: ["typeOfContract"],
        });

      if (formValues.contractStartDate === null)
        ctx.addIssue({
          code: "custom",
          message: localization.required,
          path: ["contractStartDate"],
        });

      if (
        formValues.contractStartDate !== null &&
        convention.dateStart > formValues.contractStartDate
      )
        ctx.addIssue({
          code: "custom",
          message: errors.assessment.contractStartDateBeforeImmersionStart({
            immersionDateStart: convention.dateStart,
          }).message,
          path: ["contractStartDate"],
        });
    });

export const withAssessmentSchema: ZodSchemaWithInputMatchingOutput<WithAssessmentDto> =
  z.object({
    assessment: assessmentDtoSchema,
  });

export const legacyAssessmentDtoSchema: ZodSchemaWithInputMatchingOutput<LegacyAssessmentDto> =
  z.object({
    status: z.enum(["FINISHED", "ABANDONED"], {
      error: localization.invalidEnum,
    }),
    conventionId: z.string(),
    establishmentFeedback: zStringMinLength1Max9200,
    createdAt: dateTimeIsoStringSchema,
  });

export const deleteAssessmentRequestDtoSchema: ZodSchemaWithInputMatchingOutput<DeleteAssessmentRequestDto> =
  z.object({
    conventionId: conventionIdSchema,
    deleteAssessmentJustification: zStringMinLength1Max1024,
  });

export const signAssessmentRequestDtoSchema: ZodSchemaWithInputMatchingOutput<SignAssessmentRequestDto> =
  z
    .object({
      conventionId: conventionIdSchema,
    })
    .and(
      z.discriminatedUnion("beneficiaryAgreement", [
        z.object({
          beneficiaryAgreement: z.literal(true),
          beneficiaryFeedback: zStringMinLength1Max3000.nullable(),
        }),
        z.object({
          beneficiaryAgreement: z.literal(false),
          beneficiaryFeedback: zStringMinLength1Max3000,
        }),
      ]),
    );
