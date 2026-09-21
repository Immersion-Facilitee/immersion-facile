import { fr } from "@codegouvfr/react-dsfr";

type NotificationIndicatorProps = {
  isNotified: boolean;
};

export const NotificationIndicator = ({
  isNotified,
}: NotificationIndicatorProps) => (
  <span className={fr.cx("fr-text--xs")}>
    {isNotified
      ? "✅ Reçoit les notifications"
      : "❌ Ne reçoit pas les notifications"}
  </span>
);
