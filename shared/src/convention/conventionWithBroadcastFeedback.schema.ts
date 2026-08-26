import z from "zod";
import { agencyIdSchema } from "../agency/agency.schema";
import { broadcastFeedbackSchema } from "../broadcast/broadcastFeedback.schema";
import {
  createPaginatedSchema,
  paginationRequiredQueryParamsSchema,
} from "../pagination/pagination.schema";
import { searchTextAlphaNumericSchema } from "../search/searchText.schema";
import { zStringCanBeEmpty } from "../utils/string.schema";
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
  ConventionWithBroadcastFeedbackReadDto,
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
    agencyId: agencyIdSchema,
  });

export const conventionWithBroadcastFeedbackSchemaDto: ZodSchemaWithInputMatchingOutput<ConventionWithBroadcastFeedbackReadDto> =
  conventionWithBroadcastFeedbackSchema.and(
    z.object({
      agencyName: z.string(),
    }),
  );

export const paginatedConventionWithBroadcastFeedbackSchema =
  createPaginatedSchema(conventionWithBroadcastFeedbackSchemaDto);

export const broadcastErrorKindSchema: ZodSchemaWithInputMatchingOutput<BroadcastErrorKind> =
  z.enum(["functional", "technical"]);

export const getConventionsWithErroredBroadcastFeedbackFilterSchema: ZodSchemaWithInputMatchingOutput<ConventionsWithErroredBroadcastFeedbackFilters> =
  z.object({
    broadcastErrorKind: broadcastErrorKindSchema.optional(),
    conventionStatus: z.tuple([statusSchema], statusSchema).optional(),
    search: zStringCanBeEmpty.optional(),
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
