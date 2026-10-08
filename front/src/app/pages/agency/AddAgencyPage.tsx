import { PageHeader } from "react-design-system";
import type { frontRoutes } from "shared";
import { AddAgencyForm } from "src/app/components/forms/agency/AddAgencyForm";
import { ConnectedPrivateRoutePage } from "src/app/pages/auth/ConnectedPrivateRoutePage";
import type { Route } from "type-route";

export const AddAgencyPage = ({
  route,
}: {
  route: Route<typeof frontRoutes.addAgency>;
}) => (
  <ConnectedPrivateRoutePage
    route={route}
    oAuthConnectionPageHeader={
      <PageHeader title="Ajout d'organisme encadrant les PMSMP" />
    }
  >
    <AddAgencyForm />
  </ConnectedPrivateRoutePage>
);
