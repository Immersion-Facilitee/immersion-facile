import { fr } from "@codegouvfr/react-dsfr";
import Tooltip from "@codegouvfr/react-dsfr/Tooltip";
import {
  type AgencyUserConventionListDto,
  getFormattedFirstnameAndLastname,
} from "shared";
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
