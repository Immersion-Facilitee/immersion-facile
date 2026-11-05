import { z } from "zod";
import { conventionIdSchema } from "../../convention/convention.schema";
import { emailSchema } from "../../email/email.schema";
import { notificationKindSchema } from "../../notifications/notifications.schema";
import { phoneNumberSchema } from "../../phone/phone.schema";
import { conventionActorRoleSchema } from "../../role/role.schema";
import { dateTimeIsoStringSchema } from "../../utils/date";
import {
  makeHardenedStringSchema,
  zStringMinLength1Max255,
} from "../../utils/string.schema";
import type { ZodSchemaWithInputMatchingOutput } from "../../zodUtils";
import {
  type ManageConventionSubject,
  type MaskedOtpRecipients,
  type OtpChallenge,
  type OtpChallengeId,
  type OtpChallengePurpose,
  type OtpCode,
  otpChallengePurposes,
  type RequestOtpChallengeDto,
  type RequestOtpChallengeResponseDto,
  type VerifyOtpChallengeParams,
} from "./otpChallenge.dto";

export const otpChallengePurposeSchema: ZodSchemaWithInputMatchingOutput<OtpChallengePurpose> =
  z.enum(otpChallengePurposes);

const manageConventionSubjectSchema: ZodSchemaWithInputMatchingOutput<ManageConventionSubject> =
  z.object({
    conventionId: conventionIdSchema,
    role: conventionActorRoleSchema,
    emailHash: z.string(),
  });

export const otpChallengeSubjectSchema: ZodSchemaWithInputMatchingOutput<
  OtpChallenge["subject"]
> = manageConventionSubjectSchema;

export const otpChallengeIdSchema: ZodSchemaWithInputMatchingOutput<OtpChallengeId> =
  zStringMinLength1Max255;

export const otpChallengeSchema: ZodSchemaWithInputMatchingOutput<OtpChallenge> =
  z.object({
    id: otpChallengeIdSchema,
    purpose: otpChallengePurposeSchema,
    subject: otpChallengeSubjectSchema,
    channel: notificationKindSchema,
    recipient: emailSchema.or(phoneNumberSchema),
    codeHash: zStringMinLength1Max255,
    attempts: z.number().min(0),
    expiresAt: dateTimeIsoStringSchema,
    usedAt: dateTimeIsoStringSchema.nullable(),
    revokedAt: dateTimeIsoStringSchema.nullable(),
    createdAt: dateTimeIsoStringSchema,
  });

export const maskedOtpRecipientsSchema: ZodSchemaWithInputMatchingOutput<MaskedOtpRecipients> =
  z.object({
    maskedEmail: zStringMinLength1Max255,
    maskedPhone: zStringMinLength1Max255.nullable(),
  });

export const requestOtpChallengeSchema: ZodSchemaWithInputMatchingOutput<RequestOtpChallengeDto> =
  z.object({
    channel: notificationKindSchema,
  });

export const requestOtpChallengeResponseSchema: ZodSchemaWithInputMatchingOutput<RequestOtpChallengeResponseDto> =
  z.object({
    otpChallengeId: otpChallengeIdSchema,
  });

export const otpCodeSchema: ZodSchemaWithInputMatchingOutput<OtpCode> =
  makeHardenedStringSchema({
    min: 6,
    max: 6,
    withRegExp: {
      regex: /^\d{6}$/,
      message: "Le code doit contenir 6 chiffres",
    },
  });

export const verifyOtpChallengeSchema: ZodSchemaWithInputMatchingOutput<
  Pick<VerifyOtpChallengeParams, "otpCode">
> = z.object({
  otpCode: otpCodeSchema,
});

export const verifyOtpChallengeParamsSchema: ZodSchemaWithInputMatchingOutput<VerifyOtpChallengeParams> =
  z.object({
    otpChallengeId: otpChallengeIdSchema,
    otpCode: otpCodeSchema,
  });
