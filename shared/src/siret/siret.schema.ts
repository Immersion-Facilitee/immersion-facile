import { z } from "zod";
import {
  businessAddressSchema,
  businessCustomizedNameSchema,
  businessNameSchema,
} from "../establishment/businessComponents.schema";
import { nafSchema } from "../naf/naf.schema";
import { removeSpaces } from "../utils/string";
import {
  MAX_1024_TEXT_INPUT,
  makeHardenedStringSchema,
} from "../utils/string.schema";
import {
  localization,
  type ZodSchemaWithInputMatchingOutput,
  zBoolean,
} from "../zodUtils";
import {
  type GetSiretEstablishmentDtoResponse,
  type GetSiretRequestDto,
  type NumberEmployeesRange,
  numberEmployeesRanges,
  type SiretDto,
  type SiretEstablishmentDto,
  siretInfoErrors,
  siretRegex,
  type WithSiretDto,
} from "./siret";

export const numberOfEmployeesRangeSchema: ZodSchemaWithInputMatchingOutput<NumberEmployeesRange> =
  z.enum(numberEmployeesRanges, {
    error: localization.invalidEnum,
  });

export const siretSchema: ZodSchemaWithInputMatchingOutput<SiretDto> =
  makeHardenedStringSchema({
    max: MAX_1024_TEXT_INPUT, // 14 ?
    withRegExp: { regex: siretRegex, message: localization.invalidSiret },
  }).transform(removeSpaces);

export const withSiretSchema: ZodSchemaWithInputMatchingOutput<WithSiretDto> =
  z.object({
    siret: siretSchema,
  });

const getSiretResponseSchema: ZodSchemaWithInputMatchingOutput<SiretEstablishmentDto> =
  z.object({
    siret: siretSchema,
    businessName: businessNameSchema,
    businessNameCustomized: businessCustomizedNameSchema.optional(),
    businessAddress: businessAddressSchema,
    isOpen: z.boolean(), // true if the office is currently open for business.
    isAlreadySaved: zBoolean,
    nafDto: nafSchema.optional(),
    numberEmployeesRange: z.enum(numberEmployeesRanges, {
      error: localization.invalidEnum,
    }),
  });

export const getSiretInfoSchema: ZodSchemaWithInputMatchingOutput<GetSiretEstablishmentDtoResponse> =
  z.union([
    getSiretResponseSchema,
    z.enum(siretInfoErrors, {
      error: localization.invalidEnum,
    }),
  ]);
export const isSiretExistResponseSchema: ZodSchemaWithInputMatchingOutput<boolean> =
  z.boolean();
export const getSiretRequestSchema: ZodSchemaWithInputMatchingOutput<GetSiretRequestDto> =
  z.object({
    siret: siretSchema,
    includeClosedEstablishments: z.boolean().optional(),
  });
