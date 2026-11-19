import { fr } from "@codegouvfr/react-dsfr";
import { Accordion } from "@codegouvfr/react-dsfr/Accordion";
import type { ReactNode, Ref } from "react";
import type { domElementIds } from "shared";
import { useStyles } from "tss-react/dsfr";
import "./SearchResultCard.scss";

export type SearchResultDomIds = (typeof domElementIds)[
  | "searchResult"
  | "searchResultForStudent"
  | "searchResultExternal"];

type SearchResultCardProps = {
  title?: string;
  children?: ReactNode;
  className?: string;
  titleAside?: ReactNode;
  accordionId?: string;
  hasLargePadding?: boolean;
  sectionRef?: Ref<HTMLElement>;
};

export const SearchResultCard = ({
  title,
  children,
  className,
  titleAside,
  accordionId,
  hasLargePadding = false,
  sectionRef,
}: SearchResultCardProps): JSX.Element => {
  const { cx } = useStyles();
  if (accordionId && title && children)
    return (
      <Accordion id={accordionId} label={title} titleAs="h2">
        {children}
      </Accordion>
    );
  return (
    <section
      ref={sectionRef}
      className={cx(
        "im-search-result-card",
        fr.cx(hasLargePadding ? "fr-p-4w" : "fr-p-3w", "fr-mb-3w"),
        className,
      )}
    >
      {title && titleAside && (
        <div className={fr.cx("fr-grid-row", "fr-grid-row--middle")}>
          <h2 className={fr.cx("fr-h5", "fr-col", "fr-mb-0", "fr-mr-2w")}>
            {title}
          </h2>
          {titleAside}
        </div>
      )}
      {title && !titleAside && (
        <h2 className={fr.cx("fr-h5", "fr-mb-2w")}>{title}</h2>
      )}
      {children}
    </section>
  );
};

export const makeExternalLinkProps = (
  title: string,
): { target: "_blank"; rel: string; title: string } => ({
  target: "_blank",
  rel: "noreferrer",
  title: `${title} - nouvelle fenêtre`,
});
