import type { Dispatch } from "@reduxjs/toolkit";
import type {
  FaqCardProps,
  HeroHeaderNavCard,
  Stat,
} from "react-design-system";
import { domElementIds, frontRoutes } from "shared";
import type { UserType } from "src/app/pages/home/HomePage";
import { authSlice } from "src/core-logic/domain/auth/auth.slice";
import heroHeaderAgencyIllustration from "/src/assets/img/illustration-agency-hero.webp";
import heroHeaderCandidateIllustration from "/src/assets/img/illustration-candidate-hero.webp";
import heroHeaderDefaultIllustration from "/src/assets/img/illustration-default-hero.webp";
import heroHeaderEstablishmentIllustration from "/src/assets/img/illustration-establishment-hero.webp";

type HeroHeaderInfos = {
  displayName: string;
  title: string;
  subtitle: string;
  icon: string;
  illustration: string;
};

export const heroHeaderContent: Record<UserType, HeroHeaderInfos> = {
  default: {
    title: "Faciliter la réalisation des immersions professionnelles",
    displayName: "default",
    illustration: heroHeaderDefaultIllustration,
    icon: "",
    subtitle:
      "Avec Immersion Facilitée, trouvez un métier à tester, entrez en relation immédiatement avec une entreprise accueillante, remplissez une demande de convention et obtenez une réponse en un temps record !",
  },
  candidate: {
    title:
      "L'immersion professionnelle, la meilleure façon de découvrir votre futur métier",
    displayName: "Candidat",
    illustration: heroHeaderCandidateIllustration,
    icon: "fr-icon-user-line",
    subtitle:
      "Assurez le succès de votre projet professionnel en découvrant un métier en conditions réelles. Passez quelques jours en entreprise pour vérifier que ce métier vous plaît et vous convient. Profitez-en pour découvrir éventuellement votre futur employeur !",
  },
  establishment: {
    title: "Recrutez plus facilement avec l'immersion professionnelle",
    displayName: "Entreprise",
    illustration: heroHeaderEstablishmentIllustration,
    icon: "fr-icon-building-line",
    subtitle:
      "Faites découvrir vos métiers et votre entreprise à de potentiels candidats. Vous avez déjà des candidatures ? Testez un candidat en conditions réelles avant la signature du contrat.",
  },
  agency: {
    title:
      "Signez et gérez facilement vos conventions d'immersion professionnelle",
    displayName: "Prescripteur",
    illustration: heroHeaderAgencyIllustration,
    icon: "fr-icon-map-pin-user-line",
    subtitle:
      "Avec Immersion Facilitée, fini la paperasse et les aller-retours pour faire signer vos conventions. Suivez facilement celles en cours.",
  },
};

export const ressourcesAndWebinarsUrl =
  "https://pages.immersion-facile.beta.gouv.fr/ressources-webinaires-prescripteurs-immersion-professionnelle-pmsmp";

