import { AdminAgencyListSection } from "src/app/components/admin/agencies/AdminAgencyListSection";
import { AdminConventionListSection } from "src/app/components/admin/conventions/AdminConventionListSection";
import { EditAgency } from "src/app/components/agency/EditAgency";
import { RegisterUsersToAgencies } from "src/app/components/agency/RegisterUsersToAgencies";
import { Feedback } from "src/app/components/feedback/Feedback";
import { useAppSelector } from "src/app/hooks/reduxHooks";
import { fetchAgencySelectors } from "src/core-logic/domain/agencies/fetch-agency/fetchAgency.selectors";

export const AgencyTab = () => {
  const agency = useAppSelector(fetchAgencySelectors.agency);
  return (
    <>
      <Feedback
        className="fr-mb-2w"
        topics={["close-agency-and-transfer-conventions", "agency-admin"]}
        closable
      />
      <EditAgency />

      {agency && <AdminConventionListSection key={agency.id} agency={agency} />}

      <RegisterUsersToAgencies />

      <AdminAgencyListSection />
    </>
  );
};
