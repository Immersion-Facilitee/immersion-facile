import { fr } from "@codegouvfr/react-dsfr";
import {
  Display,
  headerFooterDisplayItem,
} from "@codegouvfr/react-dsfr/Display";
import { useIsDark } from "@codegouvfr/react-dsfr/useIsDark";

import {
  Footer,
  FooterStyles,
  MinistereEmploiLogo,
  type NavLink,
  type NavTopGroupLinks,
  OverFooter,
  type OverFooterCols,
} from "react-design-system";
import { type AbsoluteUrl, domElementIds, frontRoutes } from "shared";
import { getConsentModal } from "src/app/components/ConsentManager";
import { ressourcesAndWebinarsUrl } from "src/app/contents/home/content";
import { useFeatureFlags } from "src/app/hooks/useFeatureFlags";
import { useStyles } from "tss-react/dsfr";
import lesEntrepriseSengagentLight from "../../../assets/img/les-entreprises-s-engagent.svg";
import lesEntrepriseSengagentDark from "../../../assets/img/les-entreprises-s-engagent-dark.svg";
import franceTravailLogoLight from "../../../assets/img/logo-france-travail.svg";
import franceTravailLogoDark from "../../../assets/img/logo-france-travail-dark.svg";
import logoPDILight from "../../../assets/img/logo-pdi.svg";
import logoPDIDark from "../../../assets/img/logo-pdi-dark.svg";

const {
  bottomLinks: bottomsLinksIds,
  links: linksIds,
  navTopGroupLinks: navTopGroupLinksIds,
  overFooterCols: overFooterColsIds,
} = domElementIds.footer;

const PartnersLogos = () => {
  const { cx } = useStyles();
  const darkModeState = useIsDark();

  const franceTravailLogo = darkModeState.isDark
    ? franceTravailLogoDark
    : franceTravailLogoLight;
  const lesEntrepriseSengagent = darkModeState.isDark
    ? lesEntrepriseSengagentDark
    : lesEntrepriseSengagentLight;
  const logoPDI = darkModeState.isDark ? logoPDIDark : logoPDILight;

  return (
    <ul>
      <li>
        <MinistereEmploiLogo />
      </li>
      <li>
        <img
          src={franceTravailLogo}
          alt="France Travail"
          className={cx(
            fr.cx("fr-footer__logo", "fr-mx-md-1w"),
            FooterStyles.default.logo,
          )}
        />
      </li>
      <li>
        <img
          src={logoPDI}
          alt="Plateforme De l'Inclusion"
          className={cx(fr.cx("fr-footer__logo"), FooterStyles.default.logo)}
        />
      </li>
      <li>
        <img
          src={lesEntrepriseSengagent}
          alt="Les entreprises s'engagent"
          className={cx(fr.cx("fr-footer__logo"), FooterStyles.default.logo)}
        />
      </li>
    </ul>
  );
};

const overFooterCols: OverFooterCols = [
  {
    title: "Le centre d'aide",
    subtitle:
      "Consultez notre FAQ, trouvez les réponses aux questions les plus fréquentes et contactez-nous si vous n'avez pas trouvé de réponse",
    iconTitle: "fr-icon-questionnaire-fill",
    link: {
      label: "Accédez à notre FAQ",
      url: "https://immersion-facile.beta.gouv.fr/aide/",
    },
    id: overFooterColsIds.faq,
  },
  {
    title: "Rejoignez la communauté",
    subtitle:
      "Rejoignez la communauté d'Immersion Facilitée et suivez nos actualités.",
    iconTitle: "fr-icon-linkedin-box-fill",
    link: {
      label: "Rejoignez-nous sur Linkedin",
      url: "https://www.linkedin.com/company/l-immersion-facilitee/",
    },
    id: overFooterColsIds.linkedin,
  },
  {
    title: "Les chiffres-clé de notre impact",
    subtitle:
      "Vous souhaitez en savoir plus sur les résultats atteints par Immersion Facilitée ?",
    iconTitle: "fr-icon-line-chart-line",
    link: {
      label: "Nos statistiques",
      url: frontRoutes.stats().link.href,
    },
    id: overFooterColsIds.contact,
  },
];
const links: NavLink[] = [
  {
    label: "beta.gouv.fr",
    href: "https://beta.gouv.fr/",
    id: linksIds.gouv,
    target: "_blank",
  },
  {
    label: "data.gouv.fr",
    href: "https://www.data.gouv.fr/",
    id: linksIds.civilService,
    target: "_blank",
  },
];

export const immersionFacileSupportUrl: AbsoluteUrl =
  "https://immersion-facile.beta.gouv.fr/aide/";

