import { fr } from "@codegouvfr/react-dsfr";
import Button from "@codegouvfr/react-dsfr/Button";
import { createModal } from "@codegouvfr/react-dsfr/Modal";
import Table from "@codegouvfr/react-dsfr/Table";
import { values } from "ramda";
import { Fragment, useMemo, useState } from "react";
import { HeadingSection, NotificationIndicator } from "react-design-system";
import { createPortal } from "react-dom";
import { useDispatch } from "react-redux";
import {
  type AgencyRight,
  addressDtoToString,
  agencyKindToLabelIncludingIFAndPrepa,
  frontRoutes,
  type User,
  type UserParamsForAgency,
} from "shared";
import { AgencyStatusBadge } from "src/app/components/agency/AgencyStatusBadge";
import { AgencyTag } from "src/app/components/agency/AgencyTag";
import { AgencyUserModificationForm } from "src/app/components/agency/AgencyUserModificationForm";
import { AgencyLineRightsCTAs } from "src/app/components/agency/agencies-table/agency-line/AgencyLineRightsCTAs";
import { agencyRolesToDisplay } from "src/app/contents/userRolesToDisplay";
import { useAppSelector } from "src/app/hooks/reduxHooks";
import { hasCounsellorRoles } from "src/core-logic/domain/agencies/agencies.helpers";
import { fetchAgencySelectors } from "src/core-logic/domain/agencies/fetch-agency/fetchAgency.selectors";
import { fetchAgencySlice } from "src/core-logic/domain/agencies/fetch-agency/fetchAgency.slice";
import { connectedUserSelectors } from "src/core-logic/domain/connected-user/connectedUser.selectors";
import { AgencyLineAdminEmails } from "./agency-line/AgencyLineAdminEmails";

type AgencyRightsTableProps = {
  agencyRights: AgencyRight[];
  user: User;
  title?: string;
  onUserRegistrationCancelledRequested?: (agencyRight: AgencyRight) => void;
} & (
  | {
      onUserUpdateRequested: (userParamsForAgency: UserParamsForAgency) => void;
      modalId: string;
    }
  | { onUserUpdateRequested?: undefined; modalId?: string }
);

export const AgencyRightsTable = ({
  agencyRights,
  user,
  modalId,
  onUserUpdateRequested,
  onUserRegistrationCancelledRequested,
  title,
}: AgencyRightsTableProps) => {
  const dispatch = useDispatch();
  const currentUser = useAppSelector(connectedUserSelectors.currentUser);
  const isBackofficeAdmin = currentUser?.isBackofficeAdmin;
  const [selectedAgencyRight, setSelectedAgencyRight] =
    useState<AgencyRight | null>(null);
  const isLoadingSelectedAgencyUsers = useAppSelector(
    fetchAgencySelectors.isLoading,
  );
  const selectedAgencyUsersById = useAppSelector(
    fetchAgencySelectors.agencyUsers,
  );
  const selectedAgencyHasCounsellorRoles =
    selectedAgencyRight?.agency.id && !isLoadingSelectedAgencyUsers
      ? hasCounsellorRoles({
          users: values(selectedAgencyUsersById),
          agencyId: selectedAgencyRight.agency.id,
        })
      : false;

  const userModal = useMemo(
    () =>
      onUserUpdateRequested && modalId
        ? createModal({
            isOpenedByDefault: false,
            id: modalId,
          })
        : null,
    [modalId, onUserUpdateRequested],
  );

  const onUpdateClicked = (agencyRight: AgencyRight) => {
    if (!userModal) return;
    dispatch(
      fetchAgencySlice.actions.fetchAgencyUsersRequested({
        agencyId: agencyRight.agency.id,
      }),
    );
    setSelectedAgencyRight(agencyRight);
    userModal.open();
  };

  const jsxContent = (
    <>
      <Table
        headers={[
          "Organisme",
          "Type",
          "Administrateurs",
          "Mes Rôles & préférences",
        ]}
        data={agencyRights
          .sort((a, b) => {
            const aIsClosedOrRejected =
              a.agency.status === "closed" || a.agency.status === "rejected";
            const bIsClosedOrRejected =
              b.agency.status === "closed" || b.agency.status === "rejected";

            if (aIsClosedOrRejected && !bIsClosedOrRejected) return 1;
            if (!aIsClosedOrRejected && bIsClosedOrRejected) return -1;

            return a.agency.name.localeCompare(b.agency.name);
          })
          .map((agencyRight) =>
            AgencyRightLine({
              agencyRight,
              user,
              onUpdateClicked: onUserUpdateRequested && onUpdateClicked,
              onRegistrationCancelledClicked:
                onUserRegistrationCancelledRequested,
              isBackofficeAdmin,
            }),
          )}
      />
      {onUserUpdateRequested &&
        userModal &&
        createPortal(
          <userModal.Component title={"Modifier le rôle de l'utilisateur"}>
            {selectedAgencyRight && (
              <AgencyUserModificationForm
                modalId={modalId}
                agencyUser={{
                  agencyId: selectedAgencyRight.agency.id,
                  userId: user.id,
                  roles: selectedAgencyRight.roles,
                  email: user.email,
                  isNotifiedByEmail: selectedAgencyRight.isNotifiedByEmail,
                  isIcUser: !!user.proConnect,
                }}
                closeModal={() => userModal.close()}
                agencyHasRefersTo={
                  !!selectedAgencyRight.agency.refersToAgencyId
                }
                isEmailDisabled={true}
                areRolesDisabled={
                  !isBackofficeAdmin &&
                  !selectedAgencyRight.roles.includes("agency-admin")
                }
                onSubmit={onUserUpdateRequested}
                routeName="myAccount"
                hasCounsellorRoles={selectedAgencyHasCounsellorRoles}
                isFTAgency={
                  selectedAgencyRight.agency.kind === "france-travail"
                }
              />
            )}
          </userModal.Component>,
          document.body,
        )}
    </>
  );

  return title ? (
    <HeadingSection title={title} titleAs="h4">
      {jsxContent}
    </HeadingSection>
  ) : (
    jsxContent
  );
};

