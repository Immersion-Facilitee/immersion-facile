import { fr } from "@codegouvfr/react-dsfr";
import ButtonsGroup from "@codegouvfr/react-dsfr/ButtonsGroup";
import { createModal } from "@codegouvfr/react-dsfr/Modal";
import { values } from "ramda";
import { useState } from "react";
import { createPortal } from "react-dom";
import { useDispatch } from "react-redux";
import {
  type AgencyDtoForAgencyUsersAndAdmins,
  type AgencyRight,
  domElementIds,
  frontRoutes,
  type User,
  type UserParamsForAgency,
} from "shared";
import { AgencyUserModificationForm } from "src/app/components/agency/AgencyUserModificationForm";
import { RejectIcUserRegistrationToAgencyForm } from "src/app/components/agency/RejectIcUserRegistrationToAgencyForm";
import { useAppSelector } from "src/app/hooks/reduxHooks";
import { connectedUsersAdminSlice } from "src/core-logic/domain/admin/connectedUsersAdmin/connectedUsersAdmin.slice";
import { hasCounsellorRoles } from "src/core-logic/domain/agencies/agencies.helpers";
import { fetchAgencySelectors } from "src/core-logic/domain/agencies/fetch-agency/fetchAgency.selectors";
import { fetchAgencySlice } from "src/core-logic/domain/agencies/fetch-agency/fetchAgency.slice";

type IcUserAgenciesToReviewProps = {
  agenciesNeedingReviewForUser: AgencyRight[];
  selectedUser: User;
};
type IcUserAgenciesToReviewModalProps = {
  title: string;
  mode: "register" | "reject";
};

const AgencyReviewForm = ({
  agency,
  selectAgency,
  selectedUser,
  setModalProps,
}: {
  agency: AgencyDtoForAgencyUsersAndAdmins;
  selectedUser: User;
  selectAgency: (agency: AgencyDtoForAgencyUsersAndAdmins) => void;
  setModalProps: (modalProps: IcUserAgenciesToReviewModalProps) => void;
}) => (
  <div className={fr.cx("fr-col-4")}>
    <div className={fr.cx("fr-card")}>
      <div className={fr.cx("fr-card__body")}>
        <div className={fr.cx("fr-card__content")}>
          <h3 className={fr.cx("fr-card__title")}>{agency.name}</h3>
          <p className={fr.cx("fr-card__desc")}>
            {agency.address.streetNumberAndAddress} {agency.address.postcode}{" "}
            {agency.address.city}
          </p>
          <p className={fr.cx("fr-card__desc")}>
            <a
              {...frontRoutes.adminAgencyDetail({ agencyId: agency.id }).link}
              target="_blank"
            >
              Voir les détails de l'agence
            </a>
          </p>
        </div>
        <div className={fr.cx("fr-card__footer")}>
          <ButtonsGroup
            alignment="center"
            inlineLayoutWhen="always"
            buttonsSize="small"
            buttons={[
              {
                type: "button",
                priority: "primary",
                id: `${domElementIds.admin.agencyTab.registerIcUserToAgencyButton}-${agency.id}-${selectedUser.id}`,
                onClick: () => {
                  setModalProps({
                    title: "Rattacher cet utilisateur",
                    mode: "register",
                  });
                  selectAgency(agency);
                  openIcUserRegistrationToAgencyModal();
                },
                children: "Valider",
              },
              {
                type: "button",
                priority: "secondary",
                onClick: () => {
                  setModalProps({
                    title: "Refuser le rattachement",
                    mode: "reject",
                  });
                  selectAgency(agency);
                  openIcUserRegistrationToAgencyModal();
                },
                children: "Refuser",
              },
            ]}
          />
        </div>
      </div>
    </div>
  </div>
);

export const IcUserAgenciesToReview = ({
  agenciesNeedingReviewForUser,
  selectedUser,
}: IcUserAgenciesToReviewProps) => {
  const dispatch = useDispatch();
  const [selectedAgency, setSelectedAgency] =
    useState<AgencyDtoForAgencyUsersAndAdmins>();
  const [modalProps, setModalProps] =
    useState<IcUserAgenciesToReviewModalProps | null>(null);
  const selectedAgencyUsersById = useAppSelector(
    fetchAgencySelectors.agencyUsers,
  );
  const selectedAgencyHasCounsellorRoles = selectedAgency?.id
    ? hasCounsellorRoles({
        users: values(selectedAgencyUsersById),
        agencyId: selectedAgency.id,
      })
    : false;

  const onUserRegistrationSubmitted = (
    userParamsForAgency: UserParamsForAgency,
  ) => {
    dispatch(
      connectedUsersAdminSlice.actions.registerAgencyWithRoleToUserRequested({
        ...userParamsForAgency,
        feedbackTopic: "agency-users-to-review",
      }),
    );
  };

  const selectAgency = (agency: AgencyDtoForAgencyUsersAndAdmins) => {
    setSelectedAgency(agency);
    dispatch(
      fetchAgencySlice.actions.fetchAgencyUsersRequested({
        agencyId: agency.id,
      }),
    );
  };

  return (
    <div className={fr.cx("fr-grid-row", "fr-grid-row--gutters")}>
      {agenciesNeedingReviewForUser.map(({ agency }) => (
        <AgencyReviewForm
          key={agency.id}
          agency={agency}
          selectAgency={selectAgency}
          setModalProps={setModalProps}
          selectedUser={selectedUser}
        />
      ))}
      {createPortal(
        <IcUserRegistrationToAgencyModal title={modalProps?.title}>
          {selectedAgency && modalProps ? (
            modalProps.mode === "reject" ? (
              <RejectIcUserRegistrationToAgencyForm
                agency={{ id: selectedAgency.id, name: selectedAgency.name }}
                userId={selectedUser.id}
                key={`${selectedAgency.id}-${selectedUser.id}`}
                onSubmit={closeIcUserRegistrationToAgencyModal}
              />
            ) : (
              <AgencyUserModificationForm
                modalId={userRegistrationToAgencyModalConfig.id}
                agencyUser={{
                  agencyId: selectedAgency.id,
                  userId: selectedUser.id,
                  email: selectedUser.email,
                  roles: ["to-review"],
                  isIcUser: true,
                  isNotifiedByEmail: true,
                }}
                closeModal={closeIcUserRegistrationToAgencyModal}
                onSubmit={onUserRegistrationSubmitted}
                agencyHasRefersTo={!!selectedAgency.refersToAgencyId}
                routeName="adminAgencies"
                hasCounsellorRoles={selectedAgencyHasCounsellorRoles}
                isFTAgency={selectedAgency.kind === "france-travail"}
              />
            )
          ) : (
            "Pas d'agence sélectionnée"
          )}
        </IcUserRegistrationToAgencyModal>,
        document.body,
      )}
    </div>
  );
};

const userRegistrationToAgencyModalConfig = {
  isOpenedByDefault: false,
  id: domElementIds.admin.agencyTab.userRegistrationToAgencyModal,
};

const {
  Component: IcUserRegistrationToAgencyModal,
  open: openIcUserRegistrationToAgencyModal,
  close: closeIcUserRegistrationToAgencyModal,
} = createModal(userRegistrationToAgencyModalConfig);
