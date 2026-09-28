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
  if (!exchangesComponent && !exchangeFormComponent) return null;
  return (
    <BorderedSection className={cx(Styles.root)}>
      {exchangesComponent && (
        <div
          ref={containerRef}
          className={cx(
            fr.cx(
              "fr-mt-2w",
              "fr-pr-2w",
              "fr-pl-2w",
              !exchangeFormComponent && "fr-mb-2w",
            ),
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
