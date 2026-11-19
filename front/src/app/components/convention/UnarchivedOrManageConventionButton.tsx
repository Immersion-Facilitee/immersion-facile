import { Button, type ButtonProps } from "@codegouvfr/react-dsfr/Button";
import {
  type ConventionId,
  type DateString,
  frontRoutes,
  isConventionArchived,
} from "shared";

type UnarchivedOrManageConventionButtonParams = {
  label: string;
  conventionId: ConventionId;
  conventionDateEnd: DateString;
  isDisabled: boolean;
  id: string;
  unarchiveButtonId: string;
};

export const getUnarchivedOrManageConventionButtonProps = ({
  label,
  conventionId,
  conventionDateEnd,
  isDisabled,
  id,
  unarchiveButtonId,
}: UnarchivedOrManageConventionButtonParams): ButtonProps => {
  if (isDisabled)
    return {
      id,
      disabled: true,
      children: label,
    };

  if (isConventionArchived({ dateEnd: conventionDateEnd, now: new Date() }))
    return {
      id: unarchiveButtonId,
      children: "Désarchiver",
      linkProps: {
        ...frontRoutes.archivedConventionRequest({ conventionId }).link,
        target: "_blank",
      },
    };

  return {
    id,
    children: label,
    linkProps: {
      ...frontRoutes.manageConventionConnectedUser({ conventionId }).link,
      target: "_blank",
    },
  };
};

export const UnarchivedOrManageConventionButton = (
  params: UnarchivedOrManageConventionButtonParams,
): React.ReactNode => (
  <Button
    size="small"
    priority="secondary"
    {...getUnarchivedOrManageConventionButtonProps(params)}
  />
);