export const heroHeaderNavCards: (
  storeDispatch: Dispatch,
) => Record<UserType, HeroHeaderNavCard[]> = (storeDispatch: Dispatch) => {
  return {
    default: [
      {
        overtitle: "Candidat",
        title: "Vous êtes candidat pour une immersion",
        icon: "fr-icon-user-line",
        type: "candidate",
        id: domElementIds.home.heroHeader.candidate,
        link: frontRoutes.homeCandidates().link,
      },
      {
        overtitle: "Entreprise",
        title: "Vous représentez une entreprise",
        icon: "fr-icon-building-line",
        id: domElementIds.home.heroHeader.establishment,
        type: "establishment",
        link: frontRoutes.homeEstablishments().link,
      },
      {
        overtitle: "Prescripteur",
        title: "Vous êtes prescripteur",
        icon: "fr-icon-map-pin-user-line",
        id: domElementIds.home.heroHeader.agency,
        type: "agency",
        link: frontRoutes.homeAgencies().link,
      },
    ],
    candidate: [
      {
        title: "Rechercher une entreprise accueillante",
        icon: "fr-icon-search-line",
        type: "candidate",
        id: domElementIds.homeCandidates.heroHeader.search,
        link: frontRoutes.search().link,
      },
      {
        title: "Remplir la demande de convention",
        icon: "fr-icon-draft-line",
        type: "candidate",
        id: domElementIds.homeCandidates.heroHeader.formConvention,
        link: frontRoutes.initiateConvention({ skipFirstStep: true }).link,
        alternateTitle:
          "Remplir la demande de convention : en quelques minutes, sans avoir besoin de créer un compte.",
      },
      {
        title: "Mon espace",
        icon: "fr-icon-admin-line",
        type: "candidate",
        id: domElementIds.homeCandidates.heroHeader.dashboard,
        link: frontRoutes.beneficiaryDashboard().link,
        alternateTitle:
          "Mon espace : espace personnel nominatif où retrouver mes échanges avec les entreprises, etc.",
      },
    ],
    establishment: [
      {
        title: "Inscrire une entreprise",
        icon: "fr-icon-award-line",
        type: "establishment",
        id: domElementIds.homeEstablishments.heroHeader.addEstablishmentForm,
        link: frontRoutes.formEstablishment().link,
        alternateTitle:
          "Inscrire une entreprise : mon entreprise apparaîtra dans les résultats de recherche des candidats.",
      },
      {
        title: "Remplir la demande de convention",
        icon: "fr-icon-draft-line",
        type: "establishment",
        id: domElementIds.homeEstablishments.heroHeader.formConvention,
        link: {
          href: "",
          onClick: (event) => {
            event.preventDefault();
            storeDispatch(
              authSlice.actions.federatedIdentityProvided({
                federatedIdentity: null,
                feedbackTopic: "auth-global",
              }),
            );
            frontRoutes.conventionImmersion().push();
          },
        },
        alternateTitle:
          "Remplir la demande de convention : en quelques minutes, sans avoir besoin de créer un compte.",
      },
      {
        title: "Mon espace",
        icon: "fr-icon-admin-line",
        type: "establishment",
        id: domElementIds.homeEstablishments.heroHeader.establishmentDashboard,
        link: frontRoutes.establishmentDashboardConventions().link,
        alternateTitle:
          "Mon espace : espace personnel nominatif où retrouver mes conventions, échanges avec les candidats, etc.",
      },
    ],
    agency: [
      {
        title: "Inscrire mon organisme",
        icon: "fr-icon-hotel-line",
        type: "agency",
        id: domElementIds.homeAgencies.heroHeader.addAgencyForm,
        link: frontRoutes.agencyDashboardAgencies().link,
      },
      {
        title: "Remplir la demande de convention",
        icon: "fr-icon-draft-line",
        id: domElementIds.homeAgencies.heroHeader.formConvention,
        type: "agency",
        link: {
          href: "",
          onClick: (event) => {
            event.preventDefault();
            storeDispatch(
              authSlice.actions.federatedIdentityProvided({
                federatedIdentity: null,
                feedbackTopic: "auth-global",
              }),
            );
            frontRoutes.conventionImmersion().push();
          },
        },
        alternateTitle:
          "Remplir la demande de convention : en quelques minutes, sans avoir besoin de créer un compte.",
      },
      {
        title: "Mon espace",
        icon: "fr-icon-admin-line",
        type: "agency",
        id: domElementIds.homeAgencies.heroHeader.agencyDashboard,
        link: frontRoutes.agencyDashboardMain().link,
        alternateTitle:
          "Mon espace : espace personnel nominatif où retrouver mes conventions et statistiques.",
      },
      {
        title: "Ressources et webinaires",
        icon: "fr-icon-book-2-line",
        type: "agency",
        id: domElementIds.home.heroHeader.resourcesAndWebinars,
        link: { href: ressourcesAndWebinarsUrl },
        alternateTitle:
          "Ressources et webinaires : découvrez nos ressources dédiées pour guider et être guidé.",
      },
    ],
  };
};
export const sectionStatsData: Record<UserType, Stat[]> = {
  default: [
    {
      badgeLabel: "Découverte",
      value: "1",
      subtitle: "jour, 1 semaine ou 1 mois en entreprise",
      description:
        "L’immersion professionnelle est une période courte, variable, adaptée à vos besoins et non rémunérée pour découvrir le métier de votre choix.",
    },
    {
      badgeLabel: "Simplicité",
      value: "100%",
      subtitle: "démarche dématérialisée",
    },
    {
      badgeLabel: "Opportunité",
      value: "7",
      subtitle: "demandeurs d’emploi sur 10",
      description:
        "trouvent un emploi dans les mois qui suivent leur immersion, selon une étude France Travail (anciennement Pôle emploi) en 2021.",
    },
  ],
  candidate: [
    {
      badgeLabel: "Découverte",
      value: "1",
      subtitle: "jour, 1 semaine ou 1 mois en entreprise",
      description:
        "L’immersion professionnelle est une période courte, variable, adaptée à vos besoins et non rémunérée pour découvrir le métier de votre choix.",
    },
    {
      badgeLabel: "Simplicité",
      value: "100%",
      subtitle: "démarche dématérialisée",
    },
    {
      badgeLabel: "Opportunité",
      value: "7",
      subtitle: "demandeurs d’emploi sur 10",
      description:
        "trouvent un emploi dans les mois qui suivent leur immersion, selon une étude France Travail (anciennement Pôle emploi) en 2021.",
    },
  ],
  establishment: [
    {
      badgeLabel: "Flexible",
      value: "1",
      subtitle: "jour, 1 semaine ou 1 mois",
      description:
        "Accueillez un potentiel candidat dans votre entreprise pendant une courte durée afin de lui faire découvrir le métier de votre choix",
    },
    {
      badgeLabel: "Simple",
      value: "0",
      subtitle: "euro",
      description:
        "Vous n'avez pas à rémunérer le candidat ou à prendre une assurance, tout est géré par son organisme prescripteur (France Travail, Cap Emploi, Mission Locale, etc.) ",
    },
    {
      badgeLabel: "Rapide",
      value: "0",
      subtitle: "papier",
      description:
        "Tout se passe en ligne, ici : dépôt de votre offre, réception des candidatures (si nécessaire) puis signature de la convention dématérialisée",
    },
  ],
  agency: [
    {
      badgeLabel: "Rapide",
      value: "2",
      subtitle: "jours seulement",
      description:
        "90% des demandes de conventions sont validées et transmises en moins de 48h",
    },
    {
      badgeLabel: "Simple",
      value: "100%",
      subtitle: "démarche dématérialisée",
    },
    {
      badgeLabel: "Opportunité",
      value: "9",
      subtitle: "entreprises sur 10",
      description:
        "90% des entreprises sont satisfaites à l'issu d'une immersion",
    },
  ],
};

