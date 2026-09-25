import { fr } from "@codegouvfr/react-dsfr";
import { type ReactNode, useEffect, useRef } from "react";
import { useStyles } from "tss-react/dsfr";
import { BorderedSection } from "../bordered-section";
import Styles from "./DiscussionExchangesContainer.styles";

export const DiscussionExchangesContainer = ({
  exchangesComponent,
  exchangeFormComponent,
}: {
  exchangesComponent: ReactNode;
  exchangeFormComponent: ReactNode;
}) => {
  const { cx } = useStyles();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = containerRef.current;

    if (element) {
      element.scrollTop = element.scrollHeight;
    }
  }, []);
  return (
    <BorderedSection className={cx(Styles.root)}>
      {exchangesComponent && (
        <div
          ref={containerRef}
          className={cx(
            fr.cx("fr-mt-2w", "fr-mr-2w", "fr-ml-2w"),
            Styles.exchangesList,
          )}
        >
          {exchangesComponent}
        </div>
      )}
      {exchangeFormComponent && (
        <div className={cx(fr.cx("fr-p-2w", "fr-pt-0"), Styles.formContainer)}>
          {exchangeFormComponent}
        </div>
      )}
    </BorderedSection>
  );
};
