import { fr } from "@codegouvfr/react-dsfr";
import { Alert } from "@codegouvfr/react-dsfr/Alert";
import type { Ref } from "react";
import { domElementIds } from "shared";
import type { NumberOfSteps } from "src/core-logic/domain/convention/convention.slice";
import type { ConventionErrorSummarySection } from "./errorSummarySections";

export const ConventionErrorSummary = ({
  sections,
  title,
  sectionTitles,
  errorSummaryRef,
  onSectionLinkClick,
}: {
  sections: ConventionErrorSummarySection[];
  title: string;
  sectionTitles: Record<NumberOfSteps, string>;
  errorSummaryRef: Ref<HTMLDivElement>;
  onSectionLinkClick: (section: ConventionErrorSummarySection) => void;
}): JSX.Element | null => {
  if (sections.length === 0) return null;

  return (
    <div
      ref={errorSummaryRef}
      id={domElementIds.conventionImmersion.errorSummary}
      tabIndex={-1}
      className={fr.cx("fr-my-2w")}
    >
      <Alert
        severity="error"
        title={title}
        description={
          <ul className={fr.cx("fr-mb-0")}>
            {sections.map((section) => (
              <li key={section.step}>
                <strong>
                  <a
                    id={
                      domElementIds.conventionImmersion.errorSummaryStepLink[
                        `step${section.step}`
                      ]
                    }
                    href={`#${section.firstFieldId}`}
                    onClick={(event) => {
                      event.preventDefault();
                      onSectionLinkClick(section);
                    }}
                  >
                    {`${sectionTitles[section.step]}`}
                  </a>
                </strong>
              </li>
            ))}
          </ul>
        }
      />
    </div>
  );
};
