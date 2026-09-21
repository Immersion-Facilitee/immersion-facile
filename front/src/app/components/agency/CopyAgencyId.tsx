import { fr } from "@codegouvfr/react-dsfr";
import { Badge } from "@codegouvfr/react-dsfr/Badge";

import { CopyButton } from "react-design-system";
import type { AgencyId } from "shared";

export const CopyAgencyId = ({ agencyId }: { agencyId: AgencyId }) => (
  <div>
    Id de l'agence : <Badge severity="success">{agencyId}</Badge>{" "}
    <CopyButton
      label="Copier"
      textToCopy={agencyId}
      withIcon={true}
      className={fr.cx("fr-ml-1v")}
    />
  </div>
);
