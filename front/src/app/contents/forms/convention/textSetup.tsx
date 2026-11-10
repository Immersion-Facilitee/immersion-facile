import { fr } from "@codegouvfr/react-dsfr";

import type { ConventionId, InternshipKind } from "shared";

export const useConventionTexts = (internshipKind: InternshipKind) =>
  immersionTexts(internshipKind);

const immersionTexts = (internshipKind: InternshipKind) => ({
  intro: {
    conventionTitle:
      internshipKind === "immersion"
        ? "Remplir la demande de convention"
        : "S’informer sur les métiers, découvrir l’entreprise",
    conventionEditTitle:
      internshipKind === "immersion"
        ? "Modifier la demande de convention"
        : "S’informer sur les métiers, découvrir l’entreprise",
    conventionSummaryTitle:
      internshipKind === "immersion"
        ? "Vérifier la demande de convention"
        : "S’informer sur les métiers, découvrir l’entreprise",
    conventionSummaryDescription:
      "Merci d’avoir complété la convention. Veuillez vérifier attentivement les informations ci-dessous avant d’envoyer votre demande de signature.",
    conventionSignTitle:
      internshipKind === "immersion"
        ? "Signer la convention d'immersion"
        : "Signer la convention de stage",
    conventionFormDescription:
      internshipKind === "immersion" ? (
        <p className="fr-text">
          Complétez ce formulaire pour réaliser votre immersion professionnelle.{" "}
          <br /> Il vaut équivalence du CERFA 13912 * 05.
        </p>
      ) : (
        <p className="fr-text">
          Vous avez trouvé une entreprise pour vous accueillir en stage et
          découvrir un ou plusieurs métiers.
          <br />
          Avant tout, vous devez faire établir une convention de stage pendant
          les vacances scolaires et bien c'est ici que ça se passe. <br />
          En quelques minutes, complétez ce formulaire de convention avec
          l'entreprise qui vous accueillera.
        </p>
      ),
    conventionCreationNotification:
      internshipKind === "immersion" ? (
        <>
          <p>
            Vérifiez que votre structure d’accompagnement est disponible dans la
            liste ci-dessous.{" "}
            <strong>Si ce n’est pas le cas, contactez votre conseiller.</strong>
          </p>
          <p>
            <strong>
              Si vous n'avez pas de structure d'accompagnement, retrouvez{" "}
              <a
                href="https://immersion-facile.beta.gouv.fr/aide/article/je-nai-pas-de-structure-daccompagnement-et-je-veux-faire-une-immersion-1x15rdp/"
                target="_blank"
                rel="noreferrer"
              >
                nos conseils ici
              </a>
              .
            </strong>
          </p>
        </>
      ) : (
        <>
          <p className={fr.cx("fr-text--xs")}>
            La convention doit être établie, signée par toutes les parties et
            visée par une des 3 Chambres consulaires (CCI, CMA ou chambre
            d'agriculture) <u>avant</u> le démarrage de la période d’observation
            en milieu professionnel. Sans visa, la convention ne pourra être
            exécutée.
          </p>
          <p className={fr.cx("fr-text--xs", "fr-mt-2w")}>
            Cette convention est établie en application des dispositions des
            articles L124-3-1, L332-3-1 et L332-3-2 du code de l’éducation et de
            l’article L.4153-1 du code du travail, offrant la possibilité&nbsp;:
            <br />⦁ aux collégiens, à partir de la 4e ou aux jeunes des lycées
            de réaliser des périodes d’observation en entreprise d’une durée
            maximale d’une semaine durant les vacances scolaires;
            <br />⦁ aux étudiants de l’enseignement supérieur de réaliser des
            périodes d’observation en entreprise d’une durée maximale de 5
            jours, en dehors des semaines réservées aux cours et au contrôle de
            connaissances.
          </p>
          <p className={fr.cx("fr-text--xs", "fr-mt-2w")}>
            <em>
              Ce dispositif n’est pas ouvert aux alternants (apprentissage ou
              professionnalisation), ni aux jeunes inscrits dans des
              établissements à l’étranger hors écoles et établissements français
              homologués par&nbsp;
              <a
                href="https://www.legifrance.gouv.fr/loda/id/JORFTEXT000041939072"
                target="_blank"
                rel="noreferrer"
              >
                l’arrêté du 20 mai 2020
              </a>
              .
            </em>
          </p>
        </>
      ),
  },

  agencySection: {
    title: internshipKind === "immersion" ? "Accompagnateur" : "Pour commencer",
  },
  beneficiarySection: {
    title:
      internshipKind === "immersion"
        ? "Personne en immersion"
        : "Vos coordonnées",
    isMinorLabel:
      internshipKind === "immersion"
        ? "La personne qui va faire l'immersion est-elle mineure ?"
        : "Êtes-vous mineur ou majeur protégé ?",
  },
  establishmentSection: {
    title: "Entreprise",
    subtitle:
      internshipKind === "immersion"
        ? "Les questions suivantes doivent être complétées avec la personne qui vous accueillera pendant votre immersion"
        : "Les questions suivantes doivent être complétées avec la personne qui vous accueillera pendant votre stage",
    isEstablishmentTutorIsEstablishmentRepresentative:
      "Est-ce que le tuteur de l'entreprise est le représentant de l'entreprise, signataire de la convention ?",
  },
  immersionHourLocationSection: {
    title:
      internshipKind === "immersion"
        ? "Lieu et horaires"
        : "Lieu et horaires du stage",
  },
  immersionDetailsSection: {
    title: internshipKind === "immersion" ? "Détails" : "Détails du stage",
  },
  errorSummary: {
    title: "Votre demande doit être corrigée",
  },
  yes: "Oui",
  no: "Non",
  linkCopied: "Lien copié !",
  shareConventionDraftByMail: {
    share: "Partager ou enregistrer un brouillon",
  },
  signatures: {
    fixErrors: "Veuillez corriger les champs erronés",
    validationText:
      "Une fois le formulaire envoyé, vous allez recevoir une demande de confirmation par mail et l'entreprise également",
  },
  conventionAlreadySigned: (
    conventionId: ConventionId,
    agencyName: string,
  ) => ({
    title:
      internshipKind === "immersion"
        ? "Vous avez signé cette convention."
        : "Vous avez signé cette demande de stage.",
    description: `Vous recevrez un e-mail de confirmation lorsque toutes les parties auront signé la convention (${conventionId}) et qu'elle aura été validée par ${agencyName}.`,
  }),
  conventionReadyToBeSigned: {
    title:
      internshipKind === "immersion"
        ? "Cette demande d'immersion est prête à être signée."
        : "Cette demande de stage est prête à être signée.",
    description:
      "Veuillez vérifier les informations de la convention. Vous pourrez ensuite la signer ou la renvoyer pour modification.",
  },
  conventionNeedToBeSign: {
    title: "Attention",
    description:
      "Vous n’avez pas fini la signature de la convention. Pour le faire, cliquez sur “Signer” puis sur “Je termine la signature” dans la fenêtre “Accepter les dispositions réglementaires et terminer la signature”.",
  },
  conventionToSignOrAskForChanges:
    "Veuillez la signer ou la renvoyer pour modification.",
  conventionNotEditable:
    internshipKind === "immersion"
      ? "Cette demande d'immersion n'est plus modifiable."
      : "Cette demande de stage n'est plus modifiable.",
  verification: {
    rejectConvention: "Refuser l'immersion",
    modifyConvention: "Modifier la convention",
    modifyConventionAgency: "Modifier la structure d'accompagnement",
    modifyConventionAgencyTitle:
      "Rediriger vers la bonne structure d'accompagnement",
    modifyConventionOtherInformations: "Modifier une autre information",
    conventionAlreadyMarkedAsEligible: "Demande déjà pré-validée.",
    markAsEligible: "Pré-valider la demande",
    conventionAlreadyValidated: "Demande déjà validée",
    markAsValidated: "Valider la demande",
    markAsCancelled: "Annuler la demande",
    conventionAlreadyCancelled: "Demande déjà annulée.",
    markAsDeprecated: "Annuler la demande",
    modifyCounsellorName: "Modifier le nom du conseiller",
    modifyCounsellorNameTitle: "Modifier le nom du conseiller",
    broadcastConventionAgain: "Rediffuser dans votre applicatif",
    broadcastConventionAgainTitle: "Rediffuser dans votre applicatif",
  },
  sign: {
    title:
      internshipKind === "immersion"
        ? "Formulaire pour conventionner une période de mise en situation professionnelle (PMSMP)"
        : "Formulaire pour conventionner un mini stage",
    summary: `Voici la demande de convention qui vient d'être complétée.
    Relisez la bien et si cela vous convient, signez la avec le bouton "je
    signe cette demande"`,
    regulations:
      internshipKind === "immersion"
        ? "Ce formulaire vaut équivalence du CERFA 13912 * 05"
        : "",
    rejected: {
      title:
        internshipKind === "immersion"
          ? "Désolé : votre demande d'immersion a été refusée"
          : "Désolé : votre demande de mini stage a été refusée",
      detail:
        internshipKind === "immersion"
          ? "Votre demande d'immersion a été refusée. Vous avez reçu un mail vous en donnant les raisons."
          : "Votre demande de mini stage a été refusée. Vous avez reçu un mail vous en donnant les raisons.",
      contact: "Veuillez contacter votre conseiller pour plus d'informations.",
    },
    needsModification: {
      title: "Des modifications sont en cours sur votre demande",
      detail:
        internshipKind === "immersion"
          ? "Vous ne pouvez pas encore signer votre demande d'immersion car des modifications sont en cours. Vous recevrez un nouveau e-mail de signature lorsque les modifications seront faites."
          : "Vous ne pouvez pas encore signer votre demande de mini stage car des modifications sont en cours. Vous recevrez un nouveau e-mail de signature lorsque les modifications seront faites.",
    },
    deprecated: {
      title:
        internshipKind === "immersion"
          ? "Désolé : votre demande d'immersion a été annulée"
          : "Désolé : votre demande de mini stage a été annulée",
      detail:
        internshipKind === "immersion"
          ? "Votre demande d'immersion a été annulée. Il n'est plus possible de la signer."
          : "Votre demande de mini stage a été annulée.  Il n'est plus possible de la signer.",
    },
  },
});
