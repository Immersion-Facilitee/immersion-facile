import type { SectionStepsProps } from "react-design-system";
import type { InternshipKind } from "shared";

export const immersionStepsContent: Record<InternshipKind, SectionStepsProps> =
  {
    immersion: {
      title: "Le parcours d'une immersion en 5 étapes",
      steps: [
        {
          title: "Candidatures",
          description: "Trouvez le terrain d'immersion qui vous correspond",
        },
        {
          title: "Préparation",
          description:
            "Échangez avec l'entreprise sur les conditions de l'immersion",
        },
        {
          title: "Convention",
          description:
            "Complétez la convention avec l'aide de l'entreprise et de votre conseiller",
        },
        {
          title: "Confirmation",
          description:
            "Recevez la validation de la convention et démarrez l'immersion",
        },
        {
          title: "Bilan",
          description:
            "Faites le point sur votre expérience avec l'entreprise le dernier jour",
        },
      ],
    },
    "mini-stage-cci": {
      title: "Le parcours d'un mini-stage en 5 étapes",
      steps: [
        {
          title: "Candidatures",
          description: "Trouvez le terrain de mini-stage qui vous correspond",
        },
        {
          title: "Préparation",
          description:
            "Échangez avec l'entreprise sur les conditions du mini-stage",
        },
        {
          title: "Convention",
          description:
            "Complétez la convention avec l'aide de l'entreprise et de votre conseiller",
        },
        {
          title: "Confirmation",
          description:
            "Recevez la validation de la convention et démarrez le mini-stage",
        },
        {
          title: "Bilan",
          description:
            "Faites le point sur votre expérience avec l'entreprise le dernier jour",
        },
      ],
    },
  };

export const searchResultContent = {
  header: {
    lbbTag: "Tentez votre chance",
    websiteLink: "Site web",
    employeesCount: (numberOfEmployeeRange: string): string =>
      `${numberOfEmployeeRange} salariés`,
  },
  error: {
    locationMissingTitle: "Oups !",
    locationMissingDescription:
      "L'offre ne peut plus être affichée (paramètre de localisation invalide), veuillez relancer une recherche d'offre d'immersion pour retrouver une offre.",
    backToSearchButton: "Retour à la recherche",
  },
  contactUnavailable: {
    title: "Mise en relation temporairement indisponible",
    maxReached:
      "Cette entreprise a atteint son nombre maximal de mises en relation pour le moment.",
    searchOtherEstablishments:
      "Nous vous invitons à consulter d’autres entreprises accueillantes via le moteur de recherche afin de poursuivre votre démarche d’immersion.",
    retryTitle: "Quand réessayer ?",
    retryDescription:
      "Les mises en relation sont réinitialisées chaque mois. Il est donc possible que cette entreprise soit à nouveau disponible prochainement, notamment en début de mois.",
    searchAnotherEstablishmentButton: "Rechercher une autre entreprise",
  },
  about: {
    title: "À propos de l’entreprise",
  },
  job: {
    appellationInformationLink: "Fiche métier France Travail",
    nafInformationLink: "Données INSEE",
    immersionActivitiesTitle: "Activités pendant l'immersion",
    noImmersionActivities:
      "L'entreprise n'a pas encore décrit cette immersion. Pour découvrir ce métier, consultez",
    noImmersionActivitiesAppellationInformationLink:
      "la fiche métier France Travail",
  },
  location: {
    title: "Localisation",
    googleMapsLink: "Ouvrir dans Google Maps",
  },
  company: {
    title: "L'entreprise",
    nafLabel: "Secteur d'activité (NAF)",
    employeesLabel: "Effectif",
    siretLabel: "SIRET",
  },
  badges: {
    superEstablishment: {
      label: "Super entreprise",
      description:
        "Cette entreprise a déjà accueilli des immersions et répond activement aux candidatures.",
    },
    disabledWorkersDeclared: {
      label: "Personnes en situation de handicap bienvenues",
      description:
        "L’entreprise a indiqué être prête à accueillir une personne en situation de handicap.",
    },
    disabledWorkersCertified: {
      label: "Reconnue handi-engagée",
      description:
        "L’entreprise est reconnue handi-engagée pour l’accueil de personnes en situation de handicap.",
    },
  },
};
