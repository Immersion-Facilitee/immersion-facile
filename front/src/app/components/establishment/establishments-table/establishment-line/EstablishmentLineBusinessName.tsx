import { fr } from "@codegouvfr/react-dsfr";
import Badge from "@codegouvfr/react-dsfr/Badge";
import Button from "@codegouvfr/react-dsfr/Button";
import { Tag } from "react-design-system";
import {
  domElementIds,
  frontRoutes,
  type UserEstablishmentRightDetailsWithAcceptedStatus,
  type UserEstablishmentRightDetailsWithPendingStatus,
} from "shared";

export const EstablishmentLineBusinessName = ({
  data,
  isEstablishmentBanned,
  isBackofficeAdmin,
}: {
  data:
    | UserEstablishmentRightDetailsWithAcceptedStatus
    | UserEstablishmentRightDetailsWithPendingStatus;
  isEstablishmentBanned: boolean;
  isBackofficeAdmin?: boolean;
}) => (
  <ul key={data.siret} className={fr.cx("fr-raw-list")}>
    <li>
      <Tag theme={"etablissement"} />
      {isEstablishmentBanned && (
        <Badge severity="error" small>
          ENTREPRISE BANNIE
        </Badge>
      )}
    </li>
    <li> {data.businessName}</li>
    <li>
      {" "}
      <span className={fr.cx("fr-hint-text")}>{data.siret}</span>
    </li>
    {isBackofficeAdmin && (
      <Button
        priority="tertiary no outline"
        id={`${domElementIds.establishmentDashboard.manageEstablishments.adminEstablishmentLink}-${data.siret}`}
        size="small"
        linkProps={
          frontRoutes.adminEstablishments({
            siret: data.siret,
          }).link
        }
      >
        Voir comme admin IF
      </Button>
    )}
  </ul>
);
