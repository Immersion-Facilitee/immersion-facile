import { z } from "zod";
import type { DiscussionId } from "../discussion/discussion.dto";
import { discussionIdSchema } from "../discussion/discussion.schema";
import type { ZodSchemaWithInputMatchingOutput } from "../zodUtils";
import type { ConventionDto } from "./convention.dto";
import { conventionSchema } from "./convention.schema";
import {
  type ConventionDraftId,
  conventionDraftIdSchema,
} from "./conventionDraftId";

// those are put in a different file in purpose
// this is to avoid circular dependencies between convention.schema and discussion.schema

export type AddConventionInput = {
  convention: ConventionDto;
  fromConventionDraftId?: ConventionDraftId;
  discussionId?: DiscussionId;
};

export const addConventionInputSchema: ZodSchemaWithInputMatchingOutput<AddConventionInput> =
  z.object({
    convention: conventionSchema,
    fromConventionDraftId: conventionDraftIdSchema.optional(),
    discussionId: discussionIdSchema.optional(),
  });
