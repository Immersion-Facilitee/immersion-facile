import { fr } from "@codegouvfr/react-dsfr";
import type { ReactNode } from "react";
import { useStyles } from "tss-react/dsfr";
import Styles from "./DiscussionContentContainer.styles";

export type DiscussionContentContainerProps = {
  content: ReactNode;
  aside: ReactNode;
  className?: string;
};

export const DiscussionContentContainer = ({
  content,
  aside,
  className,
}: DiscussionContentContainerProps) => {
  const { cx } = useStyles();

  return (
    <div
      className={cx(
        fr.cx("fr-grid-row", "fr-grid-row--top", "fr-grid-row--gutters"),
        Styles.root,
        className,
      )}
    >
      <div className={cx(fr.cx("fr-col-12", "fr-col-lg-8"), Styles.content)}>
        {content}
      </div>
      <div className={cx(fr.cx("fr-col-12", "fr-col-lg-4"), Styles.aside)}>
        {aside}
      </div>
    </div>
  );
};
