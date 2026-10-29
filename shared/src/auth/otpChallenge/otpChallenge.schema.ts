import { z } from "zod";
import { conventionIdSchema } from "../../convention/convention.schema";
import { emailSchema } from "../../email/email.schema";
import { phoneNumberSchema } from "../../phone/phone.schema";
import { conventionActorRoleSchema } from "../../role/role.schema";
import { dateTimeIsoStringSchema } from "../../utils/date";
import { zStringMinLength1Max255 } from "../../utils/string.schema";
import type { ZodSchemaWithInputMatchingOutput } from "../../zodUtils";
import type {
  ManageConventionSubject,
  OtpChallenge,
  OtpChallengePurpose,
} from "./otpChallenge.dto";

const OtpChallengePurposeSchema: ZodSchemaWithInputMatchingOutput<OtpChallengePurpose> =
  z.enum(["manageConvention"]);

const manageConventionSubjectSchema: ZodSchemaWithInputMatchingOutput<ManageConventionSubject> =
  z.object({
    conventionId: conventionIdSchema,
    role: conventionActorRoleSchema,
    emailHash: z.string(),
  });

const OtpChallengeSubjectSchema: ZodSchemaWithInputMatchingOutput<
  OtpChallenge["subject"]
> = manageConventionSubjectSchema;

export const otpChallengeSchema: ZodSchemaWithInputMatchingOutput<OtpChallenge> =
  z.object({
    id: zStringMinLength1Max255,
    purpose: OtpChallengePurposeSchema,
    subject: OtpChallengeSubjectSchema,
    channel: z.enum(["email", "sms"]),
    recipient: emailSchema.or(phoneNumberSchema),
    codeHash: zStringMinLength1Max255,
    attempts: z.number().min(0),
    expiresAt: dateTimeIsoStringSchema,
    usedAt: dateTimeIsoStringSchema.nullable(),
    createdAt: dateTimeIsoStringSchema,
  });
