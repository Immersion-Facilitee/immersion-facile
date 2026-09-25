import type { ExchangeRole } from "shared";
import type {
  BeneficiaryDashboardRouteName,
  EstablishmentDashboardRouteName,
} from "src/app/pages/auth/ConnectedPrivateRoutePage";
import { makeUseTypedRoute } from "src/app/routes/routes.hooks";
import { DiscussionList } from "./DiscussionList";
import { DiscussionManageContent } from "./DiscussionManageContent";

const useDashboardDiscussionRoute = makeUseTypedRoute<
  EstablishmentDashboardRouteName | BeneficiaryDashboardRouteName
>();

export const DiscussionTabContent = ({ viewer }: { viewer: ExchangeRole }) => {
  const route = useDashboardDiscussionRoute([
    "establishmentDashboard",
    "establishmentDashboardDiscussions",
    "establishmentDashboardConventions",
    "establishmentDashboardFormEstablishment",
    "beneficiaryDashboard",
    "beneficiaryDashboardDiscussions",
    "beneficiaryDashboardConventions",
  ]);
  return (route.name === "establishmentDashboardDiscussions" ||
    route.name === "beneficiaryDashboardDiscussions") &&
    route.params.discussionId ? (
    <DiscussionManageContent
      discussionId={route.params.discussionId}
      viewer={viewer}
    />
  ) : (
    <DiscussionList viewer={viewer} />
  );
};
