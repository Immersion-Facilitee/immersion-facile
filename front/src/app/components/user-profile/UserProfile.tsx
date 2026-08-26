import { fr } from "@codegouvfr/react-dsfr";
import Button from "@codegouvfr/react-dsfr/Button";
import Highlight from "@codegouvfr/react-dsfr/Highlight";
import Tabs from "@codegouvfr/react-dsfr/Tabs";
import ToggleSwitch from "@codegouvfr/react-dsfr/ToggleSwitch";
import type { ReactNode } from "react";
import { Loader, useScrollTo } from "react-design-system";
import { useDispatch } from "react-redux";
import {
  type ConnectedUser,
  domElementIds,
  frontRoutes,
  type UserId,
} from "shared";
import { Feedback } from "src/app/components/feedback/Feedback";
import { ressourcesAndWebinarsUrl } from "src/app/contents/home/content";
import { useFeedbackTopic } from "src/app/hooks/feedback.hooks";
import { useAppSelector } from "src/app/hooks/reduxHooks";
import { commonIllustrations } from "src/assets/img/illustrations";
import { updateUserPreventToDeleteSelectors } from "src/core-logic/domain/admin/updateUserPreventToDelete/updateUserPreventToDelete.selectors";
import { updateUserPreventToDeleteSlice } from "src/core-logic/domain/admin/updateUserPreventToDelete/updateUserPreventToDelete.slice";
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
  | typeof frontRoutes.myAccountAgencies
  | typeof frontRoutes.myAccountEstablishments
>["name"];

type UserProfileTabId = "establishments" | "agencies";

type UserProfileTab = {
  tabId: UserProfileTabId;
  label: string;
  content: ReactNode;
};

type RouteConfig = {
  tabId: UserProfileTabId;
  showRegistrationButtons: boolean;
  onTabChange: (tabId: UserProfileTabId) => void;
  emptyContent: Record<UserProfileTabId, ReactNode>;
};

