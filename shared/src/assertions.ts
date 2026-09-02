export type AssertNever<T> = [T] extends [never] ? true : never;
export type ExpectTrue<T extends true> = T;

export type ExtractAddedOrMissingKeys<
  K extends PropertyKey,
  Obj extends object,
  Ignore extends PropertyKey = never,
> =
  Exclude<Exclude<K, Ignore>, keyof Obj> extends never
    ? Exclude<Exclude<keyof Obj, Ignore>, K> extends never
      ? true
      : Exclude<Exclude<keyof Obj, Ignore>, K>
    : Exclude<Exclude<K, Ignore>, keyof Obj>;
