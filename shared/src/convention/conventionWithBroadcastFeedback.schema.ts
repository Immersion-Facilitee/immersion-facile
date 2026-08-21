import z from "zod";
import { broadcastFeedbackSchema } from "../broadcast/broadcastFeedback.schema";
import {
  createPaginatedSchema,
  paginationRequiredQueryParamsSchema,
} from "../pagination/pagination.schema";
import { searchTextAlphaNumericSchema } from "../search/searchText.schema";
import type { ZodSchemaWithInputMatchingOutput } from "../zodUtils";
import { zToNumber } from "../zodUtils";
import {
  conventionIdSchema,
  statusSchema,
  withFirstnameAndLastnameSchema,
  withOptionalFirstnameAndLastnameSchema,
} from "./convention.schema";
import type {
  BroadcastErrorKind,
  ConventionsWithErroredBroadcastFeedbackFilters,
  ConventionWithBroadcastFeedback,
  FlatGetConventionsWithErroredBroadcastFeedbackParams,
  GetConventionsWithErroredBroadcastFeedbackParams,
} from "./conventionWithBroadcastFeedback.dto";

export const conventionWithBroadcastFeedbackSchema: ZodSchemaWithInputMatchingOutput<ConventionWithBroadcastFeedback> =
  z.object({
    id: conventionIdSchema,
    beneficiary: withFirstnameAndLastnameSchema,
    status: statusSchema,
    lastBroadcastFeedback: broadcastFeedbackSchema,
    agencyReferent: withOptionalFirstnameAndLastnameSchema.nullable(),
  });

export const paginatedConventionWithBroadcastFeedbackSchema =
  createPaginatedSchema(conventionWithBroadcastFeedbackSchema);

export const broadcastErrorKindSchema: ZodSchemaWithInputMatchingOutput<BroadcastErrorKind> =
  z.enum(["functional", "technical"]);

export const getConventionsWithErroredBroadcastFeedbackFilterSchema: ZodSchemaWithInputMatchingOutput<ConventionsWithErroredBroadcastFeedbackFilters> =
  z.object({
    broadcastErrorKind: broadcastErrorKindSchema.optional(),
    conventionStatus: z.tuple([statusSchema], statusSchema).optional(),
    search: z.string().optional(),
  });

export const flatGetConventionsWithErroredBroadcastFeedbackParamsSchema: ZodSchemaWithInputMatchingOutput<FlatGetConventionsWithErroredBroadcastFeedbackParams> =
  z.object({
    page: zToNumber,
    perPage: zToNumber,
    broadcastErrorKind: broadcastErrorKindSchema.optional(),
    conventionStatus: z.tuple([statusSchema], statusSchema).optional(),
    search: searchTextAlphaNumericSchema.optional(),
  });

export const getConventionsWithErroredBroadcastFeedbackParamsSchema: ZodSchemaWithInputMatchingOutput<GetConventionsWithErroredBroadcastFeedbackParams> =
  z.object({
    pagination: paginationRequiredQueryParamsSchema,
    filters: getConventionsWithErroredBroadcastFeedbackFilterSchema.optional(),
  });
