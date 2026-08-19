import { fr } from "@codegouvfr/react-dsfr";
import Button from "@codegouvfr/react-dsfr/Button";
import { createModal } from "@codegouvfr/react-dsfr/Modal";
import { partition, values } from "ramda";
import { Fragment, useMemo, useState } from "react";
import { Tag } from "react-design-system";
import { createPortal } from "react-dom";
import { useDispatch } from "react-redux";
import {
  type AgencyDto,
  domElementIds,
  type UserParamsForAgency,
} from "shared";
import { AgencyUserModificationForm } from "src/app/components/agency/AgencyUserModificationForm";
import { AgencyUsersTable } from "src/app/components/agency/AgencyUsersTable";
import { UsersWithoutNameHint } from "src/app/components/agency/UsersWithoutNameHint";
import type { AgencyOverviewRouteName } from "src/app/components/forms/agency/AgencyOverview";
import {
  type ConnectedUsersWithNormalizedAgencyRightsById,
  type ConnectedUserWithNormalizedAgencyRights,
  connectedUsersAdminSlice,
} from "src/core-logic/domain/admin/connectedUsersAdmin/connectedUsersAdmin.slice";
import { createUserOnAgencySlice } from "src/core-logic/domain/agencies/create-user-on-agency/createUserOnAgency.slice";
import { updateUserOnAgencySlice } from "src/core-logic/domain/agencies/update-user-on-agency/updateUserOnAgency.slice";
import { feedbackSlice } from "src/core-logic/domain/feedback/feedback.slice";
import { v4 as uuidV4 } from "uuid";
import { Feedback } from "../feedback/Feedback";

type AgencyUsersProperties = {
  agency: AgencyDto;
  agencyUsersById: ConnectedUsersWithNormalizedAgencyRightsById;
  routeName: AgencyOverviewRouteName;
};

