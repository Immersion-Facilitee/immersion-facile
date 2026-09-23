import { fr } from "@codegouvfr/react-dsfr";
import Tabs from "@codegouvfr/react-dsfr/Tabs";
import ToggleSwitch from "@codegouvfr/react-dsfr/ToggleSwitch";
import type { ReactNode } from "react";
import { Loader, useScrollTo } from "react-design-system";
import { useDispatch } from "react-redux";
import {
  type ConnectedUser,
  domElementIds,
  frontRoutes,
  partitionUserEstablishmentRightsByStatus,
} from "shared";
import { Feedback } from "src/app/components/feedback/Feedback";
import { useFeedbackTopic } from "src/app/hooks/feedback.hooks";
import { useAppSelector } from "src/app/hooks/reduxHooks";
import { connectedUsersAdminSelectors } from "src/core-logic/domain/admin/connectedUsersAdmin/connectedUsersAdmin.selectors";
import { connectedUsersAdminSlice } from "src/core-logic/domain/admin/connectedUsersAdmin/connectedUsersAdmin.slice";
import { connectedUserSelectors } from "src/core-logic/domain/connected-user/connectedUser.selectors";
import { feedbackSlice } from "src/core-logic/domain/feedback/feedback.slice";
import { match } from "ts-pattern";
import type { Route } from "type-route";
import { AgenciesTablesSection } from "../agency/agencies-table/AgenciesTablesSection";
import { EstablishmentsTablesSection } from "../establishment/establishments-table/EstablishmentsTablesSection";
import { PersonnalInformationsSection } from "./PersonnalInformationsSection";

type UserProfileAllowedRouteNames = Route<
  | typeof frontRoutes.adminUserDetailAgencies
  | typeof frontRoutes.adminUserDetailEstablishments
>["name"];

type UserProfileTabId = "establishments" | "agencies";

type UserProfileTab = {
  tabId: UserProfileTabId;
  label: string;
  content: ReactNode;
};

type UserProfileProps = {
  title: string;
  userWithRights: ConnectedUser;
  routeName: UserProfileAllowedRouteNames;
};

const adminTabChange =
  (userId: string) =>
  (tabId: UserProfileTabId): void =>
    match(tabId)
      .with("agencies", () =>
        frontRoutes.adminUserDetailAgencies({ userId }).push(),
      )
      .with("establishments", () =>
        frontRoutes.adminUserDetailEstablishments({ userId }).push(),
      )
      .exhaustive();

const tabIdByRouteName: Record<UserProfileAllowedRouteNames, UserProfileTabId> =
  {
    adminUserDetailAgencies: "agencies",
    adminUserDetailEstablishments: "establishments",
  };

export const UserProfile = ({
  title,
  userWithRights,
  routeName,
}: UserProfileProps) => {
  const dispatch = useDispatch();
  const currentUser = useAppSelector(connectedUserSelectors.currentUser);
  const isUpdatingPreventToDelete = useAppSelector(
    connectedUsersAdminSelectors.isUpdatingUserPreventToDelete,
  );

  useScrollTo(!!useFeedbackTopic("agency-user-right-self"));

  const { acceptedUserEstablishmentsRights, pendingUserEstablishmentsRights } =
    partitionUserEstablishmentRightsByStatus(userWithRights.establishments);

  const allDisplayedEstablishmentsRights = [
    ...acceptedUserEstablishmentsRights,
    ...pendingUserEstablishmentsRights,
  ];

  const userAgenciesRights = userWithRights.agencyRights;

  const currentTab = tabIdByRouteName[routeName];
  const onTabChange = adminTabChange(userWithRights.id);

  const tabs: UserProfileTab[] = [
    {
      tabId: "agencies",
      label: `Organismes (${userAgenciesRights.length})`,
      content:
        userAgenciesRights.length === 0 ? (
          adminEmptyContent.agencies
        ) : (
          <>
            <AgenciesTablesSection
              user={userWithRights}
              agencyRights={userWithRights.agencyRights}
            />
          </>
        ),
    },
    {
      tabId: "establishments",
      label: `Entreprises (${allDisplayedEstablishmentsRights.length})`,
      content:
        allDisplayedEstablishmentsRights.length === 0 ? (
          adminEmptyContent.establishments
        ) : (
          <>
            {pendingUserEstablishmentsRights.length > 0 && (
              <>
                <h3 className={fr.cx("fr-h5", "fr-mt-2w")}>
                  Mes demandes d'accès envoyées
                </h3>
                <EstablishmentsTablesSection
                  withEstablishmentData={pendingUserEstablishmentsRights}
                  isBackofficeAdmin={currentUser?.isBackofficeAdmin}
                />
              </>
            )}
            {acceptedUserEstablishmentsRights.length > 0 && (
              <>
                <h3 className={fr.cx("fr-h5", "fr-mt-2w")}>
                  Mes rattachements entreprises
                </h3>
                <EstablishmentsTablesSection
                  withEstablishmentData={acceptedUserEstablishmentsRights}
                  isBackofficeAdmin={currentUser?.isBackofficeAdmin}
                />
              </>
            )}
          </>
        ),
    },
  ];

  const showPreventToDeleteToggle = !!currentUser?.isBackofficeAdmin;

  return (
    <div>
      {isUpdatingPreventToDelete && <Loader />}
      <div className={fr.cx("fr-grid-row")}>
        <h1 className={fr.cx("fr-col-12", "fr-col-md")}>{title}</h1>
      </div>
      {showPreventToDeleteToggle && (
        <div className={fr.cx("fr-my-2w")}>
          <Feedback
            topics={["user-prevent-to-delete"]}
            className="fr-my-2w"
            closable
          />
          <ToggleSwitch
            id={domElementIds.admin.userDetail.preventToDeleteToggle}
            label="Exclure de la suppression automatique"
            helperText="Empêche le traitement RGPD de ce compte après 2 ans d'inactivité. À utiliser pour les adresses génériques."
            checked={userWithRights.preventToDelete}
            disabled={isUpdatingPreventToDelete}
            onChange={(preventToDelete) => {
              dispatch(
                feedbackSlice.actions.clearFeedbackTopics([
                  "user-prevent-to-delete",
                ]),
              );
              dispatch(
                connectedUsersAdminSlice.actions.updateUserPreventToDeleteRequested(
                  {
                    userId: userWithRights.id,
                    preventToDelete,
                    feedbackTopic: "user-prevent-to-delete",
                  },
                ),
              );
            }}
          />
        </div>
      )}
      <PersonnalInformationsSection user={userWithRights} />
      <h2 className={fr.cx("fr-h4", "fr-mt-4w")}>Mes rattachements</h2>
      <Tabs
        onTabChange={(tabId) => onTabChange(tabId as UserProfileTabId)}
        selectedTabId={currentTab}
        tabs={tabs.map((tab) => ({
          ...tab,
          isDefault: tab.tabId === currentTab,
        }))}
      >
        {tabs.find((tab) => tab.tabId === currentTab)?.content}
      </Tabs>
    </div>
  );
};

const adminEmptyContent: Record<UserProfileTabId, ReactNode> = {
  agencies: <p>Cet utilisateur n'est rattaché à aucune agence</p>,
  establishments: <p>Cet utilisateur n'est rattaché à aucune entreprise</p>,
};
