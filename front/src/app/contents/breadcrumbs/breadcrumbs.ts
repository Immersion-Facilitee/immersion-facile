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

export type BreadcrumbsRoutesParams = {
  [K in FrontRouteKeys]?: Parameters<(typeof frontRoutes)[K]>[0];
};

const makeBreadcrumbs = (
  routesParams: BreadcrumbsRoutesParams,
): Breadcrumbs<FrontRouteKeys> => ({
  homeAgencies: {
    label: "Organismes prescripteurs",
    route: frontRoutes.homeAgencies(),
    children: {
      addAgency: {
        label: "Inscrire mon organisme",
        route: frontRoutes.addAgency(),
      },
    },
  },
  homeEstablishments: {
    label: "Entreprises",
    route: frontRoutes.homeEstablishments(),
    children: {
      formEstablishment: {
        label: "Inscrire une entreprise",
        route: frontRoutes.formEstablishment(),
      },
    },
  },
  homeCandidates: {
    label: "Candidats",
    route: frontRoutes.homeCandidates(),
    children: {
      search: {
        label: "Recherche",
        route: frontRoutes.search(routesParams.search),
        children: {
          searchResult: {
            label: "Détail de l'offre",
            route: frontRoutes.searchResult({ appellationCode: [], siret: "" }),
          },
          searchResultExternal: {
            label: "Détail de l'offre",
            route: frontRoutes.searchResultExternal({
              appellationCode: [],
              siret: "",
            }),
          },
          externalSearch: {
            label: "Résultats LaBonneBoite",
            route: frontRoutes.externalSearch(),
          },
        },
      },
      searchForStudent: {
        label: "Recherche scolaire",
        route: frontRoutes.searchForStudent(),
        children: {
          searchResultForStudent: {
            label: "Détail de l'offre",
            route: frontRoutes.searchResultForStudent({
              appellationCode: [],
              siret: "",
            }),
          },
        },
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
          establishmentDashboardEstablishments: {
            label: "Mes entreprises",
            route: frontRoutes.establishmentDashboardEstablishments(),
            children: {
              establishmentDashboardEstablishmentOffers: {
                label: "Détail de l'entreprise",
                route: () => {
                  const route = useRoute();
                  return frontRoutes.establishmentDashboardEstablishmentOffers({
                    siret:
                      route.name === "establishmentDashboardEstablishmentOffer"
                        ? route.params.siret
                        : "",
                  });
                },
                children: {
                  establishmentDashboardEstablishmentOffer: {
                    label: "Ajouter / modifier une offre",
                    route: frontRoutes.establishmentDashboardEstablishmentOffer(
                      {
                        siret: "",
                      },
                    ),
                  },
                },
              },
              establishmentDashboardEstablishmentInformations: {
                label: "Détail de l'entreprise",
                route:
                  frontRoutes.establishmentDashboardEstablishmentInformations({
                    siret: "",
                  }),
              },
            },
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
});

export const getBreadcrumbs = ({
  currentRouteKey,
  routesParams = {},
}: {
  currentRouteKey: FrontRouteKeys;
  routesParams?: BreadcrumbsRoutesParams;
}): BreadcrumbProps["segments"] =>
  makeBreadcrumbsSegments<Breadcrumbs<FrontRouteKeys>>(
    makeBreadcrumbs(routesParams),
    defaultAncestor,
  )({ currentRouteKey });
