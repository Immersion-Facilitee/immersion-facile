import { fr } from "@codegouvfr/react-dsfr";
import type { ReactNode } from "react";
import { useStyles } from "tss-react/dsfr";
import { dashboardTitleToClassName, type TitleLevel } from "../../utils";
import { taskStyles } from "./Task.styles";

type ButtonsRow = {
  id: string;
  content: ReactNode;
};

export type TaskProps = {
  className?: string;
  title: ReactNode;
  titleAs: TitleLevel;
  description?: ReactNode;
  footer?: ReactNode;
  hasBackgroundColor?: boolean;
  buttonsRows?: ButtonsRow[];
};

export const Task = ({
  title,
  titleAs,
  description,
  className,
  footer,
  hasBackgroundColor = false,
  buttonsRows,
}: TaskProps) => {
  const { cx } = useStyles();
  const Title = titleAs;

  return (
    <article
      className={cx(
        fr.cx(
          "fr-card",
          "fr-container",
          "fr-mb-2v",
          "fr-p-4v",
          hasBackgroundColor && "fr-card--no-border",
        ),
        hasBackgroundColor && taskStyles.withBackgroundColor,
        className ? className : "",
      )}
    >
      <div className={fr.cx("fr-grid-row")}>
        <div className={fr.cx("fr-col-12", "fr-col-md-7")}>
          <Title
            className={cx(
              fr.cx("fr-grid-row", "fr-mb-1w", "fr-grid-row--middle"),
              dashboardTitleToClassName[titleAs],
            )}
          >
            {title}
          </Title>
          {description && <p className={fr.cx("fr-mb-2v")}>{description}</p>}
          {footer && (
            <footer
              className={cx(taskStyles.footer, "fr-text--sm", "fr-mb-2v")}
            >
              {footer}
            </footer>
          )}
        </div>
        {buttonsRows && buttonsRows.length > 0 && (
          <div
            className={cx(
              fr.cx("fr-col-12", "fr-col-md-5"),
              taskStyles.buttons,
            )}
          >
            {buttonsRows.map((row) => (
              <div key={row.id} className={taskStyles.buttonsRow}>
                {row.content}
              </div>
            ))}
          </div>
        )}
      </div>
    </article>
  );
};
