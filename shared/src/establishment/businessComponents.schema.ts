import {
  zStringCanBeEmpty,
  zStringCanBeEmptyMax255,
  zStringMinLength1Max255,
} from "../utils/string.schema";
import type { ZodSchemaWithInputMatchingOutput } from "../zodUtils";
import type {
  BusinessAddress,
  BusinessName,
  BusinessNameCustomized,
} from "./establishment.dto";

export const businessAddressSchema: ZodSchemaWithInputMatchingOutput<BusinessAddress> =
  zStringCanBeEmpty;

export const businessCustomizedNameSchema: ZodSchemaWithInputMatchingOutput<BusinessNameCustomized> =
  zStringCanBeEmptyMax255;

export const businessNameSchema: ZodSchemaWithInputMatchingOutput<BusinessName> =
  zStringMinLength1Max255;
