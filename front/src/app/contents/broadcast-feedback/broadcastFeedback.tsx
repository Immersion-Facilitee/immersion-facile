import type { ReactNode } from "react";
import {
  type BroadcastFeedbackConventionStatusCategory,
  type FunctionalBroadcastFeedbackErrorMessage,
  immersionFacileHelpdeskRootUrl,
  isFranceTravailBroadcastTemporaryNetworkErrorMessage,
  isFunctionalBroadcastFeedbackError,
} from "shared";

type BroadcastFeedbackError = {
  description: string;
  solution: (
    statusCategory: BroadcastFeedbackConventionStatusCategory,
  ) => NonNullable<ReactNode>;
};

const PcmIdentificationInstructions = () => (
  <p>
    Je me rends sur mon assistant Immersion Facilitée accessible depuis «
    Gestion des aides » via PCM pour forcer l’identification du bénéficiaire. Je
    suis la démarche indiquée dans le{" "}
    <a
      href="https://poleemploi.sharepoint.com/:p:/r/sites/NAT-Mediatheque-Appropriation/_layouts/15/Doc.aspx?sourcedoc=%7B40B26A24-77FD-40B3-A083-F6805C8C0B6E%7D&file=%5B26M03_3.C%5D_CFTPro_CDDE_Identification_Beneficiaires_Immersions.SA.V1.pptx&action=edit&mobileredirect=true"
      target="_blank"
      rel="noopener noreferrer"
    >
      guide
    </a>
    .
  </p>
);

const UnexpectedErrorInstructions = () => (
  <>
    <p>Cette erreur ne devrait pas arriver.</p>
    <p>
      Je contacte{" "}
      <a
        href={immersionFacileHelpdeskRootUrl}
        target="_blank"
        rel="noopener noreferrer"
      >
        le support Immersion Facilitée
      </a>
      , en précisant le numéro de la convention, son statut et l’erreur.
    </p>
  </>
);

const unidentifiedBeneficiaryError: BroadcastFeedbackError = {
  description:
    "L'adresse mail ET / OU le numéro de téléphone indiqué sur la convention ne sont pas identiques à ceux du dossier France Travail. Ou le candidat n’a jamais été inscrit (inconnu du SI France Travail).",
  solution: (statusCategory) => {
    if (statusCategory === "unvalidated")
      return (
        <>
          <PcmIdentificationInstructions />
          <p>
            Si l’adresse mail et le numéro de téléphone sont similaires entre
            France Travail et la convention :
          </p>
          <UnexpectedErrorInstructions />
        </>
      );

    if (statusCategory === "validated")
      return (
        <>
          <p>
            {"->"} Dans le cas où l'adresse mail et / ou le téléphone sont
            différents :
          </p>
          <PcmIdentificationInstructions />
          <p>
            {"->"} Dans le cas où il n'a jamais été inscrit (non connu du SI
            France Travail) :
          </p>
          <ul>
            <li>Je procède à l'inscription du bénéficiaire.</li>
            <li>
              Je rediffuse la convention dans mon SI France Travail depuis
              Immersion Facilitée.
            </li>
          </ul>
        </>
      );

    return (
      <>
        <p>
          {"->"} Dans le cas où l'adresse mail et / ou le téléphone sont
          différents :
        </p>
        <ul>
          <li>
            Je contacte le bénéficiaire pour l'informer que je modifie l'adresse
            mail et/ou le téléphone (de préférence un portable) indiqués sur la
            convention par ceux présents dans le dossier France Travail avant
            validation de la convention.
          </li>
          <li>
            Dès que la convention sera modifiée, elle s’installera dans votre SI
            et l’erreur disparaîtra de vos « conventions à vérifier ».
          </li>
        </ul>
        <p>
          {"->"} Dans le cas où il n'a jamais été inscrit (non connu du SI
          France Travail) :
        </p>
        <ul>
          <li>
            Je procède à son inscription avant validation de la convention.
          </li>
          <li>
            Je peux rediffuser la convention pour qu’elle s’installe dans mes
            applicatifs.
          </li>
          <li>
            Ou dès validation de la convention, elle s’installera
            automatiquement.
          </li>
        </ul>
      </>
    );
  },
};

