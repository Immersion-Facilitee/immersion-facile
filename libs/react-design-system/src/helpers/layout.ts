import { fr } from "@codegouvfr/react-dsfr";
import type { BreakpointKeys } from "@codegouvfr/react-dsfr/useBreakpointsValuesPx";
import { useLayoutEffect, useState } from "react";

type Breakpoint = Exclude<BreakpointKeys, "xs">;

const getBreakpointMediaQuery = (breakpoint: Breakpoint) =>
  fr.breakpoints.up(breakpoint).replace("@media ", "");

const isAboveBreakpoint = (breakpoint: Breakpoint) =>
  window.matchMedia(getBreakpointMediaQuery(breakpoint)).matches;

export const useBreakpoint = (breakpoint: Breakpoint) => {
  const [isAbove, setIsAbove] = useState(isAboveBreakpoint(breakpoint));

  useLayoutEffect(() => {
    const mediaQuery = window.matchMedia(getBreakpointMediaQuery(breakpoint));
    const updateIsAbove = () => setIsAbove(mediaQuery.matches);

    mediaQuery.addEventListener("change", updateIsAbove);

    return () => mediaQuery.removeEventListener("change", updateIsAbove);
  }, [breakpoint]);

  return isAbove;
};
