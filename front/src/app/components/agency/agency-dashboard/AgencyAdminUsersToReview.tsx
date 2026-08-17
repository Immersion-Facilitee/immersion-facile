import { fr } from "@codegouvfr/react-dsfr";
import ButtonsGroup from "@codegouvfr/react-dsfr/ButtonsGroup";
import { createModal } from "@codegouvfr/react-dsfr/Modal";
import Table from "@codegouvfr/react-dsfr/Table";
import { values } from "ramda";
import { useState } from "react";
import { HeadingSection, Loader } from "react-design-system";
import { createPortal } from "react-dom";
import { useDispatch } from "react-redux";
import {
  domElementIds,
  getFormattedFirstnameAndLastname,
  type UserParamsForAgency,
} from "shared";
import { AgencyUserModificationForm } from "src/app/components/agency/AgencyUserModificationForm";
import { RejectIcUserRegistrationToAgencyForm } from "src/app/components/agency/RejectIcUserRegistrationToAgencyForm";
import { Feedback } from "src/app/components/feedback/Feedback";
import { useAppSelector } from "src/app/hooks/reduxHooks";
import { connectedUsersAdminSlice } from "src/core-logic/domain/admin/connectedUsersAdmin/connectedUsersAdmin.slice";
import { hasCounsellorRoles } from "src/core-logic/domain/agencies/agencies.helpers";
import { fetchAgencySelectors } from "src/core-logic/domain/agencies/fetch-agency/fetchAgency.selectors";
import { fetchAgencySlice } from "src/core-logic/domain/agencies/fetch-agency/fetchAgency.slice";
import type { UserToReview } from "src/core-logic/domain/agency-admin/usersToReview/usersToReview.slice";

const userRegistrationToAgencyModalConfig = {
  isOpenedByDefault: false,
  id: domElementIds.agencyDashboardAgencies.userRegistrationToAgency.modal,
};

const {
  Component: UserRegistrationToAgencyModal,
  open: openUserRegistrationToAgencyModal,
  close: closeUserRegistrationToAgencyModal,
} = createModal(userRegistrationToAgencyModalConfig);

type ReviewActionProps = {
  userToReview: UserToReview;
  action: "register" | "reject";
};

export const AgencyAdminUsersToReview = ({
  usersToReview,
}: {
  usersToReview: UserToReview[];
}) => {
  const dispatch = useDispatch();
  const [reviewActionProps, setReviewActionProps] =
    useState<ReviewActionProps | null>(null);

  const isLoadingSelectedAgencyUsers = useAppSelector(
    fetchAgencySelectors.isLoading,
  );
  const selectedAgencyUsers = useAppSelector(fetchAgencySelectors.agencyUsers);
  const selectedAgencyId = reviewActionProps?.userToReview.agency.id;
  const selectedAgencyHasCounsellorRoles =
    selectedAgencyId && !isLoadingSelectedAgencyUsers
      ? hasCounsellorRoles({
          users: values(selectedAgencyUsers),
          agencyId: selectedAgencyId,
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

  return (
    <>
      {isLoadingSelectedAgencyUsers && <Loader />}
      <HeadingSection
        className={fr.cx("fr-mt-0")}
        title="Demandes de rattachement"
        titleAs="h2"
      >
        <Feedback topics={["agency-users-to-review"]} closable />
        {usersToReview.length > 0 ? (
          <Table
            fixed
            headers={["Utilisateur", "Organisme demandé", "Actions"]}
            data={usersToReview.map((userToReview) =>
              TableLine({
                userToReview,
                onActionClick: (param: ReviewActionProps) => {
                  setReviewActionProps(param);
                  if (param.action === "register") {
                    dispatch(
                      fetchAgencySlice.actions.fetchAgencyUsersRequested({
                        agencyId: userToReview.agency.id,
                        feedbackTopic: "agency-user-for-dashboard",
                      }),
                    );
                  }
                  openUserRegistrationToAgencyModal();
                },
              }),
            )}
          />
        ) : (
          <p>Il n'y a aucune demande en cours.</p>
        )}
      </HeadingSection>
      {createPortal(
        <UserRegistrationToAgencyModal title="Rattacher un utilisateur à un organisme">
          {reviewActionProps &&
            reviewActionProps.action === "register" &&
            !isLoadingSelectedAgencyUsers && (
              <AgencyUserModificationForm
                modalId={userRegistrationToAgencyModalConfig.id}
                agencyUser={{
                  agencyId: reviewActionProps.userToReview.agency.id,
                  userId: reviewActionProps.userToReview.id,
                  email: reviewActionProps.userToReview.email,
                  roles: ["to-review"],
                  isNotifiedByEmail: false,
                  isIcUser: true,
                }}
                closeModal={closeUserRegistrationToAgencyModal}
                onSubmit={onUserRegistrationSubmitted}
                agencyHasRefersTo={
                  !!reviewActionProps.userToReview.agency.refersToAgencyId
                }
                routeName="adminAgencies"
                hasCounsellorRoles={selectedAgencyHasCounsellorRoles}
                isFTAgency={
                  reviewActionProps.userToReview.agency.kind ===
                  "france-travail"
                }
              />
            )}
          {reviewActionProps && reviewActionProps.action === "reject" && (
            <RejectIcUserRegistrationToAgencyForm
              agency={{
                id: reviewActionProps.userToReview.agency.id,
                name: reviewActionProps.userToReview.agency.name,
              }}
              userId={reviewActionProps.userToReview.id}
              onSubmit={closeUserRegistrationToAgencyModal}
            />
          )}
        </UserRegistrationToAgencyModal>,
        document.body,
      )}
    </>
  );
};

const TableLine = ({
  userToReview,
  onActionClick,
}: {
  userToReview: UserToReview;
  onActionClick: (param: ReviewActionProps) => void;
}) => {
  const userFullname = getFormattedFirstnameAndLastname({
    firstname: userToReview.firstName,
    lastname: userToReview.lastName,
  });

  const userNameAndEmail = (
    <div key={`${userToReview.id}-${userToReview.agency.id}-user`}>
      {userFullname.length > 0 && (
        <p>
          <strong>{userFullname}</strong>
        </p>
      )}
      <p>{userToReview.email}</p>
    </div>
  );

  const agencyName = (
    <p key={`${userToReview.id}-${userToReview.agency.id}-requested-agency`}>
      {userToReview.agency.name}
    </p>
  );

  const buttons = (
    <ButtonsGroup
      key={`${userToReview.id}-${userToReview.agency.id}-buttons`}
      inlineLayoutWhen={"always"}
      buttons={[
        {
          children: "Valider",
          priority: "secondary",
          className: fr.cx("fr-my-1v"),
          onClick: () => onActionClick({ userToReview, action: "register" }),
        },
        {
          children: "Supprimer",
          priority: "secondary",
          className: fr.cx("fr-my-1v"),
          onClick: () => onActionClick({ userToReview, action: "reject" }),
        },
      ]}
    />
  );

  return [userNameAndEmail, agencyName, buttons];
};
