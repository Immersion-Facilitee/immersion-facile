import { useEffect } from "react";
import { Loader } from "react-design-system";
import { useDispatch } from "react-redux";
import type { frontRoutes } from "shared";
import { AgencyOverview } from "src/app/components/forms/agency/AgencyOverview";
import { useAppSelector } from "src/app/hooks/reduxHooks";
import {
  FrontSpecificError,
  HomeButton,
} from "src/app/pages/error/front-errors";
import { fetchAgencySelectors } from "src/core-logic/domain/agencies/fetch-agency/fetchAgency.selectors";
import { fetchAgencySlice } from "src/core-logic/domain/agencies/fetch-agency/fetchAgency.slice";
import type { Route } from "type-route";

type AgencyDetailForAgencyDashboardProps = {
  route: Route<typeof frontRoutes.agencyDashboardAgencyDetails>;
};

export const AgencyDetailForAgencyDashboard = ({
  route,
}: AgencyDetailForAgencyDashboardProps) => {
  const agency = useAppSelector(fetchAgencySelectors.agency);
  const agencyUsersById = useAppSelector(fetchAgencySelectors.agencyUsers);
  const isFetchingAgency = useAppSelector(fetchAgencySelectors.isLoading);

  const dispatch = useDispatch();
  const agencyId = route.params.agencyId;

  useEffect(() => {
    if (agencyId) {
      dispatch(
        fetchAgencySlice.actions.fetchAgencyRequested({
          agencyId,
          feedbackTopic: "agency-for-dashboard",
        }),
      );
      dispatch(
        fetchAgencySlice.actions.fetchAgencyUsersRequested({
          agencyId,
          feedbackTopic: "agency-user-for-dashboard",
        }),
      );
    }
    return () => {
      dispatch(fetchAgencySlice.actions.clearAgencyAndUsers());
    };
  }, [dispatch, agencyId]);

  if (!agencyId)
    throw new FrontSpecificError({
      title: "Identifiant agence manquant",
      description:
        "Cette page est accessible uniquement avec un identifiant d'organisme prescripteur/accompagnateur.",
      buttons: [HomeButton],
    });

  if (!agency || isFetchingAgency) return <Loader />;

  return (
    <AgencyOverview
      agency={agency}
      agencyUsers={agencyUsersById}
      routeName={route.name}
    />
  );
};
