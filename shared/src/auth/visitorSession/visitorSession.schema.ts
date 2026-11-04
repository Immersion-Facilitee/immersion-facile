import { z } from "zod";
import { dateTimeIsoStringSchema } from "../../utils/date";
import { zStringMinLength1Max255 } from "../../utils/string.schema";
import type { ZodSchemaWithInputMatchingOutput } from "../../zodUtils";
import {
  otpChallengePurposeSchema,
  otpChallengeSubjectSchema,
} from "../otpChallenge/otpChallenge.schema";
import type { VisitorSession } from "./visitorSession.dto";

export const visitorSessionSchema: ZodSchemaWithInputMatchingOutput<VisitorSession> =
  z.object({
    id: zStringMinLength1Max255,
    purpose: otpChallengePurposeSchema,
    subject: otpChallengeSubjectSchema,
    expiresAt: dateTimeIsoStringSchema,
    revokedAt: dateTimeIsoStringSchema.nullable(),
    createdAt: dateTimeIsoStringSchema,
  });
