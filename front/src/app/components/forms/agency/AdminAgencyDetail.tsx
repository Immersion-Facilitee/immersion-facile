import { useEffect } from "react";
import { Loader } from "react-design-system";
import { useDispatch } from "react-redux";
import type { frontRoutes } from "shared";
import { WithFeedbackReplacer } from "src/app/components/feedback/WithFeedbackReplacer";
import { AgencyOverview } from "src/app/components/forms/agency/AgencyOverview";
import { useAppSelector } from "src/app/hooks/reduxHooks";
import { AgencyDashboard } from "src/app/pages/admin/AgencyTab";
import { connectedUsersAdminSelectors } from "src/core-logic/domain/admin/connectedUsersAdmin/connectedUsersAdmin.selectors";
import { connectedUsersAdminSlice } from "src/core-logic/domain/admin/connectedUsersAdmin/connectedUsersAdmin.slice";
import { fetchAgencySelectors } from "src/core-logic/domain/agencies/fetch-agency/fetchAgency.selectors";
import { fetchAgencySlice } from "src/core-logic/domain/agencies/fetch-agency/fetchAgency.slice";
import type { Route } from "type-route";

type AdminAgencyDetailProps = {
  route: Route<typeof frontRoutes.adminAgencyDetail>;
};

export const AdminAgencyDetail = ({ route }: AdminAgencyDetailProps) => {
  const agency = useAppSelector(fetchAgencySelectors.agency);
  const agencyUsersById = useAppSelector(
    connectedUsersAdminSelectors.agencyUsers,
  );
  const isLoading = useAppSelector(fetchAgencySelectors.isLoading);

  const dispatch = useDispatch();

  useEffect(() => {
    dispatch(
      fetchAgencySlice.actions.fetchAgencyRequested({
        agencyId: route.params.agencyId,
        feedbackTopic: "agency-admin",
      }),
    );
    dispatch(
      connectedUsersAdminSlice.actions.fetchAgencyUsersRequested({
        agencyIds: [route.params.agencyId],
      }),
    );
    return () => {
      dispatch(fetchAgencySlice.actions.clearAgencyAndUsers());
    };
  }, [dispatch, route.params.agencyId]);

  return (
    <>
      {isLoading && <Loader />}
      <WithFeedbackReplacer topic="agency-admin" level="error">
        {agency && (
          <>
            <AgencyOverview
              agency={agency}
              agencyUsers={agencyUsersById}
              routeName={route.name}
            />
            <AgencyDashboard agency={agency} />
          </>
        )}
      </WithFeedbackReplacer>
    </>
  );
};
