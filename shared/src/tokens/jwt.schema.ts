import z from "zod";
import type { RenewExpiredJwtResponse } from "../convention/convention.dto";
import {
  makeHardenedStringSchema,
  zStringMinLength1Max1024,
} from "../utils/string.schema";
import { zUuidLike } from "../utils/uuid";
import type { ZodSchemaWithInputMatchingOutput } from "../zodUtils";
import {
  expiredJwtErrorMessage,
  type RenewExpiredJwtRequestDto,
  unsupportedMagicLinkErrorMessage,
} from "./jwt.dto";

const expiredJwtSchema = makeHardenedStringSchema({ max: 1000 });

export const renewExpiredJwtRequestSchema: ZodSchemaWithInputMatchingOutput<RenewExpiredJwtRequestDto> =
  z.discriminatedUnion("kind", [
    z.object({
      kind: z.literal("convention"),
      // respect legacy + limite max à 1024
      // TODO : utiliser absoluteUrlSchema << ne supporte pas encodeURIComponent
      originalUrl: zStringMinLength1Max1024,
      expiredJwt: expiredJwtSchema,
    }),
    z.object({
      kind: z.literal("conventionFromShortLink"),
      shortLinkId: z.string(),
      expiredJwt: z.string(),
    }),
    z.object({
      kind: z.literal("connectedUser"),
      expiredJwt: expiredJwtSchema,
    }),
    z.object({
      kind: z.literal("emailAuthCode"),
      expiredJwt: expiredJwtSchema,
      state: zUuidLike,
    }),
    z.object({
      kind: z.literal("otp"),
      expiredJwt: expiredJwtSchema,
    }),
  ]);

export const renewExpiredJwtResponseSchema: ZodSchemaWithInputMatchingOutput<RenewExpiredJwtResponse> =
  z.object({
    message: z
      .literal(expiredJwtErrorMessage)
      .or(z.literal(unsupportedMagicLinkErrorMessage)),
    needsNewMagicLink: z.boolean(),
  });
