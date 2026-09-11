import { Button } from "@codegouvfr/react-dsfr/Button";
import {
  type ConventionId,
  type DateString,
  domElementIds,
  frontRoutes,
  isConventionArchived,
} from "shared";

export const UnarchivedOrManageConventionButton = ({
  label,
  conventionId,
  conventionDateEnd,
  isDisabled,
}: {
  label: string;
  conventionId: ConventionId;
  conventionDateEnd: DateString;
  isDisabled: boolean;
}): React.ReactNode => {
  if (isDisabled)
    return (
      <Button
        disabled
        size="small"
        priority="secondary"
        id={`${domElementIds.beneficiaryDashboardConventions.goToConventionButton}--${conventionId}`}
      >
        {label}
      </Button>
    );

  return isConventionArchived({
    dateEnd: conventionDateEnd,
    now: new Date(),
  }) ? (
    <Button
      id={`${domElementIds.beneficiaryDashboardConventions.unarchiveConventionButton}--${conventionId}`}
      size="small"
      priority="secondary"
      linkProps={{
        ...frontRoutes.archivedConventionRequest({ conventionId }).link,
        target: "_blank",
      }}
    >
      Désarchiver
    </Button>
  ) : (
    <Button
      id={`${domElementIds.beneficiaryDashboardConventions.goToConventionButton}--${conventionId}`}
      size="small"
      priority="secondary"
      linkProps={{
        ...frontRoutes.manageConventionConnectedUser({
          conventionId,
        }).link,
        target: "_blank",
      }}
    >
      {label}
    </Button>
  );
};
