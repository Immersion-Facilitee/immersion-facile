import { fr } from "@codegouvfr/react-dsfr";
import type { ReactNode } from "react";
import { useStyles } from "tss-react/dsfr";
import type { TitleLevel } from "../../utils";
import Styles from "./PageHeader.styles";

export type PageHeaderProps = {
  title: string;
  illustration?: string;
  className?: string;
  children?: ReactNode;
  classes?: Partial<Record<"root" | "description" | "inner" | "title", string>>;
  badge?: ReactNode;
  titleAs?: TitleLevel;
  titleClassName?: string;
};

export const PageHeader = ({
  title,
  titleAs = "h1",
  titleClassName,
  className,
  children,
  illustration,
  classes = {},
  badge,
}: PageHeaderProps) => {
  const { cx } = useStyles();
  const Title = titleAs;
  const textContent = (
    <>
      {badge}
      <Title
        className={cx(
          children ? "" : "fr-my-auto",
          titleClassName,
          classes.title,
        )}
      >
        {title}
      </Title>
      {children}
    </>
  );
  return (
    <section
      className={cx(
        fr.cx("fr-pt-1w", "fr-pb-2w"),
        Styles.root,
        ` ${className ?? ""}`,
        classes.root,
      )}
      aria-label="En-tête de page"
    >
      <div className={cx(fr.cx("fr-container", "fr-mt-4w"), classes.inner)}>
        {illustration && (
          <div className={fr.cx("fr-grid-row", "fr-grid-row--middle")}>
            <div className={fr.cx("fr-col-12", "fr-col-lg-7")}>
              {textContent}
            </div>
            <div
              className={fr.cx(
                "fr-col-12",
                "fr-col-lg-4",
                "fr-ml-auto",
                "fr-px-1w",
                "fr-hidden",
                "fr-unhidden-lg",
              )}
            >
              <img src={illustration} alt="" />
            </div>
          </div>
        )}
        {!illustration && textContent}
      </div>
    </section>
  );
};
