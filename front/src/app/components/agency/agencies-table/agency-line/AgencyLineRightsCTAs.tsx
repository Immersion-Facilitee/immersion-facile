import { fr } from "@codegouvfr/react-dsfr";
import Button from "@codegouvfr/react-dsfr/Button";
import { createModal } from "@codegouvfr/react-dsfr/Modal";
import { type ReactNode, useMemo } from "react";
import { createPortal } from "react-dom";
import { useDispatch } from "react-redux";
import {
  type AgencyRight,
  domElementIds,
  frontRoutes,
  type User,
} from "shared";
import { removeUserFromAgencySlice } from "src/core-logic/domain/agencies/remove-user-from-agency/removeUserFromAgency.slice";
import { feedbackSlice } from "src/core-logic/domain/feedback/feedback.slice";
import {
  makeRemoveUserAgencyRightsButtonProps,
  makeRemoveUserAgencyRightsModalProps,
} from "../../removeUserAgencyRights";

export const AgencyLineRightsCTAs = ({
  agencyRight,
  isBackofficeAdmin,
  onUpdateClicked,
  onRegistrationCancelledClicked,
  user,
}: {
  agencyRight: AgencyRight;
  onUpdateClicked?: (agencyRight: AgencyRight) => void;
  onRegistrationCancelledClicked?: (agencyRight: AgencyRight) => void;
  isBackofficeAdmin?: boolean;
  user: User;
}): ReactNode => {
  const removeUserModalId = `${domElementIds.agencyDashboard.agencyTab.removeAgencyRightModal}-${agencyRight.agency.id}-${user.id}`;
  const userRightToRemove = {
    agencyRight,
    userEmail: user.email,
    userId: user.id,
    isSelfRemoval: true,
  };
  const dispatch = useDispatch();
  const removeUserModal = useMemo(
    () =>
      createModal({
        isOpenedByDefault: false,
        id: removeUserModalId,
      }),
    [removeUserModalId],
  );

  return (
    <>
      {onUpdateClicked && (
        <Button
          size="small"
          priority="secondary"
          id={`${domElementIds.agencyDashboard.agencyTab.editRoleButton}-${agencyRight.agency.id}`}
          onClick={() => {
            onUpdateClicked(agencyRight);
          }}
        >
          Modifier
        </Button>
      )}
      {!onRegistrationCancelledClicked && (
        <Button
          {...makeRemoveUserAgencyRightsButtonProps({
            onDeleteClicked: () => {
              dispatch(feedbackSlice.actions.clearFeedbacksTriggered());
              removeUserModal.open();
            },
            removeUserButtonId: `${domElementIds.agencyDashboard.agencyTab.removeAgencyRightButton}-${agencyRight.agency.id}-${user.id}`,
            userRightToRemove,
            size: "small",
          })}
          className={fr.cx("fr-mx-1w")}
        />
      )}

      {isBackofficeAdmin && (
        <Button
          priority="tertiary no outline"
          id={`${domElementIds.agencyDashboard.agencyTab.adminAgencyLink}-${agencyRight.agency.id}`}
          size="small"
          linkProps={
            frontRoutes.adminAgencyDetail({
              agencyId: agencyRight.agency.id,
            }).link
          }
        >
          Voir l'agence comme admin IF
        </Button>
      )}
      {onRegistrationCancelledClicked && (
        <Button
          priority="secondary"
          id={`${domElementIds.agencyDashboard.agencyTab.cancelRegistrationButton}-${agencyRight.agency.id}`}
          size="small"
          onClick={() => {
            onRegistrationCancelledClicked(agencyRight);
          }}
        >
          Annuler la demande
        </Button>
      )}
      {createPortal(
        removeUserModal.Component(
          makeRemoveUserAgencyRightsModalProps({
            onCancel: () => removeUserModal.close(),
            onSubmitted: () => {
              dispatch(
                removeUserFromAgencySlice.actions.removeUserFromAgencyRequested(
                  {
                    userId: userRightToRemove.userId,
                    agencyId: userRightToRemove.agencyRight.agency.id,
                    feedbackTopic: "agency-user-right-self",
                  },
                ),
              );
              removeUserModal.close();
            },
            userRightToRemove,
          }),
        ),
        document.body,
      )}
    </>
  );
};
