import { Alert } from "@codegouvfr/react-dsfr/Alert";
import { BackofficeDashboardTabContent } from "src/app/components/layout/BackofficeDashboardTabContent";

import { MetabaseView } from "src/app/components/MetabaseView";
import { SelectConventionFromIdForm } from "src/app/components/SelectConventionFromIdForm";
import { useAdminDashboard } from "src/app/pages/admin/useAdminDashboard";
import { ArchivedConventionListSection } from "../../components/admin/archived-conventions/ArchivedConventionListSection";

export const ConventionTab = () => {
  const { url, error } = useAdminDashboard({ name: "adminConventions" });
  return error ? (
    <Alert severity="error" title="Erreur" description={error} />
  ) : (
    <BackofficeDashboardTabContent title="Piloter une convention">
      <SelectConventionFromIdForm routeNameToRedirectTo="adminConventionDetail" />
      <MetabaseView
        title="Consulter les conventions"
        subtitle="Cliquer sur l'identifiant de la convention pour y accéder."
        url={url}
      />
      <ArchivedConventionListSection />
    </BackofficeDashboardTabContent>
  );
};