const AgencyRightLine = ({
  agencyRight,
  user,
  onUpdateClicked,
  onRegistrationCancelledClicked,
  isBackofficeAdmin,
}: {
  agencyRight: AgencyRight;
  user: User;
  onUpdateClicked?: (agencyRight: AgencyRight) => void;
  onRegistrationCancelledClicked?: (agencyRight: AgencyRight) => void;
  isBackofficeAdmin?: boolean;
}) => [
  <Fragment key={`${agencyRight.agency.id}-agency-infos`}>
    <AgencyTag refersToAgencyName={agencyRight.agency.refersToAgencyName} />
    <AgencyStatusBadge status={agencyRight.agency.status} />
    <br />
    <span>{agencyRight.agency.name}</span>
    <br />
    <span className={fr.cx("fr-hint-text", "fr-mb-1w")}>
      {addressDtoToString(agencyRight.agency.address)}
    </span>
    {agencyRight.roles.includes("agency-admin") && (
      <Button
        key={`${agencyRight.agency.id}-see-agency-link`}
        linkProps={
          frontRoutes.agencyDashboardAgencyDetails({
            agencyId: agencyRight.agency.id,
          }).link
        }
        size="small"
        priority="secondary"
        iconId="fr-icon-arrow-right-line"
      >
        Voir l'organisme
      </Button>
    )}
  </Fragment>,
  agencyKindToLabelIncludingIFAndPrepa[agencyRight.agency.kind],

  <AgencyLineAdminEmails
    key={`${agencyRight.agency.id}-admin-emails`}
    agencyRight={agencyRight}
  />,

  <Fragment key={`${agencyRight.agency.id}-agency-infos`}>
    <div className={fr.cx("fr-mb-1w")}>
      {agencyRight.roles
        .map((role) => agencyRolesToDisplay[role].label)
        .join(", ")}
    </div>
    <div className={fr.cx("fr-mb-1w")}>
      <NotificationIndicator isNotified={agencyRight.isNotifiedByEmail} />
    </div>
    <AgencyLineRightsCTAs
      key={`${agencyRight.agency.id}-rights-ctas`}
      agencyRight={agencyRight}
      onUpdateClicked={onUpdateClicked}
      onRegistrationCancelledClicked={onRegistrationCancelledClicked}
      user={user}
      isBackofficeAdmin={isBackofficeAdmin}
    />
  </Fragment>,
];
