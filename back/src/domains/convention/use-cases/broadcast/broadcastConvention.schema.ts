import {
  addressDepartmentCodeSchema,
  agencyIdSchema,
  agencyNameSchema,
  conventionIdSchema,
  emailSchema,
  immersionConventionSchema,
  miniStageConventionSchema,
  partnerAgencyKindSchema,
  siretSchema,
  withAssessmentStatusSchema,
  withBannedEstablishmentInformationSchema,
  withEndedWithAJobSchema,
  withEstablishmentCommentsSchema,
  type ZodSchemaWithInputMatchingOutput,
  zStringMinLength1Max1024,
} from "shared";
import { z } from "zod";
import type {
  BroadcastAgencyRefersTo,
  BroadcastAssessmentDto,
  BroadcastConventionAgencyFields,
  BroadcastConventionDto,
  BroadcastConventionField,
  BroadcastPayload,
} from "./broadcastConvention.dto";

const broadcastConventionFields: Record<BroadcastConventionField, true> = {
  id: true,
  status: true,
  statusJustification: true,
  agencyId: true,
  dateSubmission: true,
  dateStart: true,
  dateEnd: true,
  dateValidation: true,
  dateApproval: true,
  siret: true,
  businessName: true,
  schedule: true,
  workConditions: true,
  businessAdvantages: true,
  individualProtection: true,
  individualProtectionDescription: true,
  sanitaryPrevention: true,
  sanitaryPreventionDescription: true,
  immersionAddress: true,
  immersionObjective: true,
  immersionAppellation: true,
  immersionActivities: true,
  immersionSkills: true,
  establishmentNumberEmployeesRange: true,
  establishmentTutor: true,
  validators: true,
  agencyReferent: true,
  renewed: true,
  internshipKind: true,
  signatories: true,
} as const;

const broadcastAgencyRefersToSchema: ZodSchemaWithInputMatchingOutput<BroadcastAgencyRefersTo> =
  z.object({
    id: agencyIdSchema,
    name: agencyNameSchema,
    kind: partnerAgencyKindSchema,
    siret: siretSchema,
    codeSafir: zStringMinLength1Max1024.or(z.null()),
  });

const broadcastConventionAgencyFieldsSchema: ZodSchemaWithInputMatchingOutput<BroadcastConventionAgencyFields> =
  z.object({
    agencyName: agencyNameSchema,
    agencyDepartment: addressDepartmentCodeSchema,
    agencyKind: partnerAgencyKindSchema,
    agencySiret: siretSchema,
    agencyCodeSafir: zStringMinLength1Max1024.or(z.null()),
    agencyValidatorEmails: z.array(emailSchema),
    agencyRefersTo: broadcastAgencyRefersToSchema.optional(),
  });

export const broadcastConventionDtoSchema: ZodSchemaWithInputMatchingOutput<BroadcastConventionDto> =
  z
    .discriminatedUnion("internshipKind", [
      immersionConventionSchema.pick(broadcastConventionFields),
      miniStageConventionSchema.pick(broadcastConventionFields),
    ])
    .and(broadcastConventionAgencyFieldsSchema)
    .and(withBannedEstablishmentInformationSchema);

export const broadcastAssessmentDtoSchema: ZodSchemaWithInputMatchingOutput<BroadcastAssessmentDto> =
  z
    .object({
      conventionId: conventionIdSchema,
    })
    .and(withAssessmentStatusSchema)
    .and(withEstablishmentCommentsSchema)
    .and(withEndedWithAJobSchema);

export const broadcastPayloadSchema: ZodSchemaWithInputMatchingOutput<BroadcastPayload> =
  z.object({
    convention: broadcastConventionDtoSchema,
    assessment: broadcastAssessmentDtoSchema.optional(),
  });
