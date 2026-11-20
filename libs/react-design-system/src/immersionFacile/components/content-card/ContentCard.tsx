import { fr } from "@codegouvfr/react-dsfr";
import { Accordion } from "@codegouvfr/react-dsfr/Accordion";
import type { ReactNode, Ref } from "react";
import { useStyles } from "tss-react/dsfr";
import Styles from "./ContentCard.styles";

type ContentCardProps = {
  title?: string;
  children?: ReactNode;
  className?: string;
  titleAside?: ReactNode;
  accordionId?: string;
  hasLargePadding?: boolean;
  last?: boolean;
  sectionRef?: Ref<HTMLElement>;
};

export const ContentCard = ({
  title,
  children,
  className,
  titleAside,
  accordionId,
  hasLargePadding = false,
  last = false,
  sectionRef,
}: ContentCardProps): ReactNode => {
  const { cx } = useStyles();
  if (accordionId && title && children)
    return (
      <Accordion id={accordionId} label={title} titleAs="h2">
        <section ref={sectionRef} className={cx(fr.cx("fr-pl-2w", "fr-pr-2w"))}>
          {children}
        </section>
      </Accordion>
    );
  return (
    <section
      ref={sectionRef}
      className={cx(
        Styles.root,
        fr.cx(
          hasLargePadding ? "fr-p-4w" : "fr-p-3w",
          !last && "fr-mb-2w",
          !last && "fr-mb-md-3w",
        ),
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
