import { fr } from "@codegouvfr/react-dsfr";
import { Alert } from "@codegouvfr/react-dsfr/Alert";
import type { Ref } from "react";
import { domElementIds } from "shared";
import type { NumberOfSteps } from "src/core-logic/domain/convention/convention.slice";
import { conventionFormStepId } from "./errorSummarySections";

export const ConventionErrorSummary = ({
  steps,
  title,
  stepTitles,
  errorSummaryRef,
  onStepLinkClick,
}: {
  steps: NumberOfSteps[];
  title: string;
  stepTitles: Record<NumberOfSteps, string>;
  errorSummaryRef: Ref<HTMLDivElement>;
  onStepLinkClick: (step: NumberOfSteps) => void;
}): JSX.Element | null => {
  if (steps.length === 0) return null;

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
            {steps.map((step) => (
              <li key={step}>
                <strong>
                  <a
                    id={
                      domElementIds.conventionImmersion.errorSummaryStepLink[
                        `step${step}`
                      ]
                    }
                    href={`#${conventionFormStepId(step)}-collapse`}
                    onClick={(event) => {
                      event.preventDefault();
                      onStepLinkClick(step);
                    }}
                  >
                    {stepTitles[step]}
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