const candidateBeneficiaryError: BroadcastFeedbackError = {
  description:
    "Personne en immersion connue du SI France Travail en tant que « candidat ».",
  solution: (statusCategory) => {
    if (statusCategory === "unvalidated")
      return <UnexpectedErrorInstructions />;

    if (statusCategory === "validated")
      return (
        <ul>
          <li>
            Je procède à son inscription en essayant de mettre les mêmes
            informations que sur la convention (mail et numéro de téléphone)
            dans le dossier FT. Sinon, je devrai traiter la nouvelle erreur.
          </li>
          <li>
            Je rediffuse la convention pour qu’elle s’installe dans mes
            applicatifs.
          </li>
        </ul>
      );

    return (
      <ul>
        <li>Je procède à son inscription.</li>
        <li>
          Je vérifie que l’adresse mail, le numéro de téléphone et la date de
          naissance correspondent aux informations dans le dossier France
          Travail, sinon je modifie la convention.
        </li>
        <li>
          Je peux rediffuser la convention pour qu’elle s’installe dans mes
          applicatifs, ou dès validation de la convention, elle s’installera
          automatiquement.
        </li>
      </ul>
    );
  },
};

const birthDateMismatchError: BroadcastFeedbackError = {
  description:
    "La date de naissance du bénéficiaire indiquée sur la convention n'est pas identique à celle du dossier France Travail.",
  solution: (statusCategory) =>
    statusCategory === "pendingValidation" ? (
      <ul>
        <li>
          Je modifie la date de naissance du bénéficiaire sur la convention en
          récupérant celle sous MAP.
        </li>
        <li>
          Dès que la convention sera modifiée, elle s’installera automatiquement
          dans mon SI et l’erreur disparaîtra de mes « conventions à vérifier ».
        </li>
      </ul>
    ) : (
      <>
        <p>
          Je procède à la modification de la date de naissance sur la
          convention.
        </p>
        <ul>
          <li>
            Depuis la convention : je clique sur « modifier la convention ».
          </li>
          <li>
            Je modifie la date de naissance sur la convention, puis je clique
            sur sauvegarder. Automatiquement la convention est installée dans
            vos applicatifs.
          </li>
          <li>J'actualise ma page pour vérifier que l'erreur a disparu.</li>
        </ul>
      </>
    ),
};

const multipleBeneficiariesError: BroadcastFeedbackError = {
  description:
    "Les informations mail, n° de téléphone ET/OU date de naissance communiquées sur la convention se retrouvent dans plusieurs dossiers France Travail.",
  solution: (statusCategory) =>
    statusCategory === "pendingValidation" ? (
      <>
        <p>
          J’identifie le bon candidat dans le SI France Travail et les
          informations qui diffèrent entre le SI France Travail et la
          convention.
        </p>
        <p>Je modifie les informations qui diffèrent sur la convention.</p>
        <p>
          Dès que la convention sera modifiée, elle s’installera automatiquement
          dans mon SI et l’erreur disparaîtra de mes « conventions à vérifier ».
        </p>
      </>
    ) : (
      <PcmIdentificationInstructions />
    ),
};

const unknownEstablishmentError: BroadcastFeedbackError = {
  description: "L'entreprise n'existe pas au sein d'Oscar",
  solution: (statusCategory) =>
    statusCategory === "pendingValidation" ? (
      <>
        <p>
          Je crée l'entreprise via RCE, si besoin, je contacte mon référent
          métier.
        </p>
        <ul>
          <li>
            Je peux rediffuser la convention pour qu’elle s’installe dans mes
            applicatifs,
          </li>
          <li>
            Ou dès validation de la convention, elle s’installera
            automatiquement.
          </li>
        </ul>
      </>
    ) : (
      <>
        <p>
          Je crée l'entreprise via RCE, si besoin, je contacte mon référent
          métier.
        </p>
        <ul>
          <li>
            Je rediffuse la convention pour qu’elle s’installe dans mes
            applicatifs.
          </li>
        </ul>
      </>
    ),
};

export const broadcastFeedbackErrorMessageMap: Record<
  FunctionalBroadcastFeedbackErrorMessage,
  BroadcastFeedbackError
