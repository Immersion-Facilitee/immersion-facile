import { z } from "zod";
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
} from "./convention.schema";
import type {
  ConventionsWithUnfinalizedAssessmentFilters,
  ConventionWithUnfinalizedAssessment,
  FlatGetConventionsWithUnfinalizedAssessmentParams,
  GetConventionsWithUnfinalizedAssessmentParams,
  UnfinalizedAssessmentCompletionStatus,
} from "./conventionWithUnfinalizedAssessment.dto";

export const conventionWithUnfinalizedAssessmentSchema: ZodSchemaWithInputMatchingOutput<ConventionWithUnfinalizedAssessment> =
  z.object({
    id: conventionIdSchema,
    dateEnd: makeDateStringSchema(),
    beneficiary: withFirstnameAndLastnameSchema,
    assessment: conventionAssessmentFieldsSchema,
  });

export const paginatedConventionWithUnfinalizedAssessmentSchema =
  createPaginatedSchema(conventionWithUnfinalizedAssessmentSchema);

export const unfinalizedAssessmentCompletionStatusSchema: ZodSchemaWithInputMatchingOutput<UnfinalizedAssessmentCompletionStatus> =
  z.enum(["to-complete", "to-sign"]);

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
