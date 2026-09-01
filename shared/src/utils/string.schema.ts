import z from "zod";
import { pipeWithValue } from "../pipeWithValue";
import {
  localization,
  type ZodSchemaWithInputMatchingOutput,
} from "../zodUtils";
import { doesStringContainsHTML } from "./string";

export type HardenedStringSchema = ReturnType<typeof makeHardenedStringSchema>;

export const makeHardenedStringSchema = ({
  min,
  minMessage = localization.required,
  max,
  maxMessage = localization.maxCharacters(max),
  isEmptyAllowed,
  withRegExp,
}: {
  min?: number;
  max: number;
  minMessage?: string;
  maxMessage?: string;
  isEmptyAllowed?: true;
  withRegExp?: { regex: RegExp; message?: string };
}) =>
  pipeWithValue(
    z.string({ error: localization.required }).trim(),
    (schema) =>
      withRegExp ? schema.regex(withRegExp.regex, withRegExp.message) : schema,
    (schema) =>
      schema
        .max(max, maxMessage)
        .min(min ?? (isEmptyAllowed ? 0 : 1), minMessage)
        .refine((input) => !doesStringContainsHTML(normalizer(input)), {
          message: localization.invalidTextContainHtml,
        }),
  );

const MAX_8_TEXT_INPUT = 8;
const MAX_255_TEXT_INPUT = 255;
const MAX_800_TEXT_INPUT = 800;
export const MAX_1024_TEXT_INPUT = 1024;
const MAX_1800_TEXT_INPUT = 1800;
const MAX_3000_TEXT_INPUT = 3000;
const MAX_6000_TEXT_INPUT = 6000;
const MAX_9200_TEXT_INPUT = 9200;
const MAX_11000_TEXT_INPUT = 11000;
export const MAX_HTML_SIZE = 700_000;

export const optionalEmptyStringMax1024 = makeHardenedStringSchema({
  isEmptyAllowed: true,
  max: MAX_1024_TEXT_INPUT,
}).optional();

export const zStringMinLength1Max8 = makeHardenedStringSchema({
  max: MAX_8_TEXT_INPUT,
});
export const zStringMinLength1Max255 = makeHardenedStringSchema({
  max: MAX_255_TEXT_INPUT,
});
export const zStringMinLength1Max800 = makeHardenedStringSchema({
  max: MAX_800_TEXT_INPUT,
});
export const zStringMinLength1Max1024 = makeHardenedStringSchema({
  max: MAX_1024_TEXT_INPUT,
});
export const zStringMinLength1Max3000 = makeHardenedStringSchema({
  max: MAX_3000_TEXT_INPUT,
});
export const zStringMinLength1Max6000 = makeHardenedStringSchema({
  max: MAX_6000_TEXT_INPUT,
});
export const zStringMinLength1Max9200 = makeHardenedStringSchema({
  max: MAX_9200_TEXT_INPUT,
});
export const zStringMinLength1Max11000 = makeHardenedStringSchema({
  max: MAX_11000_TEXT_INPUT,
});

export const zStringCanBeEmpty = makeHardenedStringSchema({
  isEmptyAllowed: true,
  max: MAX_1024_TEXT_INPUT,
});
export const zStringCanBeEmptyMax255 = makeHardenedStringSchema({
  isEmptyAllowed: true,
  max: MAX_255_TEXT_INPUT,
});
export const zStringCanBeEmptyMax1800 = makeHardenedStringSchema({
  isEmptyAllowed: true,
  max: MAX_1800_TEXT_INPUT,
});
export const zStringCanBeEmptyMax3000 = makeHardenedStringSchema({
  isEmptyAllowed: true,
  max: MAX_3000_TEXT_INPUT,
});
export const zStringCanBeEmptyMax6000 = makeHardenedStringSchema({
  isEmptyAllowed: true,
  max: MAX_6000_TEXT_INPUT,
});
export const zStringCanBeEmptyMax9200 = makeHardenedStringSchema({
  isEmptyAllowed: true,
  max: MAX_9200_TEXT_INPUT,
});

export const makezTrimmedString = (minMessage: string) =>
  makeHardenedStringSchema({ minMessage, max: MAX_255_TEXT_INPUT });

export const zStringPossiblyEmptyWithMax = (
  max: number,
): ZodSchemaWithInputMatchingOutput<string> =>
  makeHardenedStringSchema({ max, isEmptyAllowed: true });

export const zTrimmedStringWithMax = (max: number, maxMessage?: string) =>
  makeHardenedStringSchema({ max, maxMessage });

export const stringWithMaxLength255 = makeHardenedStringSchema({
  max: MAX_255_TEXT_INPUT,
});

const timeHHmmRegExp = /^(0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$/;

export const zTimeString = makeHardenedStringSchema({
  max: 16,
  withRegExp: {
    regex: timeHHmmRegExp,
    message: localization.invalidTimeFormat,
  },
});

const normalizer = (input: string) =>
  decodeEntities(input)
    .normalize("NFKC")
    .replace(/\0/g, "")
    .replace(/[\u200B-\u200D\uFEFF\u2060\u180E]/g, "")
    // biome-ignore lint/suspicious/noControlCharactersInRegex: normalize control whitespace (newline protocol splitting)
    .replace(/[\u0000-\u001F\u007F]+/g, "")
    .replace(/(j\s*a\s*v\s*a\s*s\s*c\s*r\s*i\s*p\s*t)\s*:/gi, "javascript:")
    .replace(/[\u202A-\u202E\u2066-\u2069\u200B-\u200F\uFEFF]/g, "");

const decodeEntities = (input: string): string =>
  input.replace(/&(#x?[0-9a-f]+|\w+);?/gi, (subString, entity: string) => {
    if (entity[0] === "#") {
      const code =
        entity[1].toLowerCase() === "x"
          ? Number.parseInt(entity.slice(2), 16)
          : Number.parseInt(entity.slice(1), 10);

      return !Number.isNaN(code) ? String.fromCharCode(code) : subString;
    }

    const HTML_ENTITIES: Record<string, string> = {
      lt: "<",
      gt: ">",
      amp: "&",
      quot: '"',
      apos: "'",
    };

    return HTML_ENTITIES[entity] ?? subString;
  });