> = {
  "Aucun dossier trouvé pour les critères d'identité transmis": {
    description: "Aucun dossier trouvé pour les critères d'identité transmis",
    solution: () => (
      <>
        <p>
          Cette erreur survient généralement lorsqu'il existe une discordance
          sur la date de naissance du bénéficiaire. Vérification préalable :
          Assurez-vous que le jeune est correctement inscrit au sein de votre
          Mission Locale.
        </p>
        <p>
          {"->"} Si le bilan a déjà été saisi, la convention est ancienne et/ou
          vous n'êtes plus en contact avec l'entreprise accueillante : <br />
          Contactez le support Immersion Facilitée en précisant l'ID de la
          convention et la date de naissance. Nos équipes corrigeront la donnée
          et diffuseront la convention dans vos applicatifs."
        </p>
        {"->"} L'immersion n'a pas encore eu lieu, vous êtes en contact avec
        l'entreprise et le bilan n'a pas encore été saisi :
        <ol>
          <li>Dupliquez la convention.</li>
          <li>Corrigez la date de naissance du bénéficiaire.</li>
          <li>Renvoyez la nouvelle convention en signature.</li>
          <li>Annulez l'ancienne convention.</li>
        </ol>
      </>
    ),
  },
  "Aucune mission locale trouvée pour le numéro de SIRET fourni": {
    description:
      "Aucune mission locale trouvée pour le numéro de SIRET fourni.",
    solution: () => <p>{"->"} Contactez le support Immersion Facilitée.</p>,
  },
  "L'email transmis par le partenaire ne correspond pas à l'email renseigné dans le dossier du jeune":
    {
      description:
        "L'email transmis par le partenaire ne correspond pas à l'email renseigné dans le dossier du jeune.",
      solution: (statusCategory) => (
        <>
          <p>
            {"->"} Si les bonnes informations sont celles saisies dans la
            convention, modifiez les informations du candidat dans votre
            logiciel (i-milo), puis rediffusez la convention via Immersion
            Facilitée.
          </p>
          <p>
            {"->"} Si les bonnes informations sont celles saisies dans votre
            logiciel (i-milo)
            {statusCategory === "pendingValidation"
              ? ", modifiez les informations du candidat sur la demande de convention, et renvoyez-la en signature."
              : " :"}
          </p>
          {statusCategory !== "pendingValidation" && (
            <ol>
              <li>Dupliquez la convention.</li>
              <li>Corrigez les informations bénéficiaire.</li>
              <li>Renvoyez la nouvelle convention en signature.</li>
              <li>Annulez l'ancienne convention.</li>
            </ol>
          )}
        </>
      ),
    },
  "Aucun employeur trouvé pour le code renseigné": {
    description:
      "L'entreprise n'existe pas dans votre logiciel, ou existe avec un SIRET différent.",
    solution: () => (
      <>
        <p>
          {"->"} Créez l'entreprise dans votre logiciel (i-milo), avec le SIRET
          présent dans la demande de convention.
        </p>
        <p>
          {"->"} Rediffuser la convention dans votre SI depuis Immersion
          facilitée
        </p>
        <p>
          Le SIRET de l'entreprise est automatiquement vérifié dès la création
          de la demande sur Immersion Facilitée, donc il ne peut pas être erroné
          ou correspondre à une entreprise fermée.
        </p>
      </>
    ),
  },
  "Le téléphone transmis par le partenaire ne correspond pas au téléphone renseigné dans le dossier du jeune":
    {
      description:
        "Le téléphone transmis par le partenaire ne correspond pas au téléphone renseigné dans le dossier du jeune.",
      solution: (statusCategory) => (
        <>
          <p>
            {"->"} Si les bonnes informations sont celles saisies dans la
            convention, modifiez les informations du candidat dans votre
            logiciel (i-milo), puis rediffusez la convention via Immersion
            Facilitée.
          </p>

          <p>
            {"->"} Si les bonnes informations sont celles saisies dans votre
            logiciel (i-milo)
            {statusCategory === "pendingValidation"
              ? ", modifiez les informations du candidat sur la demande de convention, et renvoyez-la en signature."
              : " :"}
          </p>
          {statusCategory !== "pendingValidation" && (
            <ol>
              <li>Dupliquez la convention.</li>
              <li>Corrigez les informations bénéficiaire.</li>
              <li>Renvoyez la nouvelle convention en signature.</li>
              <li>Annulez l'ancienne convention.</li>
            </ol>
          )}
        </>
      ),
    },
  "Aucun métier trouvé pour le code ROME renseigné": {
    description: "Aucun métier trouvé pour le code ROME renseigné.",
    solution: () => (
      <>
        <p>{"->"} Rediffusez la convention.</p>
      </>
    ),
  },
  "L'email et le téléphone transmis par le partenaires ne correspondent pas aux email et téléphone renseignés dans le dossier du jeune":
    {
      description:
        "L'email et le téléphone transmis par le partenaires ne correspondent pas aux email et téléphone renseignés dans le dossier du jeune.",
      solution: (statusCategory) => (
        <>
          <p>
            {"->"} Si les bonnes informations sont celles saisies dans la
            convention, modifiez les informations du candidat dans votre
            logiciel (i-milo), puis rediffusez la convention via Immersion
            Facilitée.
          </p>

          <p>
            {"->"} Si les bonnes informations sont celles saisies dans votre
            logiciel (i-milo)
            {statusCategory === "pendingValidation"
              ? ", modifiez les informations du candidat sur la demande de convention, et renvoyez-la en signature."
              : " :"}
          </p>
          {statusCategory !== "pendingValidation" && (
            <ol>
              <li>Dupliquez la convention.</li>
              <li>Corrigez les informations bénéficiaire.</li>
              <li>Renvoyez la nouvelle convention en signature.</li>
              <li>Annulez l'ancienne convention.</li>
            </ol>
          )}
        </>
      ),
    },
  "Plusieurs dossiers trouvés pour les critères transmis": {
    description: "Plusieurs dossiers trouvés pour les critères transmis.",
    solution: () => (
      <>
        <p>
          {"->"} Regroupez les informations dans un seul et même dossier, et
          supprimez les dossiers qui ne sont plus utilisés.
        </p>
        <p>{"->"} Puis rediffusez la convention.</p>
      </>
    ),
  },
  "Identifiant National DE non trouvé": unidentifiedBeneficiaryError,
  "Identifiant National DE trouvé mais écart sur la date de naissance":
    birthDateMismatchError,
  "Identifiant National DE trouvé, le bénéficiaire est un candidat":
    candidateBeneficiaryError,
  "Identifiant National DE trouvé mais écart sur la date de naissance, le bénéficiaire est un candidat":
    candidateBeneficiaryError,
  "Identifiant national non trouvé": unidentifiedBeneficiaryError,
  "Identifiant national non trouvé avec le numéro de téléphone":
    unidentifiedBeneficiaryError,
  "Identifiant national trouvé avec le mail, bénéficiaire est un candidat":
    candidateBeneficiaryError,
  "Identifiant national trouvé avec le téléphone, bénéficiaire est un candidat ":
    candidateBeneficiaryError,
  "Identifiant national DE trouvé avec le mail mais écart sur la date de naissance":
    birthDateMismatchError,
  "Identifiant National DE trouvé avec le téléphone, mais écart sur la date de naissance":
    birthDateMismatchError,
  "Identifiant National trouvé avec le mail, mais écart sur la date de naissance, bénéficiaire est un candidat":
    candidateBeneficiaryError,
  "Identifiant National trouvé avec le téléphone, mais écart sur la date de naissance, bénéficiaire est un candidat":
    candidateBeneficiaryError,
  "Plusieurs Identifiant National DE trouvés": multipleBeneficiariesError,
  "Plusieurs Identifiants nationaux DE trouvés avec mail":
    multipleBeneficiariesError,
  "Plusieurs Identifiants nationaux DE trouvés avec téléphone":
    multipleBeneficiariesError,
  "Plusieurs Identifiants nationaux DE trouvés avec mail et téléphone ":
    multipleBeneficiariesError,
  "Le bénéficiaire FT connect est un candidat": candidateBeneficiaryError,
  "Accord non signé pour ce type de structure d'accompagnement": {
    description: "Accord non signé pour ce type de structure d'accompagnement.",
    solution: () => (
      <>
        <p>{"->"} Contactez le support Immersion Facilitée.</p>
      </>
    ),
  },
  "Etablissement inconnu du référentiel employeur de France Travail":
    unknownEstablishmentError,
} satisfies Record<
  FunctionalBroadcastFeedbackErrorMessage,
  BroadcastFeedbackError
>;

export const franceTravailTemporaryNetworkErrorBroadcastFeedback: BroadcastFeedbackError =
  {
    description: "La synchronisation n'a pas pu aboutir.",
    solution: () => (
      <>
        <p>
          Ce problème est souvent temporaire (connexion réseau ou disponibilité
          du service).
        </p>
        <p>
          Vous pouvez relancer une resynchronisation manuelle depuis le bouton «
          Gérer la synchronisation ».
        </p>
      </>
    ),
  };

export const getBroadcastFeedbackDescription = (errorMessage: string) => {
  if (isFunctionalBroadcastFeedbackError(errorMessage))
    return broadcastFeedbackErrorMessageMap[errorMessage].description;

  if (isFranceTravailBroadcastTemporaryNetworkErrorMessage(errorMessage))
    return franceTravailTemporaryNetworkErrorBroadcastFeedback.description;

  return "Erreur technique : Immersion Facilitée travaille actuellement à une résolution avec votre DSI.";
};
