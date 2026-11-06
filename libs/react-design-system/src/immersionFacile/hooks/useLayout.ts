import { fr } from "@codegouvfr/react-dsfr";
import { useLayoutEffect, useState } from "react";

export const isDesktop = () =>
  window.matchMedia(fr.breakpoints.up("lg").replace("@media ", "")).matches;

export const useLayout = () => {
  const [isLayoutDesktop, setIsLayoutDesktop] = useState(isDesktop());
  useLayoutEffect(() => {
    const mediaQuery = window.matchMedia(
      fr.breakpoints.up("lg").replace("@media ", ""),
    );
    const onLayoutChange = () => setIsLayoutDesktop(mediaQuery.matches);
    mediaQuery.addEventListener("change", onLayoutChange);
    return () => mediaQuery.removeEventListener("change", onLayoutChange);
  }, []);
  return { isLayoutDesktop };
};
