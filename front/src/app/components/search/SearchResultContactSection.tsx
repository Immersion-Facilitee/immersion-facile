import { fr } from "@codegouvfr/react-dsfr";
import Button from "@codegouvfr/react-dsfr/Button";
import Highlight from "@codegouvfr/react-dsfr/Highlight";
import { isInternalOfferDto, type OfferDto } from "shared";
import { match, P } from "ts-pattern";
import { CreateDiscussionForm } from "../immersion-offer/CreateDiscussionForm";
import "./SearchResultCard.scss";

export const SearchResultContactSection = ({
  formContactRef,
  onFormSubmitSuccess,
  currentSearchResult,
  onButtonClick,
}: {
  onFormSubmitSuccess: () => void;
  formContactRef: React.RefObject<HTMLDivElement>;
  currentSearchResult: OfferDto;
  onButtonClick: () => void;
}) => {
  const isNotAvailable =
    isInternalOfferDto(currentSearchResult) && !currentSearchResult.isAvailable;
  return (
    <div
      className={`im-search-result-card ${fr.cx(
        isNotAvailable && currentSearchResult.contactMode
          ? "fr-p-4w"
          : "fr-p-3w",
        "fr-mb-3w",
      )}`}
      ref={formContactRef}
    >
      {match({
        contactMode: currentSearchResult.contactMode,
        isNotAvailable,
      })
        .with(
          {
            contactMode: P.union("EMAIL", "PHONE", "IN_PERSON"),
            isNotAvailable: true,
          },
          () => (
            <>
              <h2 className={fr.cx("fr-h3", "fr-mb-2w")}>
                Mise en relation temporairement indisponible
              </h2>
              <p className={fr.cx("fr-text--lg", "fr-mb-3w")}>
                Cette entreprise a atteint son nombre maximal de mises en
                relation pour le moment.
              </p>
              <p className={fr.cx("fr-text--lg", "fr-mb-4w")}>
                Nous vous invitons à consulter d’autres entreprises
                accueillantes via le moteur de recherche afin de poursuivre
                votre démarche d’immersion.
              </p>
              <Highlight className={fr.cx("fr-ml-0", "fr-mb-5w")}>
                <strong>Quand réessayer ?</strong> Les mises en relation sont
                réinitialisées chaque mois. Il est donc possible que cette
                entreprise soit à nouveau disponible prochainement, notamment en
                début de mois.
              </Highlight>
              <Button iconId="fr-icon-search-line" onClick={onButtonClick}>
                Rechercher une autre entreprise
              </Button>
            </>
          ),
        )
        .with(
          {
            contactMode: P.union("EMAIL", "PHONE", "IN_PERSON"),
            isNotAvailable: false,
          },
          ({ contactMode }) => (
            <CreateDiscussionForm
              key={currentSearchResult.siret}
              appellations={currentSearchResult.appellations}
              onSubmitSuccess={onFormSubmitSuccess}
              contactMode={contactMode}
            />
          ),
        )
        .with(
          {
            contactMode: P.nullish,
          },
          () => (
            <div>
              <h2 className={fr.cx("fr-h3", "fr-mb-2w")}>
                Nos conseils pour cette première prise de contact !{" "}
              </h2>
              <h3 className={fr.cx("fr-h6")}>
                Comment présenter votre demande ?{" "}
              </h3>
              <p className={fr.cx("fr-mb-2w")}>
                Soyez <strong>direct, concret et courtois</strong>.
                Présentez-vous, présentez simplement votre projet et l’objectif
                que vous recherchez en effectuant une immersion.
              </p>
              <p className={fr.cx("fr-mb-2w")}>
                <strong>Par exemple : </strong>
                <span>
                  “Je souhaite devenir mécanicien auto et je voudrais découvrir
                  comment ce métier se pratique dans un garage comme le vôtre.
                  Ca me permettra de vérifier que cela me plaît vraiment. La
                  personne qui m’accueillera et me présentera le métier pourra
                  aussi vérifier si ce métier est fait pour moi.”
                </span>
              </p>
              <p className={fr.cx("fr-mb-2w")}>
                Vous pouvez indiquer à votre interlocutrice ou interlocuteur que{" "}
                <strong>
                  cette immersion sera encadrée par une convention signée par
                  l'organisme qui vous suit.
                </strong>
              </p>
              <p className={fr.cx("fr-mb-2w")}>
                Indiquez lui le moment où vous aimeriez faire une immersion et
                pourquoi vous voulez la faire à cette date.
              </p>
              <p className={fr.cx("fr-mb-2w")}>
                <strong>Par exemple : </strong>
                <span>
                  “il faudrait que je fasse une immersion avant de m’inscrire à
                  une formation. “
                </span>
              </p>
              <p className={fr.cx("fr-mb-2w")}>
                Indiquez également le <strong>nombre de jours</strong> que vous
                aimeriez faire en immersion si vous le savez déjà.
              </p>
              <p className={fr.cx("fr-mb-2w")}>
                Concluez en lui demandant <strong>un rendez-vous</strong> pour
                qu’il/elle se rende compte du sérieux de votre projet.
              </p>

              <h3 className={fr.cx("fr-h6")}>
                Comment expliquer simplement ce qu’est une immersion ?
              </h3>
              <p className={fr.cx("fr-mb-2w")}>
                C’est un stage d’observation, strictement encadré d’un point de
                vue juridique. Vous conservez votre statut et êtes couvert par
                votre France Travail (anciennement Pôle emploi), votre Mission
                Locale ou le Conseil départemental (en fonction de votre
                situation).
              </p>
              <p className={fr.cx("fr-mb-2w")}>
                Le rôle de celui qui vous accueillera est de vous présenter le
                métier et de vérifier avec vous que ce métier vous convient en
                vous faisant des retours les plus objectifs possibles. Pendant
                la durée de votre présence, vous pouvez aider les salariés en
                donnant un coup de main mais vous n’êtes pas là pour remplacer
                un collègue absent.
              </p>

              <h3 className={fr.cx("fr-h6")}>
                Quelle est la durée d’une immersion ?
              </h3>
              <p className={fr.cx("fr-mb-2w")}>
                Les immersions se font le plus souvent pendant une semaine ou
                deux. <strong>Il n’est pas possible de dépasser un mois</strong>
                . Il est possible de faire une immersion de seulement un ou deux
                jours mais vous ne découvrirez pas parfaitement un métier.
              </p>

              <h3 className={fr.cx("fr-h6")}>Bon à savoir ! </h3>
              <p className={fr.cx("fr-mb-2w")}>
                <strong>Il n’est pas nécessaire d’apporter votre CV</strong>.
                Vous êtes là pour demander à découvrir un métier et c’est ce
                projet qui est important, pas vos expériences professionnelles
                ni votre formation !
              </p>
            </div>
          ),
        )
        .exhaustive()}
    </div>
  );
};