const bottomsLinks: (NavLink | typeof headerFooterDisplayItem)[] = [
  {
    label: "Accessibilité : partiellement conforme",
    ...frontRoutes.standard({ pagePath: "accessibilite" }).link,
    id: bottomsLinksIds.accessibility,
  },
  {
    label: "Mentions légales",
    ...frontRoutes.standard({ pagePath: "mentions-legales" }).link,
    id: bottomsLinksIds.legals,
  },
  {
    label: "Politique de confidentialité",
    ...frontRoutes.standard({ pagePath: "politique-de-confidentialite" }).link,
    id: bottomsLinksIds.privacy,
  },
  {
    label: "Conditions générales d'utilisation",
    ...frontRoutes.standard({ pagePath: "cgu" }).link,
    id: bottomsLinksIds.cgu,
  },
  {
    label: "Nous contacter",
    href: immersionFacileSupportUrl,
    id: bottomsLinksIds.contact,
    target: "_blank",
  },
  {
    label: "Statistiques",
    href: "/stats",
    target: "_blank",
    id: bottomsLinksIds.stats,
  },
  {
    label: "Plan du site",
    ...frontRoutes.standard({ pagePath: "plan-du-site" }).link,
    id: bottomsLinksIds.sitemap,
  },
  {
    label: "Budget",
    ...frontRoutes.standard({ pagePath: "budget" }).link,
    id: bottomsLinksIds.budget,
  },
  {
    label: "Documentation API",
    href: "/doc-api",
    id: bottomsLinksIds.apiDocumentation,
  },
  {
    label: "Gestion des cookies",
    id: "fr-consent-modal-control-button",
    href: "#fr-consent-modal",
    onClick: (event) => {
      event.preventDefault();
      const { modalElementDSFR, modalElement } = getConsentModal();
      modalElementDSFR.disclose();
      if (modalElement) {
        modalElement.setAttribute("aria-hidden", "false");
        modalElement.setAttribute("data-fr-opened", "true");
      }
    },
  },
  {
    label: "Ressources et webinaires",
    href: ressourcesAndWebinarsUrl,
    id: bottomsLinksIds.resourcesAndWebinars,
  },
  headerFooterDisplayItem,
];

const makeNavTopGroupLinks = (
  isArchivedConventionRequestEnabled: boolean,
): NavTopGroupLinks[] => [
  {
    title: "Candidats",
    links: [
      {
        label: "Trouver une entreprise accueillante",
        ...frontRoutes.search().link,
        id: navTopGroupLinksIds.search,
      },
      {
        label: "Remplir la demande de convention",
        ...frontRoutes.conventionImmersion().link,
        id: `${navTopGroupLinksIds.formConvention}-candidats`,
      },
    ],
  },
  {
    title: "Entreprises",
    links: [
      {
        label: "Inscrire une entreprise",
        ...frontRoutes.formEstablishment().link,
        id: navTopGroupLinksIds.addEstablishmentForm,
      },
      {
        label: "Remplir la demande de convention",
        ...frontRoutes.conventionImmersion().link,
        id: `${navTopGroupLinksIds.formConvention}-entreprises`,
      },
    ],
  },
  {
    title: "Prescripteurs",
    links: [
      {
        label: "Référencer mon organisme",
        ...frontRoutes.agencyDashboardAgencies({ isAgencyRegistration: true })
          .link,
        id: navTopGroupLinksIds.addAgencyForm,
      },
      {
        label: "Remplir la demande de convention",
        ...frontRoutes.conventionImmersion().link,
        id: navTopGroupLinksIds.agencyformConvention,
      },
    ],
  },
  {
    title: "Réseaux sociaux",
    links: [
      {
        label: (
          <>
            <i className={fr.cx("fr-icon-linkedin-box-fill", "fr-icon--sm")} />
            Rejoignez-nous sur Linkedin
          </>
        ),
        href: "https://www.linkedin.com/company/l-immersion-facilitee/",
        id: navTopGroupLinksIds.linkedin,
      },
    ],
  },
  ...(isArchivedConventionRequestEnabled
    ? [
        {
          title: "Outils et démarches",
          links: [
            {
              label: "Accéder à une convention archivée",
              ...frontRoutes.archivedConventionRequest().link,
              id: navTopGroupLinksIds.archivedConventionRequest,
            },
          ],
        },
      ]
    : []),
];

export const LayoutFooter = () => {
  const { enableRequestArchivedConvention } = useFeatureFlags();

  return (
    <>
      <OverFooter cols={overFooterCols} />
      <Footer
        navTopGroupLinks={makeNavTopGroupLinks(
          enableRequestArchivedConvention.isActive,
        )}
        links={links}
        partnersLogos={<PartnersLogos />}
        bottomLinks={bottomsLinks}
      />
      <Display />
    </>
  );
};

LayoutFooter.displayName = "LayoutFooter";
