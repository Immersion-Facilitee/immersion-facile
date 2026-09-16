import type { FrontRouteKeys, GroupName, StandardPageSlugs } from "shared";

export type MetaContentType = {
  title: string;
  description: string;
};

export const defaultMetaContents: MetaContentType = {
  title: "PMSMP: Immersion Facile",
  description: "Faciliter la réalisation des immersions professionnelles.",
};

export const defaultPageMetaContents: Partial<
  Record<FrontRouteKeys, MetaContentType>
> = {
  addAgency: {
    title: "Formulaire d'ajout d'un prescripteur",
    description: "Devenir prescripteur de PMSMP et immersions professionnelles",
  },
  admin: {
    title: "Admin",
    description: "Faciliter la réalisation des immersions professionnelles.",
  },
  adminConventions: {
    title: "Admin: conventions",
    description: "Page admin: Conventions",
  },
  adminEvents: {
    title: "Admin: évenement",
    description: "Page admin: Evenement",
  },
  adminAgencies: {
    title: "Admin: validation d'agence",
    description: "Page admin: Validation d'agence",
  },
  adminUsers: {
    title: "Admin: utilisateurs",
    description: "Page admin: Utilisateurs",
  },
  adminNotifications: {
    title: "Admin: notifications",
    description: "Page admin: Notifications",
  },
  adminTechnicalOptions: {
    title: "Admin: options techniques",
    description: "Page admin: Options techniques",
  },
  adminEmailPreview: {
    title: "Admin: aperçus email",
    description: "Page admin: Aperçus email",
  },
  adminEstablishments: {
    title: "Admin: établissements",
    description: "Page admin: Établissements",
  },
  formEstablishment: {
    title: "Formulaire de référencement entreprise",
    description:
      "Devenir entreprise accueillante de PMSMP et immersions professionnelles.",
  },
  home: {
    title: "Accueil Immersion Facilitée",
    description:
      "Faciliter la réalisation des immersions professionnelles et PMSMP.",
  },
  homeCandidates: {
    title: "Accueil béneficiaires",
    description:
      "Trouver une entreprise pour votre Immersion Professionnelle ou PMSMP et faire une demande de convention.",
  },
  homeEstablishments: {
    title: "Accueil entreprises",
    description:
      "Devenir entreprise accueillante de PMSMP et immersions professionnelles ou modifier une fiche entreprise",
  },
  homeAgencies: {
    title: "Accueil prescripteurs",
    description: "Devenir prescripteur de PMSMP et immersions professionnelles",
  },
  conventionImmersion: {
    title: "Formulaire de demande d'immersion",
    description:
      "Démarrer une demande de convention pour une PMSMP ou Immersion Professionnelle.",
  },
  conventionMiniStage: {
    title: "Demande de mini-stage",
    description:
      "Démarrer une demande de convention pour un mini-stage, stage de 3ème ou stage de seconde.",
  },
  manageConvention: {
    title: "Vérification de convention d'immersion",
    description: "Faciliter la réalisation des immersions professionnelles.",
  },
  conventionToSign: {
    title: "Vérifier et signer une convention d'immersion",
    description: "Faciliter la réalisation des immersions professionnelles.",
  },
  conventionStatusDashboard: {
    title: "Statut convention",
    description: "Faciliter la réalisation des immersions professionnelles.",
  },
  assessment: {
    title: "Bilan d'immersion",
    description: "Faciliter la réalisation des immersions professionnelles.",
  },
  stats: {
    title: "Statistiques",
    description:
      "Découvrir les statistiques et l'impact du site Immersion Facile",
  },
  search: {
    title:
      "Rechercher une entreprise pour réaliser une immersion professionnelle",
    description:
      "Utilisez notre moteur de recherche pour trouver une entreprise accueillante d'Immersions Professionnelles ou PMSMP",
  },
  agencyDashboardMain: {
    title: "Tableau de bord agence",
    description: "Retrouvez vos conventions en cours et passées",
  },
  beneficiaryDashboard: {
    title: "Tableau de bord bénéficiaire",
    description: "Bientôt disponible",
  },
  establishmentDashboard: {
    title: "Tableau de bord entreprise",
    description:
      "Retrouvez vos conventions en cours et passées, les candidatures faites à votre entreprise",
  },
  initiateConvention: {
    title: "Initier une convention",
    description:
      "Initier une convention pour une Immersion Professionnelle (PMSMP)",
  },
  openApiDoc: {
    title: "Documentation API",
    description: "Documentation de l'API de l'application Immersion Facilitée",
  },
  conventionConfirmation: {
    title: "Confirmation de la convention",
    description:
      "Confirmation de la convention d'immersion professionnelle (PMSMP)",
  },
  searchResult: {
    title: "Offre d'immersion (PMSMP)",
    description: "Fiche présentant une offre d'immersion (PMSMP)",
  },
  searchResultExternal: {
    title: "Offre d'immersion (PMSMP)",
    description: "Fiche présentant une offre d'immersion (PMSMP)",
  },
  conventionDocument: {
    title: "Document de convention d'immersion (PMSMP) finalisé",
    description: "Document de convention d'immersion (PMSMP) finalisé",
  },
  group: {
    title: "Page de regroupement d'immersions",
    description: "Page de regroupement d'immersions",
  },
};

export const standardMetaContent: Record<StandardPageSlugs, MetaContentType> = {
  "mentions-legales": {
    title: "Mentions légales",
    description: "Faciliter la réalisation des immersions professionnelles.",
  },
  cgu: {
    title: "Conditions générales d'utilisation",
    description: "Page des conditions générales d'utilisation",
  },
  "politique-de-confidentialite": {
    title: "Politique de confidentialité",
    description: "Faciliter la réalisation des immersions professionnelles.",
  },
  accessibilite: {
    title: "Accessibilité",
    description: "Faciliter la réalisation des immersions professionnelles.",
  },
  "plan-du-site": {
    title: "Plan du site",
    description: "Plan du site: Immersion Facile",
  },
  "obligations-des-parties": {
    title: "Obligations des parties",
    description: "Faciliter la réalisation des immersions professionnelles.",
  },
  budget: {
    title: "Budget",
    description: "Présentation du budget d'Immersion Facilitée",
  },
};

export const groupMetaContent = (groupName: GroupName): MetaContentType => ({
  title: `${groupName} - Toutes les immersions`,
  description: `Toutes les immersions proposées par ${groupName}`,
});
