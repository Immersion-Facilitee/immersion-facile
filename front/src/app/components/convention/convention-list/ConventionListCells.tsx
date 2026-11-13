import { fr } from "@codegouvfr/react-dsfr";
import Badge from "@codegouvfr/react-dsfr/Badge";
import Tooltip from "@codegouvfr/react-dsfr/Tooltip";
import {
  type AgencyUserConventionListDto,
  getFormattedFirstnameAndLastname,
  isConventionArchived,
} from "shared";
import { ConventionStatusBadge } from "src/app/components/convention/ConventionStatusBadge";
import logoFtSvg from "src/assets/img/logo-ft.svg";

export const AgencyReferentCell = ({
  agencyReferent,
  agencyName,
}: Pick<
  AgencyUserConventionListDto,
  "agencyReferent" | "agencyName"
>): React.ReactNode => (
  <>
    <strong>
      {getFormattedFirstnameAndLastname({
        firstname: agencyReferent?.firstname,
        lastname: agencyReferent?.lastname,
      }) || "Non communiqué"}
    </strong>{" "}
    <Tooltip kind="hover" title={agencyName} />
  </>
);

export const BeneficiaryCell = ({
  beneficiary,
}: Pick<AgencyUserConventionListDto, "beneficiary">): React.ReactNode => (
  <>
    <strong>
      {getFormattedFirstnameAndLastname({
        firstname: beneficiary.firstName,
        lastname: beneficiary.lastName,
      })}
    </strong>
    {beneficiary.federatedIdentity?.provider === "ftConnect" && (
      <div className={fr.cx("fr-mt-1w")}>
        <img
          src={logoFtSvg}
          alt=""
          aria-hidden="true"
          className={fr.cx("fr-icon--sm", "fr-mr-1w")}
        />
        <strong className={fr.cx("fr-text--sm", "fr-label--info")}>
          FT Connect
        </strong>
      </div>
    )}
  </>
);

export const ConventionStatusBadges = ({
  status,
  dateEnd,
}: Pick<
  AgencyUserConventionListDto,
  "status" | "dateEnd"
>): React.ReactNode => (
  <ul className={fr.cx("fr-badges-group", "fr-badges-group--sm")}>
    <li>
      <ConventionStatusBadge conventionStatus={status} userKind="agency" />
    </li>
    {isConventionArchived({ dateEnd, now: new Date() }) && (
      <li>
        <Badge small>Archivée</Badge>
      </li>
    )}
  </ul>
);
