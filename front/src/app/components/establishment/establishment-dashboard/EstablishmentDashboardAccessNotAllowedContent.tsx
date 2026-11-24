import { fr } from "@codegouvfr/react-dsfr";
import type { ReactNode } from "react";
import {
  type EstablishmentNameAndAdmins,
  type SiretDto,
  toFormatedTextSiret,
} from "shared";
import { commonIllustrations } from "src/assets/img/illustrations";

type EstablishmentDashboardAccessNotAllowedContentProps = {
  establishmentNameAndAdmins: EstablishmentNameAndAdmins;
  siret: SiretDto;
};

export const EstablishmentDashboardAccessNotAllowedContent = ({
  establishmentNameAndAdmins,
  siret,
}: EstablishmentDashboardAccessNotAllowedContentProps): ReactNode => (
  <div className={fr.cx("fr-grid-row", "fr-grid-row--gutters")}>
    <div className={fr.cx("fr-hidden", "fr-unhidden-lg", "fr-col-2")}>
      <div>
        <img src={commonIllustrations.reachData} alt="attention" />
      </div>
    </div>
    <div className={fr.cx("fr-col-12", "fr-col-lg-10")}>
      <h2>Contacter votre administrateur</h2>
      <p>
        L’entreprise <strong>{establishmentNameAndAdmins.name}</strong> est bien
        référencée chez Immersion Facilitée sous le numéro de SIRET{" "}
        {toFormatedTextSiret(siret)}, mais votre adresse mail ne correspond à
        aucun rôle. Veuillez contacter l'administrateur de l’entreprise via :{" "}
        <ul>
          {establishmentNameAndAdmins.adminEmails.map((email) => (
            <li key={"adminEmails"}>
              <a
                className={fr.cx(
                  "fr-link",
                  "fr-icon-arrow-right-line",
                  "fr-link--icon-right",
                )}
                href={`mailto:${email}`}
                key={email}
                target="_blank"
                rel="noreferrer"
              >
                {email}
              </a>
            </li>
          ))}
        </ul>
      </p>
    </div>
  </div>
);