type UserProfileProps = {
  title: string;
  userWithRights: ConnectedUser;
  editInformationsLink?: string;
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

const myProfileTabChange = (tabId: UserProfileTabId): void =>
  match(tabId)
    .with("agencies", () => frontRoutes.myAccountAgencies().push())
    .with("establishments", () => frontRoutes.myAccountEstablishments().push())
    .exhaustive();

const getRouteConfig = (
  routeName: UserProfileAllowedRouteNames,
  userId: UserId,
): RouteConfig =>
  match(routeName)
    .returnType<RouteConfig>()
    .with("adminUserDetailAgencies", () => ({
      tabId: "agencies",
      showRegistrationButtons: false,
      onTabChange: adminTabChange(userId),
      emptyContent: adminEmptyContent,
    }))
    .with("adminUserDetailEstablishments", () => ({
      tabId: "establishments",
      showRegistrationButtons: false,
      onTabChange: adminTabChange(userId),
      emptyContent: adminEmptyContent,
    }))
    .with("myAccountAgencies", () => ({
      tabId: "agencies",
      showRegistrationButtons: true,
      onTabChange: myProfileTabChange,
      emptyContent: myProfileEmptyContent,
    }))
    .with("myAccountEstablishments", () => ({
      tabId: "establishments",
      showRegistrationButtons: true,
      onTabChange: myProfileTabChange,
      emptyContent: myProfileEmptyContent,
    }))
    .exhaustive();

export const UserProfile = ({
  title,
  userWithRights,
  editInformationsLink,
  routeName,
}: UserProfileProps) => {
  const dispatch = useDispatch();
  const currentUser = useAppSelector(connectedUserSelectors.currentUser);
  const isUpdatingPreventToDelete = useAppSelector(
    updateUserPreventToDeleteSelectors.isLoading,
  );

  useScrollTo(!!useFeedbackTopic("agency-user-right-self"));

  const acceptedUserEstablishmentsRights =
    userWithRights.establishments?.filter(
      (userEstablishment) => userEstablishment.status === "ACCEPTED",
    ) || [];

  const pendingUserEstablishmentsRights =
    userWithRights.establishments?.filter(
      (userEstablishment) => userEstablishment.status === "PENDING",
    ) || [];

  const allDisplayedEstablishmentsRights = [
    ...acceptedUserEstablishmentsRights,
    ...pendingUserEstablishmentsRights,
  ];

  const userAgenciesRights = userWithRights.agencyRights;

  const {
    tabId: currentTab,
    showRegistrationButtons: showAddButtons,
    onTabChange,
    emptyContent,
  } = getRouteConfig(routeName, userWithRights.id);

  const tabs: UserProfileTab[] = [
    {
      tabId: "agencies",
      label: `Organismes (${userAgenciesRights.length})`,
      content:
        userAgenciesRights.length === 0 ? (
          emptyContent.agencies
        ) : (
          <>
            {showAddButtons && (
              <div className={fr.cx("fr-grid-row")}>
                <Button
                  id={domElementIds.myAccount.registerAgenciesSearchLink}
                  priority="primary"
                  linkProps={{
                    href: `${frontRoutes.myAccountAgencyRegistration().href}`,
                  }}
                  iconId="fr-icon-add-line"
                  className={fr.cx("fr-ml-auto")}
                >
                  Se rattacher à un organisme
                </Button>
              </div>
            )}
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
          emptyContent.establishments
        ) : (
          <>
            {showAddButtons && (
              <div className={fr.cx("fr-grid-row")}>
                <Button
                  id={
                    domElementIds.myAccountEstablishmentRegistration
                      .registerEstablishmentButton
                  }
                  priority="primary"
                  linkProps={
                    frontRoutes.myAccountEstablishmentRegistration({}).link
                  }
                  className={fr.cx("fr-ml-auto")}
                  iconId="fr-icon-add-line"
                >
                  Se rattacher à une entreprise
                </Button>
              </div>
            )}
            {pendingUserEstablishmentsRights.length > 0 && (
              <>
                <h3 className={fr.cx("fr-h5", "fr-mt-2w")}>
                  Demandes d'accès en cours
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

  const showPreventToDeleteToggle =
    (routeName === "adminUserDetailAgencies" ||
      routeName === "adminUserDetailEstablishments") &&
    !!currentUser?.isBackofficeAdmin;

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
                updateUserPreventToDeleteSlice.actions.updateUserPreventToDeleteRequested(
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
      <PersonnalInformationsSection
        user={userWithRights}
        editInformationsLink={editInformationsLink}
      />
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

const myProfileEmptyContent: Record<UserProfileTabId, ReactNode> = {
  agencies: (
    <div
      className={fr.cx(
        "fr-grid-row",
        "fr-grid-row--gutters",
        "fr-grid-row--middle",
      )}
    >
      <div className={fr.cx("fr-col-12", "fr-col-md-8")}>
        <h2 className={fr.cx("fr-h4", "fr-mt-2w")}>
          Vous n'êtes rattaché(e) à aucun organisme
        </h2>
        <p>Vous n'êtes actuellement rattaché(e) à aucun organisme.</p>
        <p>
          Un organisme (France Travail, Mission Locale, Cap emploi, Conseil
          Départemental, etc.) permet de valider les conventions d'immersion ou
          encore de suivre les immersions.
        </p>
        <Highlight className={fr.cx("fr-ml-0")} size="sm">
          Vous pourrez d'abord vérifier si votre organisme existe déjà pour
          demander à y être rattaché(e). S'il n'existe pas encore, vous serez
          guidé(e) vers le formulaire de création.
        </Highlight>
        <Button
          id={domElementIds.myAccount.registerAgencyButton}
          priority="primary"
          linkProps={frontRoutes.myAccountAgencyRegistration().link}
          className={fr.cx("fr-ml-auto")}
          iconId="fr-icon-add-line"
        >
          Se rattacher à un organisme
        </Button>
      </div>
      <div
        className={fr.cx(
          "fr-col-12",
          "fr-col-md-4",
          "fr-hidden",
          "fr-unhidden-md",
        )}
      >
        <img src={commonIllustrations.discussions} alt="Accès limité" />
      </div>
    </div>
  ),
  establishments: (
    <div
      className={fr.cx(
        "fr-grid-row",
        "fr-grid-row--gutters",
        "fr-grid-row--middle",
      )}
    >
      <div className={fr.cx("fr-col-12", "fr-col-md-8")}>
        <h2 className={fr.cx("fr-h4", "fr-mt-2w")}>
          Vous n'êtes rattaché(e) à aucune entreprise
        </h2>
        <p>
          Vous n'êtes actuellement rattaché(e) à aucune entreprise accueillante.
        </p>
        <p>
          Être rattaché(e) à une entreprise permet de gérer les offres
          d'immersion, accéder aux mises en relation et suivre les immersions.
        </p>
        <Highlight className={fr.cx("fr-ml-0")} size="sm">
          Vous pourrez d'abord vérifier si votre entreprise existe déjà pour
          demander à y être rattaché(e). Si elle n'existe pas encore, vous serez
          guidé(e) vers le formulaire de création.
        </Highlight>
        <p className={fr.cx("fr-text--xs")}>
          Besoin d'aide pour référencer votre entreprise ?{" "}
          <a
            className={fr.cx("fr-download__link")}
            href={ressourcesAndWebinarsUrl}
            aria-label="Transcription textuelle, téléchargement en format texte"
          >
            Participez à notre webinaire
          </a>
        </p>
        <Button
          id={
            domElementIds.myAccountEstablishmentRegistration
              .registerEstablishmentButton
          }
          priority="primary"
          linkProps={frontRoutes.myAccountEstablishmentRegistration().link}
          className={fr.cx("fr-ml-auto")}
          iconId="fr-icon-add-line"
        >
          Se rattacher à une entreprise
        </Button>
      </div>
      <div
        className={fr.cx(
          "fr-col-12",
          "fr-col-md-4",
          "fr-hidden",
          "fr-unhidden-md",
        )}
      >
        <img src={commonIllustrations.structureAccueil} alt="Accès limité" />
      </div>
    </div>
  ),
};
