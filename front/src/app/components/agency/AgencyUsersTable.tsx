import { fr } from "@codegouvfr/react-dsfr";
import { Badge } from "@codegouvfr/react-dsfr/Badge";
import { ButtonsGroup } from "@codegouvfr/react-dsfr/ButtonsGroup";
import { createModal } from "@codegouvfr/react-dsfr/Modal";
import { Table } from "@codegouvfr/react-dsfr/Table";
import { useMemo, useState } from "react";
import { NotificationIndicator } from "react-design-system";
import { createPortal } from "react-dom";
import { useDispatch } from "react-redux";
import { type AgencyDto, type ConnectedUser, domElementIds } from "shared";
import { NameAndEmailInTable } from "src/app/components/admin/NameAndEmailInTable";
import type { AgencyOverviewRouteName } from "src/app/components/forms/agency/AgencyOverview";
import { agencyRolesToDisplay } from "src/app/contents/userRolesToDisplay";
import { useAppSelector } from "src/app/hooks/reduxHooks";
import type { ConnectedUserWithNormalizedAgencyRights } from "src/core-logic/domain/admin/connectedUsersAdmin/connectedUsersAdmin.slice";
import { removeUserFromAgencySlice } from "src/core-logic/domain/agencies/remove-user-from-agency/removeUserFromAgency.slice";
import { connectedUserSelectors } from "src/core-logic/domain/connected-user/connectedUser.selectors";
import { feedbackSlice } from "src/core-logic/domain/feedback/feedback.slice";
import {
  makeRemoveUserAgencyRightsButtonProps,
  makeRemoveUserAgencyRightsModalProps,
  type UserRightToRemove,
} from "./removeUserAgencyRights";

type AgencyUsersTableProps = {
  agencyUsers: ConnectedUserWithNormalizedAgencyRights[];
  agency: AgencyDto;
  onModifyClicked: (user: ConnectedUserWithNormalizedAgencyRights) => void;
  routeName: AgencyOverviewRouteName;
};

export const AgencyUsersTable = ({
  agency,
  agencyUsers,
  onModifyClicked,
  routeName,
}: AgencyUsersTableProps) => {
  const currentUser = useAppSelector(connectedUserSelectors.currentUser);
  const dispatch = useDispatch();
  const [userRightToRemove, setUserRightToRemove] =
    useState<null | UserRightToRemove>(null);

  const isLocationAdmin =
    routeName === "adminAgencies" || routeName === "adminAgencyDetail";

  const tableId = isLocationAdmin
    ? domElementIds.admin.agencyTab.agencyUsersTable
    : domElementIds.agencyDashboard.agencyDetails.agencyUsersTable;

  const domElementIdSection = isLocationAdmin
    ? domElementIds.admin.agencyTab
    : domElementIds.agencyDashboard.agencyDetails;

  const removeUserModal = useMemo(
    () =>
      createModal({
        isOpenedByDefault: false,
        id: domElementIdSection.editAgencyRemoveUserModal,
      }),
    [domElementIdSection.editAgencyRemoveUserModal],
  );

  return (
    <>
      {agencyUsers.length > 0 ? (
        <Table
          id={tableId}
          headers={[
            "Utilisateurs",
            "Préférence de communication",
            "Rôles",
            "Actions",
          ]}
          data={agencyUsers.map((agencyUser, index) =>
            TableLine({
              agency,
              agencyUser,
              currentUser,
              index,
              isLocationAdmin,
              onDeleteClicked: (userRightToRemove) => {
                setUserRightToRemove(userRightToRemove);
                dispatch(feedbackSlice.actions.clearFeedbacksTriggered());
                removeUserModal.open();
              },
              onModifyClicked,
            }),
          )}
        />
      ) : (
        <p>Aucun utilisateur trouvé</p>
      )}
      {createPortal(
        <removeUserModal.Component
          {...(userRightToRemove
            ? makeRemoveUserAgencyRightsModalProps({
                onCancel: () => removeUserModal.close(),
                onSubmitted: (userRightToRemove) => {
                  dispatch(
                    removeUserFromAgencySlice.actions.removeUserFromAgencyRequested(
                      {
                        userId: userRightToRemove.userId,
                        agencyId: userRightToRemove.agencyRight.agency.id,
                        feedbackTopic: isLocationAdmin
                          ? "agency-user"
                          : "agency-user-for-dashboard",
                      },
                    ),
                  );
                  removeUserModal.close();
                },
                userRightToRemove,
              })
            : { title: "", children: "" })}
        />,
        document.body,
      )}
    </>
  );
};

const TableLine = ({
  currentUser,
  isLocationAdmin,
  agency,
  agencyUser,
  index,
  onModifyClicked,
  onDeleteClicked,
}: {
  currentUser: ConnectedUser | null;
  isLocationAdmin: boolean;
  agency: AgencyDto;
  agencyUser: ConnectedUserWithNormalizedAgencyRights;
  index: number;
  onModifyClicked: (user: ConnectedUserWithNormalizedAgencyRights) => void;
  onDeleteClicked: (userRightToRemove: UserRightToRemove) => void;
}): React.ReactNode[] => {
  const domElementIdSection = isLocationAdmin
    ? domElementIds.admin.agencyTab
    : domElementIds.agencyDashboard.agencyDetails;
  const removeUserButtonId = `${domElementIdSection.editAgencyRemoveUserButton}-${agency.id}-${agencyUser.id}`;

  const userRightToRemove = {
    agencyRight: agencyUser.agencyRights[agency.id],
    userEmail: agencyUser.email,
    userId: agencyUser.id,
    isSelfRemoval: currentUser?.id === agencyUser.id,
  };

  return [
    <NameAndEmailInTable
      key={`${agencyUser.firstName}-${agencyUser.lastName}-${agencyUser.email}`}
      firstName={agencyUser.firstName}
      lastName={agencyUser.lastName}
      email={agencyUser.email}
    />,
    <NotificationIndicator
      key={`${agencyUser.firstName}-${agencyUser.lastName}-${agencyUser.email}-notification`}
      isNotified={agencyUser.agencyRights[agency.id].isNotifiedByEmail}
    />,
    agencyUser.agencyRights[agency.id].roles.map((role) => (
      <Badge
        key={`${agencyUser.firstName}-${agencyUser.lastName}-${agencyUser.email}-${role}`}
        small
        className={fr.cx(agencyRolesToDisplay[role].className, "fr-mr-1w")}
      >
        {agencyRolesToDisplay[role].label}
      </Badge>
    )),
    <ButtonsGroup
      key={`${agencyUser.firstName}-${agencyUser.lastName}-${agencyUser.email}-buttons`}
      inlineLayoutWhen={"always"}
      buttons={[
        {
          children: agencyUser.agencyRights[agency.id].roles.includes(
            "to-review",
          )
            ? "Valider"
            : "Modifier",
          priority: "secondary",
          className: fr.cx("fr-my-1v"),
          disabled:
            agency.refersToAgencyId !== null &&
            agencyUser.agencyRights[agency.id].roles.includes("validator"),
          id: `${
            isLocationAdmin
              ? domElementIds.admin.agencyTab.editAgencyUserRoleButton
              : domElementIds.agencyDashboard.agencyDetails
                  .editAgencyUserRoleButton
          }-${agency.id}-${index}`,
          onClick: () => onModifyClicked(agencyUser),
        },
        {
          ...makeRemoveUserAgencyRightsButtonProps({
            onDeleteClicked: () => onDeleteClicked(userRightToRemove),
            userRightToRemove,
            removeUserButtonId,
          }),
          className: fr.cx("fr-my-1v"),
        },
      ]}
    />,
  ];
};
