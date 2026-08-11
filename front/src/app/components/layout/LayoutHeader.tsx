import Button from "@codegouvfr/react-dsfr/Button";
import { Header, type HeaderProps } from "@codegouvfr/react-dsfr/Header";
import type { MainNavigationProps } from "@codegouvfr/react-dsfr/MainNavigation";
import { createModal } from "@codegouvfr/react-dsfr/Modal";
import { useIsModalOpen } from "@codegouvfr/react-dsfr/Modal/useIsModalOpen";
import { useIsDark } from "@codegouvfr/react-dsfr/useIsDark";
import { MaintenanceCallout, useBreakpoint } from "react-design-system";
import { useDispatch } from "react-redux";
import { domElementIds, frontRoutes, useRoute } from "shared";
import { ressourcesAndWebinarsUrl } from "src/app/contents/home/content";
import { useFeedbackEventCallback } from "src/app/hooks/feedback.hooks";
import { useAppSelector } from "src/app/hooks/reduxHooks";
import { useFeatureFlags } from "src/app/hooks/useFeatureFlags";
import {
  type AgencyDashboardRouteName,
  agencyDashboardRoutes,
} from "src/app/pages/auth/ConnectedPrivateRoutePage";
import { authSelectors } from "src/core-logic/domain/auth/auth.selectors";
import { authSlice } from "src/core-logic/domain/auth/auth.slice";
import { connectedUserSelectors } from "src/core-logic/domain/connected-user/connectedUser.selectors";
import { feedbacksSelectors } from "src/core-logic/domain/feedback/feedback.selectors";
import { feedbackSlice } from "src/core-logic/domain/feedback/feedback.slice";
import { makeStyles } from "tss-react/dsfr";
import immersionFacileLightLogo from "/assets/img/logo-if.svg";
import immersionFacileDarkLogo from "/assets/img/logo-if-dark.svg";

const logoutErrorModal = createModal({
  isOpenedByDefault: false,
  id: "im-logout-error-modal",
});

