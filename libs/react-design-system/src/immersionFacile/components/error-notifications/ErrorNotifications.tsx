import { fr } from "@codegouvfr/react-dsfr";
import { Alert } from "@codegouvfr/react-dsfr/Alert";

import { useStyles } from "tss-react/dsfr";

const componentName = "im-notification-errors";

type ErrorWithLabel = {
  error: {
    field: string;
    message: string;
  };
  label?: string;
};

export type ErrorNotificationsProps = {
  errorsWithLabels: ErrorWithLabel[];
  visible: boolean;
};

const ErrorMessage = ({ error, label }: ErrorWithLabel) => (
  <>
    <strong className={`${componentName}__error-label`}>{label}</strong> :{" "}
    <span className={`${componentName}__error-message`}>{error.message}</span>
  </>
);

export const ErrorNotifications = ({
  errorsWithLabels,
  visible,
}: ErrorNotificationsProps) => {
  const { cx } = useStyles();
  if (!visible) return null;
  return (
    <Alert
      severity="error"
      title="Veuillez corriger les erreurs suivantes"
      className={cx(componentName, fr.cx("fr-my-2w"))}
      description={
        <ul className={`${componentName}__error-list`}>
          {errorsWithLabels.map((errorWithLabel) => (
            <li
              key={errorWithLabel.error.field}
              className={`${componentName}__error-wrapper`}
            >
              <ErrorMessage {...errorWithLabel} />
            </li>
          ))}
        </ul>
      }
    />
  );
};
