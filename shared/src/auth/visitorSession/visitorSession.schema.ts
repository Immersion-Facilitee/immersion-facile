import { z } from "zod";
import { conventionIdSchema } from "../../convention/convention.schema";
import { conventionActorRoleSchema } from "../../role/role.schema";
import { dateTimeIsoStringSchema } from "../../utils/date";
import { zStringMinLength1Max255 } from "../../utils/string.schema";
import type { ZodSchemaWithInputMatchingOutput } from "../../zodUtils";
import {
  otpChallengePurposeSchema,
  otpChallengeSubjectSchema,
} from "../otpChallenge/otpChallenge.schema";
import type {
  ActiveVisitorSession,
  GetVisitorSessionQueryParams,
  VisitorSession,
  VisitorSessionId,
} from "./visitorSession.dto";

export const visitorSessionIdSchema: ZodSchemaWithInputMatchingOutput<VisitorSessionId> =
  zStringMinLength1Max255;

export const visitorSessionSchema: ZodSchemaWithInputMatchingOutput<VisitorSession> =
  z.object({
    id: visitorSessionIdSchema,
    purpose: otpChallengePurposeSchema,
    subject: otpChallengeSubjectSchema,
    expiresAt: dateTimeIsoStringSchema,
    revokedAt: dateTimeIsoStringSchema.nullable(),
    createdAt: dateTimeIsoStringSchema,
  });

export const getVisitorSessionQueryParamsSchema: ZodSchemaWithInputMatchingOutput<GetVisitorSessionQueryParams> =
  z.discriminatedUnion("purpose", [
    z.object({
      purpose: z.literal("manageConvention"),
      conventionId: conventionIdSchema,
    }),
  ]);

export const activeVisitorSessionSchema: ZodSchemaWithInputMatchingOutput<ActiveVisitorSession> =
  z.discriminatedUnion("purpose", [
    z.object({
      purpose: z.literal("manageConvention"),
      conventionId: conventionIdSchema,
      role: conventionActorRoleSchema,
      expiresAt: dateTimeIsoStringSchema,
    }),
  ]);
