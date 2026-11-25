import { fr } from "@codegouvfr/react-dsfr";
import ButtonsGroup from "@codegouvfr/react-dsfr/ButtonsGroup";
import Highlight from "@codegouvfr/react-dsfr/Highlight";
import {
  domElementIds,
  type FormEstablishmentDto,
  frontRoutes,
  toDisplayedDate,
} from "shared";
import { commonIllustrations } from "src/assets/img/illustrations";

type EstablishmentCreationConfirmationProps = {
  formEstablishment: FormEstablishmentDto;
};

export const EstablishmentCreationConfirmation = ({
  formEstablishment,
}: EstablishmentCreationConfirmationProps): JSX.Element => {
  const establishmentName =
    formEstablishment.businessNameCustomized || formEstablishment.businessName;
  const nextAvailabilityDate = formEstablishment.nextAvailabilityDate
    ? new Date(formEstablishment.nextAvailabilityDate)
    : null;
  const visibility =
    nextAvailabilityDate && nextAvailabilityDate > new Date()
      ? `apparaîtra à partir du ${toDisplayedDate({ date: nextAvailabilityDate })}`
      : "apparaît dès maintenant";
  const establishmentDetailsLinkProps =
    frontRoutes.establishmentDashboardEstablishmentDetails({
      siret: formEstablishment.siret,
    }).link;

  return (
    <div className={fr.cx("fr-grid-row", "fr-grid-row--middle")}>
      <div className={fr.cx("fr-col-12", "fr-col-md-8")}>
        <h1 className={fr.cx("fr-h3")}>Votre entreprise a bien été inscrite</h1>
        <p className={fr.cx("fr-text--lg", "fr-mb-4w")}>
          {establishmentName} {visibility} dans la recherche d'Immersion
          Facilitée.
        </p>
        <Highlight className={fr.cx("fr-ml-0", "fr-mb-5w")}>
          <strong>
            Vous souhaitez apparaître dans les premiers résultats ?
          </strong>{" "}
          Obtenez la reconnaissance « Super entreprise » en étant répondant aux
          demandes, en accueillant des immersions et en maintenant votre profil
          à jour.
        </Highlight>
        <ButtonsGroup
          inlineLayoutWhen="sm and up"
          buttons={[
            {
              children: "Ajouter une autre offre",
              id: domElementIds.formEstablishment.create.addOtherOfferButton,
              linkProps: frontRoutes.establishmentDashboardEstablishmentOffer({
                siret: formEstablishment.siret,
              }).link,
            },
            {
              children: "Voir ma fiche entreprise",
              priority: "secondary",
              id: domElementIds.formEstablishment.create
                .navigateToEstablishmentDashboard,
              linkProps: establishmentDetailsLinkProps,
            },
          ]}
        />
      </div>
      <div
        className={fr.cx(
          "fr-col-md-4",
          "fr-hidden",
          "fr-unhidden-md",
          "fr-grid-row",
          "fr-grid-row--center",
        )}
      >
        <img
          src={commonIllustrations.establishmentCreated}
          alt=""
          width={282}
        />
      </div>
    </div>
  );
};
