import { PageHeader } from "react-design-system";
import type { frontRoutes } from "shared";
import { EstablishmentForm } from "src/app/components/forms/establishment/EstablishmentForm";
import { ConnectedPrivateRoutePage } from "src/app/pages/auth/ConnectedPrivateRoutePage";
import type { Route } from "type-route";

type EstablishmentCreationFormPage = {
  route: Route<typeof frontRoutes.formEstablishment>;
};

export const EstablishmentCreationFormPage = ({
  route,
}: EstablishmentCreationFormPage) => (
  <ConnectedPrivateRoutePage
    route={route}
    oAuthConnectionPageHeader={<PageHeader title="Inscrire une entreprise" />}
  >
    <EstablishmentForm mode="create" />
  </ConnectedPrivateRoutePage>
);
