import { fr } from "@codegouvfr/react-dsfr";
import { Accordion } from "@codegouvfr/react-dsfr/Accordion";
import { BorderedSection } from "react-design-system";
import type { ContactMode } from "shared";

export const BeneficiaryGuideInformation = ({
  contactMode,
}: {
  contactMode: Extract<ContactMode, "IN_PERSON" | "PHONE">;
}) => (
  <BorderedSection className={fr.cx("fr-mt-2w")}>
    <h5 className={fr.cx("fr-h5")}>Comment procéder ?</h5>
    <div className={fr.cx("fr-accordions-group")}>
      <Accordion
        label={
          contactMode === "IN_PERSON"
            ? "Avant de vous présenter sur place"
            : "Avant d'appeler"
        }
      >
        <ul>
          <li>Préparez votre présentation en 30 secondes</li>
          <li>Notez les dates/semaines qui vous conviennent</li>
          <li>Ayez votre projet clair en tête</li>
          {contactMode === "IN_PERSON" && (
            <li>Notez l'adresse et le nom de la personne à contacter</li>
          )}
        </ul>
      </Accordion>
      {contactMode === "PHONE" && (
        <Accordion label="Pendant l'appel">
          <ul>
            <li>
              Présentez-vous et expliquez que vous avez obtenu le contact via
              Immersion Facilitée.
            </li>
            <li>
              Décrivez votre projet professionnel et l'objectif que vous
              recherchez en effectuant cette immersion.
            </li>
            <li>
              Mentionnez que l'immersion est encadrée par une convention
              d'Immersion Facilitée.
            </li>
            <li>
              Proposez une période et une durée souhaitées pour l'immersion, en
              expliquant pourquoi elles vous conviennent.
            </li>
            <li>
              Concluez en demandant un rendez-vous afin d'échanger sur votre
              demande.
            </li>
          </ul>
        </Accordion>
      )}
      <Accordion label="À savoir">
        <ul>
          <li>
            L'immersion est un stage d'observation strictement encadré d'un
            point de vue juridique.
          </li>
          <li>Une immersion peut durer de 1 à 30 jours.</li>
          <li>Vous conservez votre statut et votre indemnité habituelle.</li>
          {contactMode !== "PHONE" && (
            <li>
              Une convention encadre l'immersion (vous pourrez la compléter lors
              du rendez-vous).
            </li>
          )}
        </ul>
      </Accordion>
    </div>
  </BorderedSection>
);
