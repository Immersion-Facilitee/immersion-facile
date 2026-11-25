import {
  type AgencyId,
  type AssessmentDto,
  agencyIdSchema,
  type ConventionId,
  type ConventionReadDto,
  conventionIdSchema,
} from "shared";
import { z } from "zod";

export type WithConventionIdAndPreviousAgencyId = {
  conventionId: ConventionId;
  previousAgencyId?: AgencyId;
};

export const withConventionIdAndPreviousAgencySchema = z.object({
  conventionId: conventionIdSchema,
  previousAgencyId: agencyIdSchema.optional(),
});

export type BroadcastConventionParams = {
  convention: ConventionReadDto;
  previousAgencyId?: AgencyId;
  assessment?: AssessmentDto;
};
