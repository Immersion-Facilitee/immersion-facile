import type { BreadcrumbProps } from "@codegouvfr/react-dsfr/Breadcrumb";
import { type FrontRouteKeys, frontRoutes, useRoute } from "shared";
import {
  type Breadcrumbs,
  makeBreadcrumbsSegments,
} from "src/app/utils/breadcrumbs";

const defaultAncestor: BreadcrumbProps["segments"][0] = {
  label: "Accueil",
  linkProps: frontRoutes.home().link,
};

export const breadcrumbs: Breadcrumbs<FrontRouteKeys> = {
  homeAgencies: {
    label: "Organismes prescripteurs",
    route: frontRoutes.homeAgencies(),
    isDisplayedOnOwnPage: false,
    children: {
      addAgency: {
        label: "Inscrire mon organisme",
        route: frontRoutes.addAgency(),
      },
    },
  },
  homeCandidates: {
    label: "Candidats",
    route: frontRoutes.homeCandidates(),
    isDisplayedOnOwnPage: false,
    children: {
      search: {
        label: "Recherche",
        route: () => {
          const route = useRoute();
          return frontRoutes.search(
            route.name === "externalSearch" ? route.params : {},
          );
        },
        children: {
          externalSearch: {
            label: "Résultats LaBonneBoite",
            route: frontRoutes.externalSearch(),
          },
        },
      },
      searchForStudent: {
        label: "Recherche scolaire",
        route: frontRoutes.searchForStudent(),
      },
    },
  },
  initiateConvention: {
    label: "Initier une convention",
    route: frontRoutes.initiateConvention(),
    children: {
      conventionImmersion: {
        label: "Remplir la demande de convention",
        route: frontRoutes.conventionImmersion(),
      },
    },
  },
  assessment: {
    label: "Bilan d'immersion",
    route: frontRoutes.assessment({ jwt: "", conventionId: "" }),
  },
  myAccount: {
    label: "Mon compte",
    route: frontRoutes.myAccount(),
    children: {
      establishmentDashboard: {
        label: "Mon espace entreprise",
        route: frontRoutes.establishmentDashboard(),
        children: {
          establishmentUserRegistration: {
            label: "Se rattacher à une entreprise",
            route: frontRoutes.establishmentUserRegistration(),
          },
          establishmentDashboardConventions: {
            label: "Conventions",
            route: frontRoutes.establishmentDashboardConventions(),
          },
          establishmentDashboardDiscussions: {
            label: "Candidatures",
            route: frontRoutes.establishmentDashboardDiscussions(),
          },
          establishmentDashboardFormEstablishment: {
            label: "Mon entreprise",
            route: frontRoutes.establishmentDashboardFormEstablishment(),
          },
        },
      },
      beneficiaryDashboard: {
        label: "Mon espace bénéficiaire",
        route: frontRoutes.beneficiaryDashboard(),
        children: {
          beneficiaryDashboardDiscussions: {
            label: "Mes candidatures",
            route: frontRoutes.beneficiaryDashboardDiscussions(),
          },
          beneficiaryDashboardConventions: {
            label: "Mes conventions",
            route: frontRoutes.beneficiaryDashboardConventions(),
          },
        },
      },
      agencyDashboard: {
        label: "Mon espace prescripteur",
        route: frontRoutes.agencyDashboard(),
        children: {
          agencyUserRegistration: {
            label: "Demander l'accès à des organismes",
            route: frontRoutes.agencyUserRegistration(),
          },
          agencyDashboardMain: {
            label: "Tableau de bord",
            route: frontRoutes.agencyDashboardMain(),
          },
          agencyDashboardAgencies: {
            label: "Mes Organismes",
            route: frontRoutes.agencyDashboardAgencies(),
            children: {
              agencyDashboardAgencyDetails: {
                label: "Détail de l'organisme",
                route: frontRoutes.agencyDashboardAgencyDetails({
                  agencyId: "",
                }),
              },
            },
          },
          agencyManagement: {
            label: "Pilotage de ma structure",
            route: frontRoutes.agencyManagement(),
          },
          statsEstablishmentDetails: {
            label: "Activités par entreprise",
            route: frontRoutes.statsEstablishmentDetails(),
          },
          establishmentManagement: {
            label: "Pilotage des entreprises",
            route: frontRoutes.establishmentManagement(),
          },
        },
      },
    },
  },
};

export const getBreadcrumbs = makeBreadcrumbsSegments<typeof breadcrumbs>(
  breadcrumbs,
  defaultAncestor,
);
