import { Tabs, type TabsProps } from "@codegouvfr/react-dsfr/Tabs";
import type { ReactNode } from "react";
import { useDispatch } from "react-redux";
import {
  type AdminTabRouteName,
  adminTabs,
  frontRoutes,
  keys,
  type OmitFromExistingKeys,
  type Prettify,
} from "shared";
import { AgencyTab } from "src/app/pages/admin/AgencyTab";
import { ConventionTab } from "src/app/pages/admin/ConventionTab";
import { EmailPreviewTab } from "src/app/pages/admin/EmailPreviewTab";
import { EstablishmentsTab } from "src/app/pages/admin/EstablishmentsTab";
import { EventsTab } from "src/app/pages/admin/EventsTabs";
import { NotificationsTab } from "src/app/pages/admin/NotificationsTab";
import { TechnicalOptionsTab } from "src/app/pages/admin/TechnicalOptionsTab";
import { UsersTab } from "src/app/pages/admin/UsersTab";
import { ENV } from "src/config/environmentVariables";
import { feedbackSlice } from "src/core-logic/domain/feedback/feedback.slice";
import type { Route } from "type-route";

type RawAdminTab = Prettify<
  OmitFromExistingKeys<TabsProps.Controlled["tabs"][number], "tabId"> & {
    content: ReactNode;
  }
>;

const rawAdminTabs: Record<AdminTabRouteName, RawAdminTab> = {
  adminConventions: {
    label: "Conventions",
    content: <ConventionTab />,
  },
  adminEvents: {
    label: "Evénements",
    content: <EventsTab />,
  },
  adminAgencies: {
    label: "Agences",
    content: <AgencyTab />,
  },
  adminEstablishments: {
    label: "Entreprises",
    content: <EstablishmentsTab />,
  },
  adminUsers: {
    label: "Utilisateurs",
    content: <UsersTab />,
  },
  adminNotifications: {
    label: "Notifications",
    content: <NotificationsTab />,
  },
  adminEmailPreview: {
    label: "Aperçu email",
    content: <EmailPreviewTab />,
  },
  adminTechnicalOptions: {
    label: "Options techniques",
    content: <TechnicalOptionsTab />,
  },
};

export type FrontAdminRouteTab = Route<(typeof frontRoutes)[AdminTabRouteName]>;

const getAdminTabs = (currentTab: AdminTabRouteName) =>
  keys(rawAdminTabs)
    .filter((tabId) => adminTabs[tabId].isVisible(ENV.envType))
    .map((tabId) => ({
      ...rawAdminTabs[tabId],
      tabId,
      isDefault: currentTab === tabId,
    }));

export const AdminTabs = ({ route }: { route: FrontAdminRouteTab }) => {
  const currentTab = route.name;
  const tabs = getAdminTabs(route.name);
  const dispatch = useDispatch();

  return (
    <Tabs
      tabs={tabs}
      selectedTabId={currentTab} // shouldn't be necessary as it's handled by isDefault, but typescript complains (should report to react-dsfr)
      onTabChange={(tab) => {
        dispatch(feedbackSlice.actions.clearFeedbacksTriggered());
        frontRoutes[tab as AdminTabRouteName]().push();
      }}
      id="admin-tabs"
    >
      {tabs.find((tab) => tab.tabId === currentTab)?.content}
    </Tabs>
  );
};
