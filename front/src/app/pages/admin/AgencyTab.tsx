import { Alert } from "@codegouvfr/react-dsfr/Alert";

import type { AgencyDto } from "shared";
import { AdminConventionListSection } from "src/app/components/admin/conventions/AdminConventionListSection";
import { EditAgency } from "src/app/components/agency/EditAgency";
import { RegisterUsersToAgencies } from "src/app/components/agency/RegisterUsersToAgencies";
import { Feedback } from "src/app/components/feedback/Feedback";
import { MetabaseView } from "src/app/components/MetabaseView";
import { useAppSelector } from "src/app/hooks/reduxHooks";
import { useAdminDashboard } from "src/app/pages/admin/useAdminDashboard";
import { fetchAgencySelectors } from "src/core-logic/domain/agencies/fetch-agency/fetchAgency.selectors";

export const AgencyTab = () => {
  const agency = useAppSelector(fetchAgencySelectors.agency);
  const { url, error } = useAdminDashboard({ name: "adminAgencies" });
  return (
    <>
      <Feedback
        className="fr-mb-2w"
        topics={["close-agency-and-transfer-conventions", "agency-admin"]}
        closable
      />
      <EditAgency />

      {agency && <AgencyDashboard agency={agency} />}

      <RegisterUsersToAgencies />

      {error ? (
        <Alert severity="error" title="Erreur" description={error} />
      ) : (
        <MetabaseView title="Consulter les agences" url={url} />
      )}
    </>
  );
};

export const AgencyDashboard = ({ agency }: { agency: AgencyDto }) => (
  <AdminConventionListSection key={agency.id} agency={agency} />
);
