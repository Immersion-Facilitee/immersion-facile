import { type FrIconClassName, fr } from "@codegouvfr/react-dsfr";
import Button, { type ButtonProps } from "@codegouvfr/react-dsfr/Button";
import { useStyles } from "tss-react/dsfr";
import { taskSummaryStyles } from "./TaskSummary.styles";

export type TaskSummaryProps = {
  className?: string;
  count: number;
  countLabel: string;
  icon?: string;
  buttonProps?: ButtonProps;
  detail?: {
    message: string;
    icon?: FrIconClassName;
  };
};

export const TaskSummary = ({
  count,
  countLabel,
  icon,
  className,
  buttonProps,
  detail,
}: TaskSummaryProps) => {
  const { cx } = useStyles();

  return (
    <article
      className={cx(
        fr.cx("fr-card", "fr-container", "fr-mb-2v", "fr-p-4v"),
        className ? className : "",
      )}
    >
      <div className={fr.cx("fr-grid-row")}>
        <div className={cx(fr.cx("fr-col-2"), taskSummaryStyles.count)}>
          <p className={fr.cx("fr-text--xl", "fr-text--bold", "fr-mb-0")}>
            {count}
          </p>
        </div>
        <div className={fr.cx("fr-col-10")}>
          {icon && (
            <span
              aria-hidden="true"
              className={cx(fr.cx("fr-pl-2w"), icon, taskSummaryStyles.icon)}
            />
          )}
          <p className={fr.cx("fr-pl-2w", "fr-mb-0")}>{countLabel}</p>
        </div>
        {buttonProps && (
          <div className={fr.cx("fr-col-12", "fr-mt-1w")}>
            <Button
              priority="tertiary no outline"
              className={cx(
                fr.cx("fr-m-0", "fr-p-0"),
                taskSummaryStyles.button,
              )}
              {...buttonProps}
            />
          </div>
        )}
        {detail && (
          <div className={fr.cx("fr-col-12", "fr-mt-2w")}>
            <p className={fr.cx("fr-text--xs", "fr-hint-text", "fr-mb-0")}>
              {detail.icon && (
                <span
                  className={fr.cx(detail.icon, "fr-icon--xs", "fr-mr-1v")}
                  aria-hidden="true"
                />
              )}
              {detail.message}
            </p>
          </div>
        )}
      </div>
    </article>
  );
};
