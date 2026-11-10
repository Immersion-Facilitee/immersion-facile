import { fr } from "@codegouvfr/react-dsfr";
import { useStyles } from "tss-react/dsfr";
import Styles from "./SectionSteps.styles";

type Step = {
  title: string;
  description: string;
};

export type SectionStepsProps = {
  title: string;
  steps: Step[];
};

export const SectionSteps = ({ title, steps }: SectionStepsProps) => {
  const { cx } = useStyles();
  return (
    <section className={cx(fr.cx("fr-py-6w"), Styles.root)}>
      <div className={fr.cx("fr-container")}>
        <h2 className={fr.cx("fr-mb-3w", "fr-mb-md-6w")}>{title}</h2>
        <ol className={cx(fr.cx("fr-m-0", "fr-p-0"), Styles.steps)}>
          {steps.map((step, index) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: Index is ok here
            <li key={index} className={cx(fr.cx("fr-p-0"), Styles.step)}>
              <span className={Styles.stepNumber} aria-hidden="true">
                {index + 1}
              </span>
              <div className={Styles.stepContent}>
                <p className={fr.cx("fr-text--bold", "fr-mb-0")}>
                  {step.title}
                </p>
                <p className={fr.cx("fr-text--sm", "fr-mb-0")}>
                  {step.description}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
};