export const sectionFaqData: Record<UserType, FaqCardProps[]> = {
  default: [
    {
      title: "Comment trouver une entreprise accueillante ?",
      description: `A partir de la page candidat du service Immersion Facilitée, cliquez sur le bouton "Trouver une entreprise accueillante" ou rendez-vous directement sur la page...`,
      url: "https://immersion-facile.beta.gouv.fr/aide/article/comment-rechercher-une-entreprise-accueillante-ek1x8s/",
    },
    {
      title: "A quoi sert une immersion professionnelle ?",
      description:
        "Elle vous permet d’assurer le succès de votre projet professionnel en découvrant un métier en conditions réelles, de passer quelques jours en entreprise pour vérifier...",
      url: "https://immersion-facile.beta.gouv.fr/aide/article/a-quoi-sert-une-immersion-professionnelle-1yd6ije/",
    },
    {
      title: "Comment signer ma convention ou envoyer un lien de signature ?",
      description:
        "Pour signer votre convention vous devez connaitre votre ID de convention et utiliser le mail que vous nous avez indiqué...",
      url: "https://immersion-facile.beta.gouv.fr/aide/article/comment-signer-ma-convention-ou-envoyer-un-lien-de-signature-si-je-nai-plus-le-lien-envoye-par-mail-125bxxd/",
    },
  ],
  candidate: [
    {
      title: "Qui peut bénéficier d'une Immersion Professionnelle (PMSMP) ?",
      description:
        "S’inscrivant dans une démarche préventive (bénéficiaire salarié en recherche d’emploi ou de réorientation professionnelle) et proactive (bénéficiaire privé d’emploi, inscrit ou non auprès de France Travail, anciennement Pôle emploi), les périodes...",
      url: "https://immersion-facile.beta.gouv.fr/aide/article/qui-peut-beneficier-dune-immersion-professionnelle-pmsmp-jz1af4/",
    },
    {
      title:
        "Je n'ai pas de structure d'accompagnement et je veux faire une immersion",
      description:
        " Pour faire une immersion et avoir une convention, il faut que vous soyez accompagné(e) par un organisme qui sera responsable de cette convention...",
      url: "https://immersion-facile.beta.gouv.fr/aide/article/je-nai-pas-de-structure-daccompagnement-et-je-veux-faire-une-immersion-1x15rdp/",
    },
    {
      title: "Quelles sont les obligations à respecter pour une immersion ?",
      description:
        "Le bénéficiaire s’engage à exercer les activités et tâches telles que définies dans la présente convention et à mettre en œuvre l’ensemble des actions lui permettant d’atteindre les objectifs...",
      url: "https://immersion-facile.beta.gouv.fr/aide/article/quelles-sont-les-obligations-a-respecter-pour-une-immersion-1bl944v/",
    },
  ],
  establishment: [
    {
      title:
        "Comment référencer mon entreprise en tant qu'entreprise accueillante ?",
      description: `A partir de la page d'accueil du service Immersion Facilitée, cliquez sur le bouton "Vous représentez une entreprise", puis sur "Référencer mon Entreprise"...`,
      url: "https://immersion-facile.beta.gouv.fr/aide/article/comment-referencer-mon-entreprise-en-tant-quentreprise-accueillante-zr6rxv/",
    },
    {
      title:
        "Ma structure peut-elle accueillir des immersions professionnelles ?",
      description:
        "Une immersion professionnelle (ou Période de mise en situation en milieu professionnel -PMSMP) peut se faire dans n’importe quel type d’établissement, y compris le secteur public ou associatif...",
      url: "https://immersion-facile.beta.gouv.fr/aide/article/ma-structure-peut-elle-accueillir-des-immersions-professionnelles-1ccin58/",
    },
    {
      title:
        "Vous avez encore des questions ? Participez à notre prochain webinaire",
      description:
        "Régulièrement, nous organisons des webinaires en ligne pour vous présenter l'immersion professionnelle, notre plateforme, et répondre à vos questions. Cliquez-ici pour vous inscrire à la prochaine session",
      url: "https://app.livestorm.co/itou/webinaire-proposer-des-immersions-pour-attirez-les-talents-1?type=detailed&utm_source=home-entreprise-if",
    },
  ],
  agency: [
    {
      title:
        "Puis-je faire une demande de convention avec une entreprise non inscrite sur le site ?",
      description:
        "La réponse en trois mots : oui, bien sûr. Les entreprises accueillantes sont des entreprises que nous avons contactées et qui se sont engagées à accueillir des immersions...",
      url: "https://immersion-facile.beta.gouv.fr/aide/article/puis-je-faire-une-immersion-dans-une-entreprise-non-referencee-sur-immersion-facilitee-ee9tak/",
    },
    {
      title: "Qui peut prescrire une immersion ?",
      description:
        "Les prescripteurs de droit commun (France Travail, Missions Locales, Cap emploi, Conseil Départemental, CEP, SIAE sauf ETTI et prépa apprentissage) et tous les professionnels de l'accompagnement qui peuvent avoir une délégation auprès des prescripteurs de droit commun.",
      url: "https://immersion-facile.beta.gouv.fr/aide/article/qui-peut-prescrire-une-immersion-6frnyn/?bust=1722505187338",
    },
    {
      title:
        "Le bénéficiaire, l'entreprise ou le prescripteur n'a pas reçu la convention à signer",
      description: `Que vous soyez bénéficiaire, entreprise accueillante ou prescripteur d'immersions, il est nécéssaire de pouvoir recevoir nos emails afin de signer éléctroniquement la convention....`,
      url: "https://immersion-facile.beta.gouv.fr/aide/article/prescripteur-comment-envoyer-un-lien-de-signature-a-un-candidat-ou-une-entreprise-qui-na-pas-le-mail-de-signature-119woyc/",
    },
  ],
};
