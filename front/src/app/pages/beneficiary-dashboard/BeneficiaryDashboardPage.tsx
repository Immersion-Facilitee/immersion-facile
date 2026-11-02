import { fr } from "@codegouvfr/react-dsfr";
import Button from "@codegouvfr/react-dsfr/Button";
import Tabs from "@codegouvfr/react-dsfr/Tabs";
import { useMemo } from "react";
import { Loader, SectionHighlight } from "react-design-system";
import {
  type BeneficiaryDashboardTab,
  domElementIds,
  frontRoutes,
} from "shared";
import { DiscussionTabContent } from "src/app/components/discussion/DiscussionTabContent";
import { useAppSelector } from "src/app/hooks/reduxHooks";
import { useFeatureFlags } from "src/app/hooks/useFeatureFlags";
import type { DashboardTab } from "src/app/utils/dashboard";
import { connectedUserSelectors } from "src/core-logic/domain/connected-user/connectedUser.selectors";
import { discussionSelectors } from "src/core-logic/domain/discussion/discussion.selectors";
import { BeneficiaryConventionList } from "../../components/beneficiary/ConventionTab/BeneficiaryConventionList";
import type { FrontBeneficiaryDashboardRoute } from "../auth/ConnectedPrivateRoutePage";
import {
  beneficiaryDashboardRouteNameFromTabId,
  beneficiaryDashboardTabFromRouteName,
  isBeneficiaryDashboardTab,
} from "./beneficiaryDashboard.utils";

export const BeneficiaryDashboardPage = ({
  route,
}: {
  route: FrontBeneficiaryDashboardRoute;
}) => {
  const currentTab = useMemo(
    () => beneficiaryDashboardTabFromRouteName[route.name],
    [route.name],
  );
  const isLoadingUser = useAppSelector(connectedUserSelectors.isLoading);
  const isLoadingDiscussionList = useAppSelector(discussionSelectors.isLoading);

  const tabsWithIsDefault = makeTabsWithIsDefault(tabs, currentTab);
  const { enableBeneficiaryDashboardHighlight } = useFeatureFlags();

  return (
    <>
      {(isLoadingUser || isLoadingDiscussionList) && <Loader />}
      <h1>Mon espace candidat</h1>
      {enableBeneficiaryDashboardHighlight.isActive && (
        <SectionHighlight>
          <h2 className={fr.cx("fr-h6", "fr-mb-1w")}>
            {enableBeneficiaryDashboardHighlight.value.title}
          </h2>
          <p className={fr.cx("fr-text--lg", "fr-mb-2w")}>
            {enableBeneficiaryDashboardHighlight.value.message}
          </p>
          <Button
            size="small"
            linkProps={{
              href: enableBeneficiaryDashboardHighlight.value.href,
              target: "_blank",
              rel: "noopener noreferrer",
            }}
          >
            {enableBeneficiaryDashboardHighlight.value.label}
          </Button>
        </SectionHighlight>
      )}
      <Tabs
        tabs={tabsWithIsDefault}
        id={domElementIds.beneficiaryDashboard.tabContainer}
        className={fr.cx("fr-mt-4w")}
        selectedTabId={currentTab}
        onTabChange={(tab) => {
          if (isBeneficiaryDashboardTab(tab)) {
            const routeName = beneficiaryDashboardRouteNameFromTabId[tab];
            frontRoutes[routeName]().push();
          }
        }}
      >
        {tabsWithIsDefault.find((tab) => tab.tabId === currentTab)?.content}
      </Tabs>
    </>
  );
};

const tabs: (DashboardTab & { tabId: BeneficiaryDashboardTab })[] = [
  {
    label: "Mes candidatures",
    content: <DiscussionTabContent viewer="potentialBeneficiary" />,
    tabId: "discussions",
  },
  {
    label: "Mes conventions",
    content: <BeneficiaryConventionList />,
    tabId: "conventions",
  },
];

const makeTabsWithIsDefault = (
  rawTabs: DashboardTab[],
  currentTab: BeneficiaryDashboardTab,
) =>
  rawTabs.map((tab) => ({
    ...tab,
    tabId: tab.tabId,
    isDefault: currentTab === tab.tabId,
  }));
