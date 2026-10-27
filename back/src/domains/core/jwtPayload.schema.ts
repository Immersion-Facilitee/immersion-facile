import {
  agencyModifierRoles,
  allSignatoryRoles,
  type ConventionRelatedJwtPayload,
  userIdSchema,
  type ZodSchemaWithInputMatchingOutput,
} from "shared";
import { z } from "zod";

export const conventionRelatedJwtPayloadSchema: ZodSchemaWithInputMatchingOutput<ConventionRelatedJwtPayload> =
  z.union([
    z.object({
      userId: userIdSchema,
      applicationId: z.never().optional(),
      emailAuthCode: z.never().optional(),
    }),
    z.object({
      applicationId: z.string().min(1),
      role: z.enum([
        ...allSignatoryRoles,
        ...agencyModifierRoles,
        "establishment-tutor",
      ]),
      emailHash: z.string().min(1),
      sub: z.string().optional(),
      userId: z.never().optional(),
      emailAuthCode: z.never().optional(),
    }),
  ]);

export const conventionSupportedJwtPayloadSchema =
  conventionRelatedJwtPayloadSchema.and(
    z.object({
      version: z.number(),
      iat: z.number().optional(),
      exp: z.number().optional(),
    }),
  );
