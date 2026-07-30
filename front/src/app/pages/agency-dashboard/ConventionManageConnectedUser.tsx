import { Alert } from "@codegouvfr/react-dsfr/Alert";
import type { frontRoutes } from "shared";

import { ConventionManageContent } from "src/app/components/admin/conventions/ConventionManageContent";
import { WithFeedbackReplacer } from "src/app/components/feedback/WithFeedbackReplacer";
import { useAppSelector } from "src/app/hooks/reduxHooks";
import { authSelectors } from "src/core-logic/domain/auth/auth.selectors";
import type { Route } from "type-route";

type ConventionManageConnectedUserProps = {
  route: Route<typeof frontRoutes.manageConventionConnectedUser>;
};

export const ConventionManageConnectedUser = ({
  route,
}: ConventionManageConnectedUserProps) => {
  const conventionId = route.params.conventionId;
  const connectedUserJwt = useAppSelector(authSelectors.connectedUserJwt);

  if (!connectedUserJwt) {
    return (
      <Alert
        severity="error"
        title="Non autorisé"
        description="Cette page est reservée aux utilisteurs connectés avec ProConnect, et dont l'agence est responsable de cette convention."
      />
    );
  }

  if (!conventionId)
    return (
      <Alert
        severity="error"
        title="Identifiant de convention manquant"
        description="Cette page n'est accessible que si vous fournissez un identifiant de convention."
      />
    );

  return (
    <WithFeedbackReplacer topic="transfer-convention-to-agency">
      <ConventionManageContent
        jwtParams={{
          jwt: connectedUserJwt,
          kind: "connected user",
        }}
        conventionId={conventionId}
      />
    </WithFeedbackReplacer>
  );
};
