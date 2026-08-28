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
    mediaQuery.addEventListener("change", () =>
      setIsLayoutDesktop(mediaQuery.matches),
    );
    return () =>
      mediaQuery.removeEventListener("change", () =>
        setIsLayoutDesktop(mediaQuery.matches),
      );
  }, []);
  return { isLayoutDesktop };
};
