// Details: https://www.pole-emploi.fr/employeur/vos-recrutements/le-rome-et-les-fiches-metiers.html
import { z } from "zod";
import { searchTextAlphaSchema } from "../search/searchText.schema";
import { zStringMinLength1Max1024 } from "../utils/string.schema";
import {
  localization,
  trueSchema,
  type ZodSchemaWithInputMatchingOutput,
} from "../zodUtils";
import type {
  AppellationAndRomeDto,
  AppellationCode,
  AppellationLabel,
  AppellationSearchInputParams,
  AppellationSearchResponse,
  RomeCode,
  RomeLabel,
} from "./romeAndAppellation.dto";

const codeRomeRegex = /^[A-N]\d{4}$/;
export const codeRomeSchema: ZodSchemaWithInputMatchingOutput<RomeCode> = z
  .string()
  .regex(codeRomeRegex, "Code ROME incorrect");

export const romeLabelSchema: ZodSchemaWithInputMatchingOutput<RomeLabel> =
  zStringMinLength1Max1024;

const codeAppellationRegex = /^\d{5}\d?$/; // 5 or 6 digits
export const appellationCodeSchema: ZodSchemaWithInputMatchingOutput<AppellationCode> =
  z
    .string({
      error: localization.required,
    })
    .regex(codeAppellationRegex, "Code appellation incorrect");

export const appellationCodeSchemaOptional: ZodSchemaWithInputMatchingOutput<
  AppellationCode | undefined
> = z.union([appellationCodeSchema, z.undefined()]);

export const appellationCodesSchema: ZodSchemaWithInputMatchingOutput<
  AppellationCode[]
> = z.array(appellationCodeSchema);

export const appellationLabelSchema: ZodSchemaWithInputMatchingOutput<AppellationLabel> =
  zStringMinLength1Max1024;

export const appellationAndRomeDtoSchema: ZodSchemaWithInputMatchingOutput<AppellationAndRomeDto> =
  z.object(
    {
      romeCode: codeRomeSchema,
      romeLabel: romeLabelSchema,
      appellationCode: appellationCodeSchema,
      appellationLabel: appellationLabelSchema,
    },
    { error: "Ce champ est obligatoire. Veuillez choisir un métier." },
  );

export const appellationSearchResponseSchema: ZodSchemaWithInputMatchingOutput<AppellationSearchResponse> =
  z.array(appellationAndRomeDtoSchema, {
    error: "Veuillez saisir un métier",
  });

export const appellationSearchInputParamsSchema: ZodSchemaWithInputMatchingOutput<AppellationSearchInputParams> =
  z.object({
    searchText: searchTextAlphaSchema,
    fetchAppellationsFromNaturalLanguage: trueSchema.optional(),
  });
