import { fr } from "@codegouvfr/react-dsfr";
import { Button } from "@codegouvfr/react-dsfr/Button";
import Tabs from "@codegouvfr/react-dsfr/Tabs";
import { SectionHighlight } from "react-design-system";
import {
  type AgencyRight,
  activeAgencyStatuses,
  type ConnectedUser,
  domElementIds,
  frontRoutes,
  type WithDashboards,
} from "shared";
import { Feedback } from "src/app/components/feedback/Feedback";
import { useAppSelector } from "src/app/hooks/reduxHooks";
import { useFeatureFlags } from "src/app/hooks/useFeatureFlags";
import {
  type AgencyDashboardRouteName,
  type AgencyTabRoute,
  agencyDashboardTabsList,
  type FrontAgencyDashboardRoute,
} from "src/app/pages/auth/ConnectedPrivateRoutePage";
import type { DashboardTab } from "src/app/utils/dashboard";
import { connectedUserSelectors } from "src/core-logic/domain/connected-user/connectedUser.selectors";
import { MetabaseView } from "../../MetabaseView";
import { AgencyAdminTabContent } from "./tabs/AgencyAdminTabContent";
import { AgencyConventionTabContent } from "./tabs/AgencyConventionTabContent";

export const AgencyDashboard = ({
  route,
  activeAgencyRights,
  dashboards,
}: {
  route: FrontAgencyDashboardRoute;
  activeAgencyRights: AgencyRight[];
} & WithDashboards): JSX.Element => {
  const currentTab = route.name;
  const currentUser = useAppSelector(connectedUserSelectors.currentUser);

  const { enableAgencyDashboardHighlight } = useFeatureFlags();

  if (!currentUser) {
    return <p>Vous n'êtes pas connecté...</p>;
  }

  const agencyTabs = rawAgencyDashboardTabs({
    activeAgencyRights,
    dashboards,
    currentUser,
  });

  return (
    <>
      <Feedback
        topics={["transfer-convention-to-agency"]}
        className="fr-mb-2w"
        closable
      />
      {enableAgencyDashboardHighlight.isActive && (
        <SectionHighlight>
          <h2 className={fr.cx("fr-h6", "fr-mb-1w")}>
            {enableAgencyDashboardHighlight.value.title}
          </h2>
          <p className={fr.cx("fr-text--lg", "fr-mb-2w")}>
            {enableAgencyDashboardHighlight.value.message}
          </p>
          <Button
            size="small"
            linkProps={{
              href: enableAgencyDashboardHighlight.value.href,
              target: "_blank",
              rel: "noopener noreferrer",
            }}
          >
            {enableAgencyDashboardHighlight.value.label}
          </Button>
        </SectionHighlight>
      )}
      <Tabs
        className={fr.cx("fr-mt-4w")}
        style={{ overflow: "visible" }}
        tabs={agencyTabs.map((tab) => ({
          ...tab,
          isDefault: currentTab === tab.tabId,
        }))}
        id={domElementIds.agencyDashboard.dashboard.tabContainer}
        selectedTabId={currentTab}
        onTabChange={(tab) => {
          if (isAgencyDashboardTabRoute(tab)) frontRoutes[tab]().push();
        }}
      >
        {agencyTabs.find((tab) => tab.tabId === currentTab)?.content}
      </Tabs>
    </>
  );
};

const rawAgencyDashboardTabs = ({
  dashboards,
  activeAgencyRights,
  currentUser,
}: {
  activeAgencyRights: AgencyRight[];
  currentUser: ConnectedUser;
} & WithDashboards): DashboardTab[] => {
  const agenciesWithActiveStatus = activeAgencyRights
    .filter(({ agency }) => activeAgencyStatuses.includes(agency.status))
    .map((agencyRight) => agencyRight.agency);

  return [
    ...(dashboards.agencies.agencyDashboardUrl
      ? [
          {
            tabId: "agencyDashboardMain" satisfies AgencyDashboardRouteName,
            label: "Tableau de bord",
            content: (
              <AgencyConventionTabContent
                activeAgencies={agenciesWithActiveStatus}
              />
            ),
          },
        ]
      : []),
    ...(activeAgencyRights.length
      ? [
          {
            tabId: "agencyDashboardAgencies" satisfies AgencyDashboardRouteName,
            label: "Mes Organismes",
            content: (
              <AgencyAdminTabContent
                activeAgencyRights={activeAgencyRights}
                currentUser={currentUser}
              />
            ),
          },
        ]
      : []),
    ...(dashboards.agencies.agencyManagement
      ? [
          {
            tabId: "agencyManagement" satisfies AgencyDashboardRouteName,
            label: "Pilotage de ma structure",
            content: (
              <MetabaseView
                title="Pilotage de ma structure"
                url={dashboards.agencies.agencyManagement}
              />
            ),
          },
        ]
      : []),
    ...(dashboards.agencies.statsEstablishmentDetailsUrl
      ? [
          {
            tabId:
              "statsEstablishmentDetails" satisfies AgencyDashboardRouteName,
            label: "Activités par entreprise",
            content: (
              <MetabaseView
                title="Détails par entreprise"
                url={dashboards.agencies.statsEstablishmentDetailsUrl}
              />
            ),
          },
        ]
      : []),
    ...(dashboards.agencies.establishmentManagement
      ? [
          {
            tabId: "establishmentManagement" satisfies AgencyDashboardRouteName,
            label: "Pilotage des entreprises",
            content: (
              <MetabaseView
                title="Pilotage des entreprises"
                url={dashboards.agencies.establishmentManagement}
              />
            ),
          },
        ]
      : []),
  ];
};

const isAgencyDashboardTabRoute = (input: string): input is AgencyTabRoute =>
  agencyDashboardTabsList.includes(input as AgencyTabRoute);
