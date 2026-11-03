// eslint-disable @typescript-eslint/ban-types
export function pipeWithValue<A>(a: A): A;
// biome-ignore format: better readability without formatting
export function pipeWithValue<A, B>(a: A, ab: (a: A) => B): B;
// biome-ignore format: better readability without formatting
export function pipeWithValue<A, B, C>(
  a: A,
  ab: (a: A) => B,
  bc: (b: B) => C,
): C;
// biome-ignore format: better readability without formatting
export function pipeWithValue<A, B, C, D>(
  a: A,
  ab: (a: A) => B,
  bc: (b: B) => C,
  cd: (c: C) => D,
): D;
// biome-ignore format: better readability without formatting
export function pipeWithValue<A, B, C, D, E>(
  a: A,
  ab: (a: A) => B,
  bc: (b: B) => C,
  cd: (c: C) => D,
  de: (d: D) => E,
): E;
// biome-ignore format: better readability without formatting
export function pipeWithValue<A, B, C, D, E, F>(
  a: A,
  ab: (a: A) => B,
  bc: (b: B) => C,
  cd: (c: C) => D,
  de: (d: D) => E,
  ef: (e: E) => F,
): F;
// biome-ignore format: better readability without formatting
export function pipeWithValue<A, B, C, D, E, F, G>(
  a: A,
  ab: (a: A) => B,
  bc: (b: B) => C,
  cd: (c: C) => D,
  de: (d: D) => E,
  ef: (e: E) => F,
  fg: (f: F) => G,
): G;
// biome-ignore format: better readability without formatting
export function pipeWithValue<A, B, C, D, E, F, G, H>(
  a: A,
  ab: (a: A) => B,
  bc: (b: B) => C,
  cd: (c: C) => D,
  de: (d: D) => E,
  ef: (e: E) => F,
  fg: (f: F) => G,
  gh: (g: G) => H,
): H;
// biome-ignore format: better readability without formatting
export function pipeWithValue<A, B, C, D, E, F, G, H, I>(
  a: A,
  ab: (a: A) => B,
  bc: (b: B) => C,
  cd: (c: C) => D,
  de: (d: D) => E,
  ef: (e: E) => F,
  fg: (f: F) => G,
  gh: (g: G) => H,
  hi: (h: H) => I,
): I;

// biome-ignore format: better readability without formatting
export function pipeWithValue<A, B, C, D, E, F, G, H, I, J>(
  a: A,
  ab: (a: A) => B,
  bc: (b: B) => C,
  cd: (c: C) => D,
  de: (d: D) => E,
  ef: (e: E) => F,
  fg: (f: F) => G,
  gh: (g: G) => H,
  hi: (h: H) => I,
  ij: (i: I) => J,
): J;

// biome-ignore format: better readability without formatting
export function pipeWithValue<A, B, C, D, E, F, G, H, I, J, K>(
  a: A,
  ab: (a: A) => B,
  bc: (b: B) => C,
  cd: (c: C) => D,
  de: (d: D) => E,
  ef: (e: E) => F,
  fg: (f: F) => G,
  gh: (g: G) => H,
  hi: (h: H) => I,
  ij: (i: I) => J,
  jk: (j: J) => K,
): K;

// biome-ignore format: better readability without formatting
export function pipeWithValue<A, B, C, D, E, F, G, H, I, J, K, L>(
  a: A,
  ab: (a: A) => B,
  bc: (b: B) => C,
  cd: (c: C) => D,
  de: (d: D) => E,
  ef: (e: E) => F,
  fg: (f: F) => G,
  gh: (g: G) => H,
  hi: (h: H) => I,
  ij: (i: I) => J,
  jk: (j: J) => K,
  kl: (k: K) => L,
): L;

// biome-ignore format: better readability without formatting
export function pipeWithValue<A, B, C, D, E, F, G, H, I, J, K, L, M>(
  a: A,
  ab: (a: A) => B,
  bc: (b: B) => C,
  cd: (c: C) => D,
  de: (d: D) => E,
  ef: (e: E) => F,
  fg: (f: F) => G,
  gh: (g: G) => H,
  hi: (h: H) => I,
  ij: (i: I) => J,
  jk: (j: J) => K,
  kl: (k: K) => L,
  lm: (l: L) => M,
): M;

// biome-ignore format: better readability without formatting
export function pipeWithValue<A, B, C, D, E, F, G, H, I, J, K, L, M, N>(
  a: A,
  ab: (a: A) => B,
  bc: (b: B) => C,
  cd: (c: C) => D,
  de: (d: D) => E,
  ef: (e: E) => F,
  fg: (f: F) => G,
  gh: (g: G) => H,
  hi: (h: H) => I,
  ij: (i: I) => J,
  jk: (j: J) => K,
  kl: (k: K) => L,
  lm: (l: L) => M,
  mn: (m: M) => N,
): N;

// biome-ignore format: better readability without formatting
export function pipeWithValue(
  a: unknown,
  ab?: AnyFunction,
  bc?: AnyFunction,
  cd?: AnyFunction,
  de?: AnyFunction,
  ef?: AnyFunction,
  fg?: AnyFunction,
  gh?: AnyFunction,
  hi?: AnyFunction,
  ij?: AnyFunction,
  jk?: AnyFunction,
  kl?: AnyFunction,
  lm?: AnyFunction,
  mn?: AnyFunction,
): unknown {
  switch (arguments.length) {
    case 1:
      return a;
    case 2:
      return ab?.(a);
    case 3:
      return bc?.(ab?.(a));
    case 4:
      return cd?.(bc?.(ab?.(a)));
    case 5:
      return de?.(cd?.(bc?.(ab?.(a))));
    case 6:
      return ef?.(de?.(cd?.(bc?.(ab?.(a)))));
    case 7:
      return fg?.(ef?.(de?.(cd?.(bc?.(ab?.(a))))));
    case 8:
      return gh?.(fg?.(ef?.(de?.(cd?.(bc?.(ab?.(a)))))));
    case 9:
      return hi?.(gh?.(fg?.(ef?.(de?.(cd?.(bc?.(ab?.(a))))))));
    case 10:
      return ij?.(hi?.(gh?.(fg?.(ef?.(de?.(cd?.(bc?.(ab?.(a)))))))));
    case 11:
      return jk?.(ij?.(hi?.(gh?.(fg?.(ef?.(de?.(cd?.(bc?.(ab?.(a))))))))));
    case 12:
      return kl?.(jk?.(ij?.(hi?.(gh?.(fg?.(ef?.(de?.(cd?.(bc?.(ab?.(a)))))))))));
    case 13:
      return lm?.(kl?.(jk?.(ij?.(hi?.(gh?.(fg?.(ef?.(de?.(cd?.(bc?.(ab?.(a))))))))))));
    case 14:
      return mn?.(lm?.(kl?.(jk?.(ij?.(hi?.(gh?.(fg?.(ef?.(de?.(cd?.(bc?.(ab?.(a)))))))))))));
    default:
      throw Error(
        "Cannot handle so many arguments, check : https://github.com/gcanti/fp-ts/blob/master/src/function.ts",
      );
  }
}

// biome-ignore lint/complexity/noBannedTypes: <explanation>
type AnyFunction = Function;
/* eslint-enable */
