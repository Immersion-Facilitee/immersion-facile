import type { FrClassName } from "@codegouvfr/react-dsfr";
import { makeStyles } from "tss-react/dsfr";

// Utility global styles, overriding DSFR styles
// should be used sparingly, and only declare utility classes, not components
export const useStyleUtils = makeStyles()((_theme) => ({
  "text-centered": {
    textAlign: "center",
  },
}));

export type Device = "mobile" | "tablet" | "desktop";

export const getDevice = (): Device => {
  const { userAgent, maxTouchPoints } = navigator;
  const isIpadWithDesktopUserAgent =
    /Macintosh/i.test(userAgent) && maxTouchPoints > 1;
  if (
    isIpadWithDesktopUserAgent ||
    /iPad|Tablet|Android(?!.*Mobile)/i.test(userAgent)
  )
    return "tablet";
  if (/Mobi|iPhone|iPod|Android/i.test(userAgent)) return "mobile";
  return "desktop";
};

export const keys = <T extends string | number | symbol>(
  obj: Partial<Record<T, unknown>>,
): T[] => Object.keys(obj) as T[];

export const equals = (x: unknown, y: unknown): boolean => {
  const ok = Object.keys;
  const tx = typeof x;
  const ty = typeof y;
  return x && y && tx === "object" && tx === ty
    ? ok(x).length === ok(y).length &&
        ok(x).every((key) =>
          equals(x[key as keyof typeof x], y[key as keyof typeof y]),
        )
    : x === y;
};

export type TitleLevel = "h1" | "h2" | "h3" | "h4";

export const dashboardTitleToClassName: Record<TitleLevel, FrClassName> = {
  h1: "fr-h5",
  h2: "fr-h5",
  h3: "fr-h6",
  h4: "fr-h6",
};

export type Capitalize<T extends string> =
  T extends `${infer First}${infer Rest}` ? `${Uppercase<First>}${Rest}` : T;
