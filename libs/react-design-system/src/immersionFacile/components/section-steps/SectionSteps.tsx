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
        <h2 className={Styles.title}>{title}</h2>
        <ol className={Styles.steps}>
          {steps.map((step, index) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: Index is ok here
            <li key={index} className={Styles.step}>
              <span className={Styles.stepNumber} aria-hidden="true">
                {index + 1}
              </span>
              <div className={Styles.stepContent}>
                <p className={cx(fr.cx("fr-text--md"), Styles.stepTitle)}>
                  {step.title}
                </p>
                <p className={cx(fr.cx("fr-text--sm"), Styles.stepDescription)}>
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
