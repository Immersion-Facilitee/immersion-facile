import { z } from "zod";
import { agencyIdSchema } from "../agency/agency.schema";
import {
  createPaginatedSchema,
  paginationRequiredQueryParamsSchema,
} from "../pagination/pagination.schema";
import { makeDateStringSchema } from "../utils/date";
import type { ZodSchemaWithInputMatchingOutput } from "../zodUtils";
import { zToNumber } from "../zodUtils";
import {
  conventionAssessmentFieldsSchema,
  conventionIdSchema,
  withFirstnameAndLastnameSchema,
  withOptionalFirstnameAndLastnameSchema,
} from "./convention.schema";
import {
  type ConventionsWithUnfinalizedAssessmentFilters,
  type ConventionWithUnfinalizedAssessment,
  type ConventionWithUnfinalizedAssessmentReadDto,
  type FlatGetConventionsWithUnfinalizedAssessmentParams,
  type GetConventionsWithUnfinalizedAssessmentParams,
  type UnfinalizedAssessmentCompletionStatus,
  unfinalizedAssessmentCompletionStatuses,
} from "./conventionWithUnfinalizedAssessment.dto";

export const conventionWithUnfinalizedAssessmentSchema: ZodSchemaWithInputMatchingOutput<ConventionWithUnfinalizedAssessment> =
  z.object({
    id: conventionIdSchema,
    dateEnd: makeDateStringSchema(),
    beneficiary: withFirstnameAndLastnameSchema,
    assessment: conventionAssessmentFieldsSchema,
    agencyId: agencyIdSchema,
    agencyReferent: withOptionalFirstnameAndLastnameSchema.nullable(),
  });

export const conventionWithUnfinalizedAssessmentReadDtoSchema: ZodSchemaWithInputMatchingOutput<ConventionWithUnfinalizedAssessmentReadDto> =
  conventionWithUnfinalizedAssessmentSchema.and(
    z.object({
      agencyName: z.string(),
    }),
  );

export const paginatedConventionWithUnfinalizedAssessmentSchema =
  createPaginatedSchema(conventionWithUnfinalizedAssessmentReadDtoSchema);

export const unfinalizedAssessmentCompletionStatusSchema: ZodSchemaWithInputMatchingOutput<UnfinalizedAssessmentCompletionStatus> =
  z.enum(unfinalizedAssessmentCompletionStatuses);

export const getConventionsWithUnfinalizedAssessmentFilterSchema: ZodSchemaWithInputMatchingOutput<ConventionsWithUnfinalizedAssessmentFilters> =
  z.object({
    assessmentCompletionStatus:
      unfinalizedAssessmentCompletionStatusSchema.optional(),
  });

export const flatGetConventionsWithUnfinalizedAssessmentParamsSchema: ZodSchemaWithInputMatchingOutput<FlatGetConventionsWithUnfinalizedAssessmentParams> =
  z.object({
    page: zToNumber,
    perPage: zToNumber,
    assessmentCompletionStatus:
      unfinalizedAssessmentCompletionStatusSchema.optional(),
  });

export const getConventionsWithUnfinalizedAssessmentParamsSchema: ZodSchemaWithInputMatchingOutput<GetConventionsWithUnfinalizedAssessmentParams> =
  z.object({
    pagination: paginationRequiredQueryParamsSchema,
    filters: getConventionsWithUnfinalizedAssessmentFilterSchema.optional(),
  });
