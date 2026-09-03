// TODO: find the standard for gouv.fr phone verification
import { values } from "ramda";
import type { Flavor } from "./typeFlavors";

export type SleepFn = typeof sleep;

// sleep function is use to simulate latency for demo and dev purpose
export const sleep = (ms: number): Promise<void> =>
  new Promise((resolve: (args: void) => void) => {
    setTimeout(resolve, ms);
  });

export const cancellableSleep = (ms: number) => {
  let timeout: NodeJS.Timeout;

  return {
    promise: new Promise((resolve: (args: void) => void) => {
      timeout = setTimeout(resolve, ms);
    }),
    cancel: () => clearTimeout(timeout),
  };
};

export type RandomFn = typeof random;
export const random = (max: number): number => Math.floor(Math.random() * max);

export const removeAtIndex = <T>(array: T[], indexToRemove: number): T[] => [
  ...array.slice(0, indexToRemove),
  ...array.slice(indexToRemove + 1),
];

export const replaceAtIndex = <T>(
  array: T[],
  indexToReplace: number,
  replaceBy: T,
): T[] => [
  ...array.slice(0, indexToReplace),
  replaceBy,
  ...array.slice(indexToReplace + 1),
];

export const executeInSequence = async <I, O>(
  array: I[],
  cb: (t: I) => Promise<O>,
): Promise<O[]> => {
  const output: O[] = [];
  for (const element of array) {
    output.push(await cb(element));
  }
  return output;
};

export type TypeFromTuple<T extends unknown[]> = T[number];

export type NotEmptyArray<T> = [T, ...T[]];

export const isNotEmptyArray = <T>(array: T[]): array is NotEmptyArray<T> =>
  array.length > 0;

export type ExcludeFromExisting<T extends string, K extends T> = Exclude<T, K>;

export type ExtractFromExisting<T, K extends T> = Extract<T, K>;

export type OmitFromExistingKeys<
  T extends Record<string, unknown>,
  K extends keyof T,
> = Omit<T, K>;

// https://stackoverflow.com/questions/49401866/all-possible-keys-of-an-union-type
export type KeysOfUnion<T> = T extends T ? keyof T : never;

export type ReplaceTypeAtKey<O, K extends keyof O, T> = Omit<O, K> & {
  [k in K]: T;
};

export type RequireField<T, K extends keyof T> = T & Required<Pick<T, K>>;

export const keys = <T extends string | number | symbol>(
  obj: Partial<Record<T, unknown>>,
): T[] => Object.keys(obj) as T[];

type Falsy = false | 0 | "" | null | undefined;
export const filterNotFalsy = <T>(arg: T | Falsy): arg is T => !!arg;

export const removeEmptyValue = <T>(unfilteredList: (T | null)[]): T[] =>
  unfilteredList.flatMap((element) => (element ? [element] : []));

export const replaceArrayElement = <T>(
  original: Array<T>,
  replaceAt: number,
  replaceBy: T,
) => [
  ...original.slice(0, replaceAt),
  replaceBy,
  ...original.slice(replaceAt + 1),
];

/*
 * replaces the first element that matches the predicate
 */
export const replaceElementWhere = <T>(
  original: T[],
  replaceBy: T,
  predicate: (t: T) => boolean,
): T[] => {
  const indexToReplace = original.findIndex(predicate);
  return replaceArrayElement(original, indexToReplace, replaceBy);
};

export const exhaustiveCheck = (
  shouldBeNever: never,
  options: { variableName?: string; throwIfReached: boolean },
): never => {
  const unexpectedDataAsString = JSON.stringify({
    ...(options.variableName ? { variableName: options.variableName } : {}),
    value: shouldBeNever,
  });
  const errorMessage = `Should not have been reached, but was reached with : ${unexpectedDataAsString}`;

  console.error(errorMessage);

  if (options.throwIfReached) throw new Error(errorMessage);
  return shouldBeNever;
};

