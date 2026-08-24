import { mapObjIndexed } from "ramda";

export const getUrlParameters: (location: Location) => {
  [k: string]: string;
} = (location) =>
  Object.fromEntries(new URLSearchParams(location.search).entries());

export const filterParamsForRoute = <T>({
  urlParams,
  matchingParams,
  forceExcludeParams,
}: {
  urlParams: T extends Record<string, unknown> ? T : Record<string, unknown>;
  matchingParams: Record<string, unknown>;
  forceExcludeParams?: string[];
}) =>
  Object.fromEntries(
    Object.entries(urlParams).filter(
      ([key]) =>
        isKeyInObjectAndValueNotUndefinedNorEmpty(key, matchingParams) &&
        !forceExcludeParams?.includes(key),
    ),
  );

const replaceNewLineInValueBySlash = (value: unknown) =>
  typeof value === "string" ? value.replace(/(?:\r?\n|\r)+/g, " / ") : value;

export const cleanParamsValues = (obj: Record<string, unknown>) =>
  mapObjIndexed(replaceNewLineInValueBySlash, obj);

export const isKeyInObjectAndValueNotUndefinedNorEmpty = <
  T extends object,
  K extends keyof T,
>(
  key: K,
  values: T,
): values is T & Record<K, NonNullable<T[K]>> =>
  key in values && !isValueUndefinedOrEmpty(values[key]);

export const isValueUndefinedOrEmpty = (value: unknown) =>
  value === undefined || value === "";
