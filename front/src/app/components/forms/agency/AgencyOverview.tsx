import { fr } from "@codegouvfr/react-dsfr";

import type { AgencyDto, frontRoutes } from "shared";
import { AgencyStatusBadge } from "src/app/components/agency/AgencyStatusBadge";
import { AgencyTag } from "src/app/components/agency/AgencyTag";
import { AgencyUsers } from "src/app/components/agency/AgencyUsers";
import { CloseAgencyAndTransferConventions } from "src/app/components/agency/CloseAgencyAndTransferConventions";
import { CopyAgencyId } from "src/app/components/agency/CopyAgencyId";
import { Feedback } from "src/app/components/feedback/Feedback";
import { EditAgencyForm } from "src/app/components/forms/agency/EditAgencyForm";
import { useAppSelector } from "src/app/hooks/reduxHooks";
import type { ConnectedUsersWithNormalizedAgencyRightsById } from "src/core-logic/domain/admin/connectedUsersAdmin/connectedUsersAdmin.slice";
import { authSelectors } from "src/core-logic/domain/auth/auth.selectors";
import type { Route } from "type-route";

export type AgencyOverviewRouteName = Route<
  | typeof frontRoutes.adminAgencyDetail
  | typeof frontRoutes.adminAgencies
  | typeof frontRoutes.agencyDashboardAgencies
  | typeof frontRoutes.agencyDashboardAgencyDetails
>["name"];

type AgencyOverviewProps = {
  agency: AgencyDto;
  agencyUsers: ConnectedUsersWithNormalizedAgencyRightsById;
  routeName: AgencyOverviewRouteName;
};

export const AgencyOverview = ({
  agency,
  agencyUsers,
  routeName,
}: AgencyOverviewProps) => {
  const isBackOfficeadmin = useAppSelector(authSelectors.isAdminConnected);

  return (
    <div>
      <h1 className={fr.cx("fr-h1")}>{agency.name}</h1>

      <Feedback
        topics={[
          "agency-for-dashboard",
          "close-agency-and-transfer-conventions",
          "agency-admin",
        ]}
        className="fr-mb-2w"
        closable
      />
      <div className={fr.cx("fr-grid-row", "fr-grid-row--middle")}>
        <CopyAgencyId agencyId={agency.id} />
        {(routeName === "adminAgencies" || routeName === "adminAgencyDetail") &&
          isBackOfficeadmin && (
            <div className={fr.cx("fr-ml-auto")}>
              <CloseAgencyAndTransferConventions agency={agency} />
            </div>
          )}
      </div>
      {agency && (
        <>
          <AgencyTag
            refersToAgencyName={agency.refersToAgencyName}
            className={fr.cx("fr-my-2w")}
          />
          <AgencyStatusBadge status={agency.status} />
          <EditAgencyForm agency={agency} routeName={routeName} />
        </>
      )}
      {agency && (
        <AgencyUsers
          agency={agency}
          agencyUsersById={agencyUsers}
          routeName={routeName}
        />
      )}
    </div>
  );
};
