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
  ActiveOtpSession,
  GetOtpSessionQueryParams,
  OtpSession,
  OtpSessionId,
} from "./otpSession.dto";

export const otpSessionIdSchema: ZodSchemaWithInputMatchingOutput<OtpSessionId> =
  zStringMinLength1Max255;

export const otpSessionSchema: ZodSchemaWithInputMatchingOutput<OtpSession> =
  z.object({
    id: otpSessionIdSchema,
    purpose: otpChallengePurposeSchema,
    subject: otpChallengeSubjectSchema,
    expiresAt: dateTimeIsoStringSchema,
    revokedAt: dateTimeIsoStringSchema.nullable(),
    createdAt: dateTimeIsoStringSchema,
  });

export const getOtpSessionQueryParamsSchema: ZodSchemaWithInputMatchingOutput<GetOtpSessionQueryParams> =
  z.discriminatedUnion("purpose", [
    z.object({
      purpose: z.literal("manageConvention"),
      conventionId: conventionIdSchema,
    }),
  ]);

export const activeOtpSessionSchema: ZodSchemaWithInputMatchingOutput<ActiveOtpSession> =
  z.discriminatedUnion("purpose", [
    z.object({
      purpose: z.literal("manageConvention"),
      conventionId: conventionIdSchema,
      role: conventionActorRoleSchema,
      expiresAt: dateTimeIsoStringSchema,
    }),
  ]);
