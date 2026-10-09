import { z } from "zod";
import { absoluteUrlSchema } from "../AbsoluteUrl";
import { internalOfferSchema } from "../search/Offer.schema";
import {
  zStringCanBeEmpty,
  zStringMinLength1Max1024,
} from "../utils/string.schema";
import type { ZodSchemaWithInputMatchingOutput } from "../zodUtils";
import type {
  Group,
  GroupOptions,
  GroupSlug,
  GroupWithResults,
  WithGroupSlug,
} from "./group.dto";

export const groupSlugSchema: ZodSchemaWithInputMatchingOutput<GroupSlug> =
  zStringMinLength1Max1024;

export const withGroupSlugSchema: ZodSchemaWithInputMatchingOutput<WithGroupSlug> =
  z.object({
    groupSlug: groupSlugSchema,
  });

const backgroundColorSchema = zStringCanBeEmpty; // 1024 max - voir si on peut faire plus petit

const groupOptionsSchema: ZodSchemaWithInputMatchingOutput<GroupOptions> =
  z.object({
    heroHeader: z.object({
      title: zStringMinLength1Max1024,
      description: zStringMinLength1Max1024,
      logoUrl: absoluteUrlSchema.optional(),
      backgroundColor: backgroundColorSchema.optional(),
    }),
  });

export const groupSchema: ZodSchemaWithInputMatchingOutput<Group> = z.object({
  slug: groupSlugSchema,
  name: zStringMinLength1Max1024,
  options: groupOptionsSchema,
});

export const groupWithResultsSchema: ZodSchemaWithInputMatchingOutput<GroupWithResults> =
  z.object({
    group: groupSchema,
    results: z.array(internalOfferSchema),
  });
