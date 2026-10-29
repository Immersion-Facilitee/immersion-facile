import { AdminConventionListSection } from "src/app/components/admin/conventions/AdminConventionListSection";
import { BackofficeDashboardTabContent } from "src/app/components/layout/BackofficeDashboardTabContent";
import { SelectConventionFromIdForm } from "src/app/components/SelectConventionFromIdForm";
import { ArchivedConventionListSection } from "../../components/admin/archived-conventions/ArchivedConventionListSection";

export const ConventionTab = (): React.ReactNode => (
  <BackofficeDashboardTabContent title="Piloter une convention">
    <SelectConventionFromIdForm routeNameToRedirectTo="adminConventionDetail" />
    <AdminConventionListSection />
    <ArchivedConventionListSection />
  </BackofficeDashboardTabContent>
);
