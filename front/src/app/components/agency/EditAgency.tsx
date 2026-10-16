import { fr } from "@codegouvfr/react-dsfr";

import { AgencyStatusBadge } from "src/app/components/agency/AgencyStatusBadge";
import { AgencyTag } from "src/app/components/agency/AgencyTag";
import { AgencyUsers } from "src/app/components/agency/AgencyUsers";
import { CloseAgencyAndTransferConventions } from "src/app/components/agency/CloseAgencyAndTransferConventions";
import { CopyAgencyId } from "src/app/components/agency/CopyAgencyId";
import { useAppSelector } from "src/app/hooks/reduxHooks";
import "src/assets/admin.css";
import { useDispatch } from "react-redux";
import { connectedUsersAdminSelectors } from "src/core-logic/domain/admin/connectedUsersAdmin/connectedUsersAdmin.selectors";
import { fetchAgencySelectors } from "src/core-logic/domain/agencies/fetch-agency/fetchAgency.selectors";
import { toAgencyUsersForManagementById } from "src/core-logic/domain/agencies/fetch-agency/fetchAgency.slice";
import { authSelectors } from "src/core-logic/domain/auth/auth.selectors";
import { feedbackSlice } from "src/core-logic/domain/feedback/feedback.slice";
import { EditAgencyForm } from "../forms/agency/EditAgencyForm";
import { BackofficeDashboardTabContent } from "../layout/BackofficeDashboardTabContent";
import { AgencyAdminAutocomplete } from "./AgencyAdminAutocomplete";

export const EditAgency = () => {
  const agency = useAppSelector(fetchAgencySelectors.agency);
  const connectedAgencyUsersById = useAppSelector(
    connectedUsersAdminSelectors.agencyUsers,
  );
  const agencyUsersById = toAgencyUsersForManagementById(
    connectedAgencyUsersById,
  );
  const isBackOfficeadmin = useAppSelector(authSelectors.isAdminConnected);
  const dispatch = useDispatch();
  return (
    <BackofficeDashboardTabContent title="Editer une agence">
      <div className={fr.cx("fr-px-6w", "fr-py-4w", "fr-card")}>
        <AgencyAdminAutocomplete
          locator="agencyAdminAutocomplete"
          label="Je sélectionne une agence (nom ou SIRET)"
          selectProps={{
            inputId: "agency-autocomplete",
            placeholder: "Ex : Agence de Berry",
          }}
          onAgencySelected={() => {
            dispatch(feedbackSlice.actions.clearFeedbacksTriggered());
          }}
          onAgencyClear={() => {}}
        />
      </div>
      {/* //Todo remove this from agency tab to redirect on agency detail admin page when select an agency in autocomplete */}
      {agency && (
        <>
          <div
            className={fr.cx(
              "fr-grid-row",
              "fr-grid-row--middle",
              "fr-mt-2w",
              "fr-ml-1v",
            )}
          >
            <CopyAgencyId agencyId={agency.id} />
            {isBackOfficeadmin && (
              <div className={fr.cx("fr-ml-auto")}>
                <CloseAgencyAndTransferConventions agency={agency} />
              </div>
            )}
          </div>
          <AgencyTag
            refersToAgencyName={agency.refersToAgencyName}
            className={fr.cx("fr-my-4w")}
          />
          <AgencyStatusBadge status={agency.status} />
          <EditAgencyForm agency={agency} routeName="adminAgencies" />
        </>
      )}
      {agency && (
        <AgencyUsers
          agency={agency}
          agencyUsersById={agencyUsersById}
          routeName="adminAgencies"
        />
      )}
    </BackofficeDashboardTabContent>
  );
};
