import { fr } from "@codegouvfr/react-dsfr";
import Button from "@codegouvfr/react-dsfr/Button";
import Highlight from "@codegouvfr/react-dsfr/Highlight";
import Tabs from "@codegouvfr/react-dsfr/Tabs";
import { equals } from "ramda";
import { type ReactNode, useMemo } from "react";
import { HeadingSection, SectionHighlight } from "react-design-system";
import {
  type ConnectedUser,
  domElementIds,
  type EstablishmentDashboardTab,
  establishmentDashboardTabsList,
  frontRoutes,
  immersionFacileHelpdeskRootUrl,
  onlyAdminUserRightsWithStatusAccepted,
  partitionEstablishmentRightsByStatus,
  type UserEstablishmentRightDetails,
} from "shared";
import { ConventionTemplatesList } from "src/app/components/agency/agency-dashboard/ConventionTemplatesList";
import { useAppSelector } from "src/app/hooks/reduxHooks";
import { useFeatureFlags } from "src/app/hooks/useFeatureFlags";
import type {
  EstablishmentDashboardRouteName,
  FrontEstablishmentDashboardRoute,
} from "src/app/pages/auth/ConnectedPrivateRoutePage";
import { InitiateConventionButton } from "src/app/pages/establishment-dashboard/InitiateConventionButton";
import { ManageEstablishmentsTab } from "src/app/pages/establishment-dashboard/ManageEstablishmentTab";
import type { DashboardTab } from "src/app/utils/dashboard";
import { commonIllustrations } from "src/assets/img/illustrations";
import { discussionSelectors } from "src/core-logic/domain/discussion/discussion.selectors";
import { initialDiscussionsWithPagination } from "src/core-logic/domain/discussion/discussion.slice";
import { DiscussionTabContent } from "../../discussion/DiscussionTabContent";
import { MetabaseView } from "../../MetabaseView";
import { SelectConventionFromIdForm } from "../../SelectConventionFromIdForm";

type EstablishmentDashboardTabsProps = {
  currentUser: ConnectedUser;
  route: FrontEstablishmentDashboardRoute;
};

export const EstablishmentDashboardTabs = ({
  currentUser,
  route,
}: EstablishmentDashboardTabsProps): ReactNode => {
  const currentTab = useMemo(
    () => establishmentDashboardTabFromRouteName[route.name],
    [route.name],
  );
  const { data: discussions, filters: discussionsFilters } = useAppSelector(
    discussionSelectors.discussionsWithPagination,
  );
  const filteredDiscussions = discussions.filter(
    (discussions) => !discussions.isEstablishmentBanned,
  );
  const filtersAreEmpty = equals(
    discussionsFilters,
    initialDiscussionsWithPagination.filters,
  );
  const userHasDiscussions = filteredDiscussions.length > 0 || !filtersAreEmpty;

  const tabs = useMemo(
    () =>
      getDashboardTabs(
        makeEstablishmentDashboardTabs(currentUser, userHasDiscussions),
        currentTab,
      ),
    [currentUser, currentTab, userHasDiscussions],
  );
  const { enableEstablishmentDashboardHighlight } = useFeatureFlags();
  const shouldRedirectToMainTab =
    route.name === "establishmentDashboardFormEstablishment" &&
    route.params.siret &&
    !currentUser.establishments?.some(
      (establishment) =>
        establishment.siret === route.params.siret &&
        establishment.role === "establishment-admin",
    );

  if (shouldRedirectToMainTab) {
    frontRoutes.establishmentDashboard().push();
    return;
  }

  return (
    <>
      {enableEstablishmentDashboardHighlight.isActive && (
        <SectionHighlight>
          <h2 className={fr.cx("fr-h6", "fr-mb-1w")}>
            {enableEstablishmentDashboardHighlight.value.title}
          </h2>
          <p className={fr.cx("fr-text--lg", "fr-mb-2w")}>
            {enableEstablishmentDashboardHighlight.value.message}
          </p>
          <Button
            size="small"
            linkProps={{
              href: enableEstablishmentDashboardHighlight.value.href,
              target: "_blank",
              rel: "noopener noreferrer",
            }}
          >
            {enableEstablishmentDashboardHighlight.value.label}
          </Button>
        </SectionHighlight>
      )}
      <Tabs
        tabs={tabs}
        id={domElementIds.establishmentDashboard.tabContainer}
        className={fr.cx("fr-mt-4w")}
        selectedTabId={currentTab} // shouldn't be necessary as it's handled by isDefault, but typescript complains (should report to react-dsfr)
        onTabChange={(tab) => {
          if (isEstablishmentDashboardTab(tab)) {
            const routeName = establishmentDashboardRouteNameFromTabId[tab];
            frontRoutes[routeName]().push();
          }
        }}
      >
        {tabs.find((tab) => tab.tabId === currentTab)?.content}
      </Tabs>
    </>
  );
};
const filterActiveEstablishmentsForUser = (
  establishment: UserEstablishmentRightDetails,
) =>
  !establishment.isEstablishmentBanned &&
  (onlyAdminUserRightsWithStatusAccepted(establishment) ||
    establishment.status === "PENDING");