export const splitInChunks = <T>(
  originalArray: T[],
  sizeOfChunk: number,
): Array<T[]> =>
  originalArray
    .reduce(
      (acc, element) => {
        const [currentChunk = [], ...rest] = acc;
        return currentChunk.length < sizeOfChunk
          ? [[...currentChunk, element], ...rest]
          : [[element], currentChunk, ...rest];
      },
      [] as Array<T[]>,
    )
    .reverse();

export type ValueOf<T> = T[keyof T];

type DotPrefix<T extends string> = T extends "" ? "" : `.${T}`;

export type DotNestedKeys<T> = (
  T extends object
    ? T extends Flavor<string | number, unknown>
      ? ""
      : T extends Array<infer U>
        ? `${number}${DotPrefix<DotNestedKeys<U>>}`
        : {
            [K in Exclude<keyof T, symbol>]:
              | K
              | `${K}${DotPrefix<DotNestedKeys<T[K]>>}`;
          }[Exclude<keyof T, symbol>]
    : ""
) extends infer D
  ? Extract<D, string>
  : never;

export const getNestedValue = (
  obj: Record<string, unknown>,
  ...keys: string[]
): unknown =>
  keys.reduce<unknown>((acc, key) => isObject(acc) && acc[key], obj);

export const calculateDurationInSecondsFrom = (start: Date): number => {
  const end = new Date();
  return (end.getTime() - start.getTime()) / 1000;
};

export type Prettify<T> = {
  [K in keyof T]: T[K];
} & {
  //
};

export type Only<T, U> = {
  [P in keyof T]: T[P];
} & {
  [P in keyof U]?: never;
};

export type Either<T, U> = Only<T, U> | Only<U, T>;

export const objectToDependencyList = <T extends Record<string, unknown>>(
  object: T,
): Primitive[] => {
  const objectValues = values(object) as Primitive[];
  return objectValues.reduce(
    (acc, value) =>
      typeof value === "object"
        ? [...acc, JSON.stringify(value)] // Stringify to avoid array length difference
        : [...acc, value],
    [] as Primitive[],
  );
};

type Primitive = string | boolean | number | undefined | null;

export const arrayFromNumber = (n: number): number[] =>
  n > 0 ? Array.from(Array(n).keys()) : [];

export const isUrlValid = (url: string | undefined) => {
  if (!url) return false;
  try {
    const validUrl = new URL(url);
    return validUrl.protocol === "http:" || validUrl.protocol === "https:";
  } catch (_error) {
    return false;
  }
};

export const castError = (error: unknown): Error =>
  error instanceof Error ? error : new Error(JSON.stringify(error));

type Filter = <T>(predicate: (element: T) => boolean) => (array: T[]) => T[];

export const filter: Filter = (predicate) => (array) => array.filter(predicate);

// biome-ignore lint/complexity/noBannedTypes: <explanation>
export type EmptyObject = {};

export type RangeOfPosition<
  N extends number,
  Result extends Array<unknown> = [],
> = Result["length"] extends N
  ? Result["length"]
  :
      | (Result["length"] extends 0 ? never : Result["length"])
      | RangeOfPosition<N, [unknown, ...Result]>;
export const populatePropIfDefined = <T>(prop: keyof T, value: ValueOf<T>) =>
  value !== undefined ? { [prop]: value } : {};

export const optional = <T>(v: T | null): NonNullable<T> | undefined =>
  v ?? undefined;

export const isFunction = <T>(
  value: unknown,
): value is (...args: unknown[]) => T => typeof value === "function";

export const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

export const replaceEmptyValuesByUndefinedFromObject = <T>(obj: T): T => {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === "string") return (obj === "" ? undefined : obj) as T;
  if (Array.isArray(obj))
    return obj.map(replaceEmptyValuesByUndefinedFromObject) as T;
  if (typeof obj === "object") {
    return Object.fromEntries(
      Object.entries(obj).map(([key, value]) => [
        key,
        replaceEmptyValuesByUndefinedFromObject(value),
      ]),
    ) as T;
  }
  return obj;
};
