import {
  agencyValidationSteps,
  assessmentStatuses,
  conventionLastRemindersSchema,
  conventionSchema,
  dateTimeIsoStringSchema,
  emailSchema,
  legacyAssessmentStatuses,
  makeDateStringSchema,
  partnerAgencyKindSchema,
  siretSchema,
  withBannedEstablishmentInformationSchema,
  type ZodSchemaWithInputMatchingOutput,
} from "shared";
import { z } from "zod";
import type { ConventionReadPublicV2Dto } from "./ConventionReadPublicV2.dto";

export const conventionReadPublicV2Schema: ZodSchemaWithInputMatchingOutput<ConventionReadPublicV2Dto> =
  conventionSchema
    .and(
      z.object({
        agencyName: z.string(),
        agencyDepartment: z.string(),
        agencyKind: partnerAgencyKindSchema,
        agencyContactEmail: emailSchema,
        agencySiret: siretSchema,
        agencyValidationSteps: z.enum(agencyValidationSteps),
        agencyRefersTo: z
          .object({
            id: z.string(),
            name: z.string(),
            contactEmail: emailSchema,
            kind: partnerAgencyKindSchema,
            siret: siretSchema,
          })
          .optional(),
        assessment: z
          .union([
            z.object({
              status: z.enum(assessmentStatuses),
              endedWithAJob: z.boolean(),
              signedAt: makeDateStringSchema().nullable(),
              createdAt: dateTimeIsoStringSchema,
            }),
            z.object({
              status: z.enum(legacyAssessmentStatuses),
              createdAt: dateTimeIsoStringSchema,
            }),
          ])
          .nullable(),
        lastReminders: conventionLastRemindersSchema,
      }),
    )
    .and(withBannedEstablishmentInformationSchema);

export const conventionReadPublicListV2Schema: ZodSchemaWithInputMatchingOutput<
  ConventionReadPublicV2Dto[]
> = z.array(conventionReadPublicV2Schema);
