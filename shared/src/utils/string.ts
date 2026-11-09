import { Parser } from "htmlparser2";
import { values } from "ramda";
import { errors } from "../errors/errors";

export const capitalize = (str: string): string =>
  str && str.length > 0 ? str[0].toUpperCase() + str.slice(1) : str;

export const joinWithCommasAnd = (items: string[]): string => {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} et ${items[1]}`;
  return `${items.slice(0, -1).join(", ")} et ${items.at(-1)}`;
};

export const cleanStringToHTMLAttribute = (
  string: string,
  prefix: string | number | null = null,
  suffix: string | number | null = null,
) => {
  const cleanedString = string
    .normalize("NFD")
    .toLowerCase()
    .replace(/[^\w .-]/g, "")
    .replace(/\s\s+/g, " ")
    .trim()
    .replaceAll(/[ .]/g, "-");
  let result = cleanedString;
  if (prefix) {
    result = `${prefix}-${cleanedString}`;
  }
  if (suffix) {
    result += `-${suffix}`;
  }
  return result.replaceAll(":", "");
};

export const removeDiacritics = (str: string) =>
  str.normalize("NFD").replace(/\p{Diacritic}/gu, "");

export const toLowerCaseWithoutDiacritics = (str: string): string =>
  removeDiacritics(str).toLowerCase();

export const slugify = (str: string) =>
  toLowerCaseWithoutDiacritics(str)
    .trim()
    .replace(/[()]/g, "")
    .replace(/\W/g, "-");

export const looksLikeSiret = (input: string) => {
  const cleanedInput = removeSpaces(input);
  const siretRegex = /^\d{14}$/;
  return siretRegex.test(cleanedInput);
};

export const removeSpaces = (str: string) => str.replace(/\s/g, "");

export const isStringEmpty = (str: string) =>
  str !== "" && str.trim().length === 0;

export const doesStringContainsHTML = (possiblyHtmlString: string) => {
  let hasOpenTag = false;
  let hasComment = false;

  const parser = new Parser(
    {
      onopentag: () => {
        hasOpenTag = true;
      },
      oncomment: () => {
        hasComment = true;
      },
    },
    { decodeEntities: true },
  );
  parser.write(possiblyHtmlString);
  parser.end();

  return hasOpenTag || hasComment;
};

export const doesObjectContainsHTML = (obj: object): boolean => {
  const browseObjectProps = (hasHtml: boolean, value: unknown): boolean => {
    if (hasHtml) return true;
    if (typeof value === "string") return doesStringContainsHTML(value);
    if (typeof value === "object" && value !== null) {
      return values(value).reduce(browseObjectProps, false);
    }
    return false;
  };
  return values(obj).reduce(browseObjectProps, false);
};

export const getFormattedFirstnameAndLastname = ({
  firstname,
  lastname,
}: {
  firstname?: string;
  lastname?: string;
}): string => {
  const formattedFirstName = firstname
    ?.toLowerCase()
    .split(/([\s-])/g)
    .map((word) => capitalize(word))
    .join("");

  return [formattedFirstName, lastname?.toUpperCase()]
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
};

export const escapeHtml = (unsafe: string) =>
  unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

export const splitTextOnFirstSeparator = (
  text: string,
  separators: (string | RegExp)[],
): [string, ...string[]] => {
  const separator = separators.find((separator) => text.match(separator));
  return separator
    ? [text.split(separator)[0], text.split(separator)[1]]
    : [text];
};

export function cleanSpecialChars(input: string): string {
  const replacements: Record<string, string> = {
    "’": "'",
    "‘": "'",
    "“": '"',
    "”": '"',
    "–": "-",
    "—": "-",
    "…": "...",
    "\u00A0": " ",
  };

  const cleaned = Object.entries(replacements).reduce(
    (acc, [from, to]) => acc.replace(new RegExp(from, "g"), to),
    input,
  );

  return removeDiacritics(cleaned);
}

export const parseStringToJsonOrThrow = <T>(
  raw: string,
  paramName: string,
): T => {
  try {
    return JSON.parse(raw);
  } catch (_error) {
    throw errors.routeParams.malformedJson({ paramName });
  }
};

export const sliceTextUpToBytesLimit = (
  text: string,
  MAX_BYTES: number,
): string => {
  const textBytesEncoded = new TextEncoder().encode(text);
  return textBytesEncoded.length > MAX_BYTES
    ? new TextDecoder("utf-8")
        .decode(textBytesEncoded.slice(0, MAX_BYTES))
        .replace(/\uFFFD/g, "")
    : text;
};