const makeEstablishmentDashboardTabs = (
  {
    dashboards: {
      establishments: { conventions },
    },
    establishments,
    isBackofficeAdmin,
  }: ConnectedUser,
  userHasDiscussions: boolean,
): DashboardTab[] => {
  const establishmentsArray = establishments
    ? establishments.filter(filterActiveEstablishmentsForUser)
    : [];
  const { pendingEstablishmentRights } =
    partitionEstablishmentRightsByStatus(establishments);
  const userIsOnboarding = establishmentsArray.length === 0;
  const userCanManageEstablishments = establishmentsArray.length > 0;

  return [
    {
      label: "Conventions",
      tabId: "conventions",
      content: (
        <>
          <HeadingSection
            title="Piloter une convention"
            titleAs="h2"
            titleAction={<InitiateConventionButton />}
            className={fr.cx("fr-mt-0")}
          >
            <SelectConventionFromIdForm routeNameToRedirectTo="manageConventionConnectedUser" />
          </HeadingSection>
          {conventions ? (
            <MetabaseView
              title={"Tableau des conventions en cours"}
              subtitle="Cliquer sur l'identifiant de la convention pour y accéder."
              url={conventions}
            />
          ) : (
            <p> Aucune convention trouvée pour votre compte</p>
          )}
          <ConventionTemplatesList
            fromRoute={frontRoutes.establishmentDashboard()}
          />
        </>
      ),
    },
    ...(userHasDiscussions
      ? [
          {
            label: "Candidatures",
            tabId: "discussions",
            content: <DiscussionTabContent viewer="establishment" />,
          },
        ]
      : []),
    ...(userCanManageEstablishments
      ? [
          {
            label:
              establishmentsArray.length > 1
                ? "Mes établissements"
                : "Mon établissement",
            tabId: "fiche-entreprise",
            content: (
              <ManageEstablishmentsTab
                establishments={establishmentsArray.filter(
                  (establishment) =>
                    establishment.role === "establishment-admin",
                )}
                pendingEstablishmentRights={pendingEstablishmentRights}
                isBackofficeAdmin={isBackofficeAdmin}
              />
            ),
          },
        ]
      : []),
    ...(userIsOnboarding
      ? [
          {
            label: "Candidatures",
            tabId: "discussions",
            content: <OnboardingTabContent />,
          },
          {
            label: "Mon établissement",
            tabId: "fiche-entreprise",
            content: <OnboardingTabContent />,
          },
        ]
      : []),
  ];
};

const getDashboardTabs = (
  rawTabs: DashboardTab[],
  currentTab: EstablishmentDashboardTab,
) =>
  rawTabs.map((tab) => ({
    ...tab,
    tabId: tab.tabId,
    isDefault: currentTab === tab.tabId,
  }));

const establishmentDashboardTabFromRouteName: Record<
  EstablishmentDashboardRouteName,
  EstablishmentDashboardTab
> = {
  establishmentDashboard: "conventions",
  establishmentDashboardConventions: "conventions",
  establishmentDashboardFormEstablishment: "fiche-entreprise",
  establishmentDashboardDiscussions: "discussions",
};

const establishmentDashboardRouteNameFromTabId: Record<
  EstablishmentDashboardTab,
  EstablishmentDashboardRouteName
> = {
  conventions: "establishmentDashboard",
  discussions: "establishmentDashboardDiscussions",
  "fiche-entreprise": "establishmentDashboardFormEstablishment",
};

const isEstablishmentDashboardTab = (
  input: string,
): input is EstablishmentDashboardTab =>
  establishmentDashboardTabsList.includes(input as EstablishmentDashboardTab);

const OnboardingTabContent = () => (
  <section className={fr.cx("fr-grid-row", "fr-grid-row--center")}>
    <div className={fr.cx("fr-col-12", "fr-col-lg-7")}>
      <h3>Accès limité</h3>
      <p>
        Cet onglet n’est pas accessible car aucune entreprise n’est actuellement
        rattachée à ce compte.
      </p>
      <p>Cette situation peut se produire dans les cas suivants :</p>
      <ul>
        <li>l’entreprise n’a pas encore été créée sur Immersion Facilitée,</li>
        <li>
          une autre adresse email est enregistrée comme contact de l’entreprise,
        </li>
        <li>
          un administrateur de l’entreprise ne vous a pas encore ajouté comme
          utilisateur.
        </li>
      </ul>
      <p>
        Cet espace reste pleinement utilisable pour le suivi des conventions
        auxquelles ce compte est associé.
      </p>
      <Highlight className={fr.cx("fr-ml-0")}>
        <strong>Besoin d’aide ?</strong> N’hésitez pas à{" "}
        <a
          href={immersionFacileHelpdeskRootUrl}
          target="_blank"
          rel="noreferrer"
        >
          contacter le support
        </a>
        ou lire notre article d’aide sur{" "}
        <a
          href={`${immersionFacileHelpdeskRootUrl}/article/comment-referencer-mon-entreprise-en-tant-quentreprise-accueillante-zr6rxv/`}
          target="_blank"
          rel="noreferrer"
        >
          le référencement d’une entreprise
        </a>
        .
      </Highlight>
      <Button
        {...frontRoutes.formEstablishment().link}
        iconId="fr-icon-add-line"
        iconPosition="left"
      >
        Créer une entreprise
      </Button>
    </div>
    <div
      className={fr.cx(
        "fr-col-12",
        "fr-col-lg-5",
        "fr-hidden",
        "fr-unhidden-lg",
        "fr-px-12w",
        "fr-py-4w",
        "fr-grid-row--middle",
      )}
    >
      <div>
        <img src={commonIllustrations.errorMissing} alt="Accès limité" />
      </div>
    </div>
  </section>
);