export const AgencyUsers = ({
  agency,
  agencyUsersById,
  routeName,
}: AgencyUsersProperties) => {
  const isLocationAdmin =
    routeName === "adminAgencies" || routeName === "adminAgencyDetail";

  const manageUserModalId = isLocationAdmin
    ? domElementIds.admin.agencyTab.editAgencyManageUserModal
    : domElementIds.agencyDashboard.agencyDetails.editAgencyManageUserModal;
  const manageUserModal = useMemo(
    () =>
      createModal({
        isOpenedByDefault: false,
        id: manageUserModalId,
      }),
    [manageUserModalId],
  );

  const dispatch = useDispatch();

  const [selectedUserData, setSelectedUserData] = useState<
    (UserParamsForAgency & { isIcUser: boolean }) | null
  >(null);

  const [mode, setMode] = useState<"add" | "update" | null>(null);

  const onModifyClicked = (
    agencyUser: ConnectedUserWithNormalizedAgencyRights,
  ) => {
    dispatch(feedbackSlice.actions.clearFeedbacksTriggered());
    setMode("update");
    setSelectedUserData({
      agencyId: agency.id,
      userId: agencyUser.id,
      roles: agencyUser.agencyRights[agency.id].roles,
      email: agencyUser.email,
      isNotifiedByEmail: agencyUser.agencyRights[agency.id].isNotifiedByEmail,
      isIcUser: !!agencyUser.proConnect,
    });
    manageUserModal.open();
  };

  const agencyRefersToOtherAgency = agency.refersToAgencyId !== null;

  const [agencyUsers, agencyUsersInOtherAgency] = agencyRefersToOtherAgency
    ? partition(
        (user) => !user.agencyRights[agency.id].roles.includes("validator"),
        values(agencyUsersById),
      )
    : [values(agencyUsersById), []];

  const hasCounsellorRoles = agencyUsers.some((user) =>
    user.agencyRights[agency.id].roles.includes("counsellor"),
  );

  const onUserUpdateSubmitted = (userParamsForAgency: UserParamsForAgency) => {
    isLocationAdmin
      ? dispatch(
          //TODO split icUsersAdminSlice to not have a big slice for all admin actions
          connectedUsersAdminSlice.actions.updateUserOnAgencyRequested({
            ...userParamsForAgency,
            feedbackTopic: "agency-user",
          }),
        )
      : dispatch(
          updateUserOnAgencySlice.actions.updateUserAgencyRightRequested({
            ...userParamsForAgency,
            feedbackTopic: "agency-user-for-dashboard",
          }),
        );
  };

  const onUserCreationSubmitted = (
    userParamsForAgency: UserParamsForAgency,
  ) => {
    isLocationAdmin
      ? dispatch(
          connectedUsersAdminSlice.actions.createUserOnAgencyRequested({
            ...userParamsForAgency,
            feedbackTopic: "agency-user",
          }),
        )
      : dispatch(
          createUserOnAgencySlice.actions.createUserOnAgencyRequested({
            ...userParamsForAgency,
            feedbackTopic: "agency-user-for-dashboard",
          }),
        );
  };

  return (
    <>
      <h2 className={fr.cx("fr-h5", "fr-mb-1v", "fr-mt-4w")}>Utilisateurs</h2>
      <UsersWithoutNameHint />
      <Feedback
        topics={
          isLocationAdmin ? ["agency-user"] : ["agency-user-for-dashboard"]
        }
      />
      <Button
        iconId="fr-icon-file-add-line"
        className={fr.cx("fr-m-1w", "fr-grid-row--right")}
        priority="primary"
        onClick={() => {
          setMode("add");
          setSelectedUserData({
            agencyId: agency.id,
            userId: uuidV4(),
            roles: [],
            email: "",
            isNotifiedByEmail: true,
            isIcUser: false,
          });
          manageUserModal.open();
        }}
        id={
          isLocationAdmin
            ? domElementIds.admin.agencyTab.openManageUserModalButton
            : domElementIds.agencyDashboard.agencyDetails
                .openManageUserModalButton
        }
      >
        Ajouter un utilisateur
      </Button>

      <div className={fr.cx("fr-mb-1v", "fr-mt-4w")}>
        <span className={fr.cx("fr-h6")}>Utilisateurs de : </span>
        {agency.refersToAgencyName ? (
          <Tag
            theme={"structureAccompagnement"}
            label={`Structure d'accompagnement : ${agency.name}`}
          />
        ) : (
          <Tag theme={"prescripteur"} label={`Prescripteur : ${agency.name}`} />
        )}
      </div>

      <AgencyUsersTable
        agencyUsers={agencyUsers}
        agency={agency}
        onModifyClicked={onModifyClicked}
        routeName={routeName}
      />

      {agency.refersToAgencyName && (
        <>
          <div className={fr.cx("fr-mb-1v", "fr-mt-4w")}>
            <span className={fr.cx("fr-h6")}>Utilisateurs de : </span>
            <Tag
              theme={"prescripteur"}
              label={`Prescripteur : ${agency.refersToAgencyName}`}
            />
          </div>
          <AgencyUsersTable
            agencyUsers={agencyUsersInOtherAgency}
            agency={agency}
            onModifyClicked={onModifyClicked}
            routeName={routeName}
          />
        </>
      )}

      {createPortal(
        <manageUserModal.Component
          title={
            mode === "update"
              ? "Modifier le rôle de l'utilisateur"
              : "Ajouter un utilisateur"
          }
        >
          <Fragment key={`${selectedUserData?.userId}-${mode}`}>
            {selectedUserData && mode && (
              <>
                <h3 className={fr.cx("fr-h5", "fr-text--bold", "fr-text--sm")}>
                  Informations personnelles
                </h3>
                <p className={fr.cx("fr-text--sm")}>
                  {selectedUserData.isIcUser
                    ? `Pour modifier ses informations personnelles, l'utilisateur doit passer par son compte ProConnect créé avec l'email ${selectedUserData.email}`
                    : `Pour ajouter un nom, prénom et mot de passe, l'utilisateur doit se créer un compte 
                  via ProConnect, avec l'email ${selectedUserData.email}.
                  Nous vous déconseillons de créer un compte pour les boites génériques pour conserver la traçabilité des actions sur les demandes de conventions d'immersion.`}
                </p>
                <AgencyUserModificationForm
                  agencyUser={selectedUserData}
                  closeModal={() => manageUserModal.close()}
                  agencyHasRefersTo={!!agency.refersToAgencyId}
                  onSubmit={
                    mode === "add"
                      ? onUserCreationSubmitted
                      : onUserUpdateSubmitted
                  }
                  routeName={routeName}
                  hasCounsellorRoles={hasCounsellorRoles}
                  modalId={manageUserModalId}
                  isFTAgency={agency.kind === "france-travail"}
                />
              </>
            )}
          </Fragment>
        </manageUserModal.Component>,
        document.body,
      )}
    </>
  );
};