export const LayoutHeader = () => {
  const dispatch = useDispatch();
  const { enableMaintenance } = useFeatureFlags();

  const currentRoute = useRoute();
  const darkModeState = useIsDark();

  const immersionFacileLogo = darkModeState.isDark
    ? immersionFacileDarkLogo
    : immersionFacileLightLogo;
  const {
    candidate: candidateIds,
    establishment: establishmentIds,
    agency: agencyIds,
    admin: adminIds,
    quickAccess: quickAccessIds,
  } = domElementIds.header.navLinks;

  const isConnectedUser = useAppSelector(authSelectors.isConnectedUser);
  const currentUser = useAppSelector(connectedUserSelectors.currentUser);
  const isAdminConnected = useAppSelector(authSelectors.isAdminConnected);
  const federatedIdentity = useAppSelector(authSelectors.federatedIdentity);
  const logoutFeedback = useAppSelector(feedbacksSelectors.feedbacks)[
    "auth-global"
  ];

  const tools: HeaderProps["quickAccessItems"] = [
    {
      text: "Remplir la demande de convention",
      iconId: "fr-icon-draft-line",
      linkProps: {
        ...frontRoutes.initiateConvention().link,
        id: quickAccessIds.initiateConvention,
      },
    },
    <Button
      key={quickAccessIds.myAccount}
      id={quickAccessIds.myAccount}
      priority="secondary"
      iconId="fr-icon-account-line"
      linkProps={frontRoutes.myAccount().link}
    >
      {currentUser
        ? currentUser.firstName && currentUser.lastName
          ? `${currentUser.firstName} ${currentUser.lastName}`
          : currentUser.email
        : "Se connecter"}
    </Button>,
  ];

  if (isConnectedUser) {
    tools.push({
      iconId: "fr-icon-lock-line",
      text: "Se déconnecter",
      buttonProps: {
        onClick: () => {
          dispatch(
            authSlice.actions.fetchLogoutUrlRequested({
              mode:
                federatedIdentity?.provider === "email"
                  ? "device-only"
                  : "device-and-oauth",
              feedbackTopic: "auth-global",
            }),
          );
          frontRoutes.home().push();
        },
      },
    });
  }

  const isCandidateRoute =
    currentRoute.name === frontRoutes.search().name ||
    currentRoute.name === frontRoutes.homeCandidates().name ||
    currentRoute.name === frontRoutes.beneficiaryDashboard().name;
  const isEstablishmentRoute =
    currentRoute.name === frontRoutes.formEstablishment().name ||
    currentRoute.name === frontRoutes.homeEstablishments().name ||
    currentRoute.name === frontRoutes.establishmentDashboard().name;
  const isAgencyRoute =
    currentRoute.name === frontRoutes.addAgency().name ||
    currentRoute.name === frontRoutes.homeAgencies().name ||
    agencyDashboardRoutes.includes(
      currentRoute.name as AgencyDashboardRouteName,
    );
  const links: MainNavigationProps.Item[] = [
    {
      text: "Accueil",
      linkProps: {
        ...frontRoutes.home().link,
        id: domElementIds.header.navLinks.home,
      },
      isActive: currentRoute.name === frontRoutes.home().name,
    },
    {
      text: "Candidats",
      isActive: isCandidateRoute,
      menuLinks: [
        {
          text: "Accueil candidat",
          isActive: currentRoute.name === frontRoutes.homeCandidates().name,
          linkProps: {
            ...frontRoutes.homeCandidates().link,
            id: candidateIds.home,
          },
        },
        {
          text: "Trouver une entreprise accueillante",
          isActive: currentRoute.name === frontRoutes.search().name,
          linkProps: {
            ...frontRoutes.search().link,
            id: candidateIds.search,
          },
        },
        {
          text: "Remplir la demande de convention",
          isActive: false,
          linkProps: {
            ...frontRoutes.initiateConvention({
              skipFirstStep: true,
            }).link,
            id: candidateIds.formConvention,
          },
        },
        {
          text: "Mon espace",
          isActive:
            currentRoute.name === frontRoutes.beneficiaryDashboard().name,
          linkProps: {
            ...frontRoutes.beneficiaryDashboard().link,
            id: candidateIds.dashboard,
          },
        },
      ],
    },
    {
      text: "Entreprises",
      isActive: isEstablishmentRoute,
      menuLinks: [
        {
          text: "Accueil entreprise",
          isActive: currentRoute.name === frontRoutes.homeEstablishments().name,
          linkProps: {
            ...frontRoutes.homeEstablishments().link,
            id: establishmentIds.home,
          },
        },
        {
          text: "Proposer une immersion",
          isActive: currentRoute.name === frontRoutes.formEstablishment().name,
          linkProps: {
            ...frontRoutes.formEstablishment().link,
            id: establishmentIds.addEstablishmentForm,
          },
        },
        {
          text: "Remplir la demande de convention",
          isActive: false,
          linkProps: {
            ...frontRoutes.conventionImmersion().link,
            id: establishmentIds.formConvention,
          },
        },
        {
          text: "Mon espace",
          isActive:
            currentRoute.name ===
            frontRoutes.establishmentDashboardConventions().name,
          linkProps: {
            ...frontRoutes.establishmentDashboardConventions().link,
            id: establishmentIds.dashboard,
          },
        },
      ],
    },
    {
      text: "Prescripteurs",
      isActive: isAgencyRoute,
      menuLinks: [
        {
          text: "Accueil prescripteurs",
          isActive: currentRoute.name === frontRoutes.homeAgencies().name,
          linkProps: {
            ...frontRoutes.homeAgencies().link,
            id: agencyIds.home,
          },
        },
        {
          text: "Inscrire mon organisme",
          isActive: currentRoute.name === frontRoutes.addAgency().name,
          linkProps: {
            ...frontRoutes.agencyDashboardAgencies({
              isAgencyRegistration: true,
            }).link,
            id: agencyIds.agencyDashboardAgencies,
          },
        },
        {
          text: "Remplir la demande de convention",
          isActive: false,
          linkProps: {
            ...frontRoutes.conventionImmersion().link,
            id: agencyIds.formConvention,
          },
        },
        {
          text: "Mon espace",
          isActive: false,
          linkProps: {
            ...frontRoutes.agencyDashboardMain().link,
            id: agencyIds.dashboard,
          },
        },
        {
          text: "Ressources et webinaires",
          isActive: false,
          linkProps: {
            href: ressourcesAndWebinarsUrl,
            id: agencyIds.resourcesAndWebinars,
          },
        },
      ],
    },
  ];

  if (isAdminConnected) {
    links.push({
      text: "Admin",
      isActive: currentRoute.name === frontRoutes.adminConventions().name,
      menuLinks: [
        {
          text: "Backoffice",
          isActive: false,
          linkProps: {
            ...frontRoutes.adminConventions().link,
            id: adminIds.backOffice,
          },
        },
        {
          text: "Notifications",
          isActive: false,
          linkProps: {
            ...frontRoutes.adminNotifications().link,
            id: adminIds.emails,
          },
        },
      ],
    });
  }

  const isLayoutDesktop = useBreakpoint("md");

  const { classes } = makeStyles({ name: LayoutHeader.displayName })(() => ({
    operator: {
      boxSizing: "content-box",
      width: isLayoutDesktop ? "10.5rem" : "100%",
      maxWidth: "10.5rem !important",
    },
  }))();

  useFeedbackEventCallback("auth-global", "delete.error", () => {
    logoutErrorModal.open();
  });

  useIsModalOpen(logoutErrorModal, {
    onConceal: () => {
      logoutErrorModal.close();
      dispatch(feedbackSlice.actions.clearFeedbacksTriggered());
    },
  });

  return (
    <>
      <logoutErrorModal.Component title={logoutFeedback?.title}>
        <p>{logoutFeedback?.message}</p>
      </logoutErrorModal.Component>
      {enableMaintenance.isActive && (
        <MaintenanceCallout
          message={
            enableMaintenance.value.message !== ""
              ? enableMaintenance.value.message
              : "⚠️ Le site est actuellement en maintenance. Il est possible que le service soit dégradé. Nous vous prions de nous excuser pour la gêne occasionnée."
          }
          level={enableMaintenance.value.severity}
        />
      )}
      <Header
        classes={classes}
        brandTop={
          <>
            République
            <br />
            Française
          </>
        }
        homeLinkProps={{
          href: "/",
          title: "Immersion Facilitée - Accueil",
        }}
        operatorLogo={{
          orientation: "horizontal",
          imgUrl: immersionFacileLogo,
          alt: "Immersion Facilitée - Faciliter la réalisation des immersions professionnelles",
        }}
        navigation={links}
        quickAccessItems={tools}
      />
    </>
  );
};

LayoutHeader.displayName = "LayoutHeader";
