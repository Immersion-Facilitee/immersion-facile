import { z } from "zod";
import type { ZodSchemaWithInputMatchingOutput } from "./zodUtils";

export type WithAuthorizationHeader = { authorization: string };
export type WithOptionalAuthorizationHeader = { authorization?: string };

const withAuthorizationSchema: ZodSchemaWithInputMatchingOutput<WithAuthorizationHeader> =
  z.looseObject({
    authorization: z.string(),
  });

const withOptionalAuthorizationSchema: ZodSchemaWithInputMatchingOutput<WithOptionalAuthorizationHeader> =
  z.looseObject({
    authorization: z.string().optional(),
  });

export const withValidateHeadersAuthorization = {
  validateHeaders: (headers: unknown) => withAuthorizationSchema.parse(headers),
};

export const withAuthorizationHeaders = {
  headersSchema: withAuthorizationSchema,
};

export const withOptionalAuthorizationHeaders = {
  headersSchema: withOptionalAuthorizationSchema,
};
