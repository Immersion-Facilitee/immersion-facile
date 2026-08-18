import {
  lazy,
  type ReactElement,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
} from "react";
import { PageHeader } from "react-design-system";
import {
  type AdminTabRouteName,
  type AppellationAndRomeDto,
  adminTabRouteNames,
  frontRoutes,
  parseStringToJsonOrThrow,
  useRoute,
} from "shared";
import { AdminAgencyDetail } from "src/app/components/forms/agency/AdminAgencyDetail";
import { AgencyDetailForAgencyDashboard } from "src/app/components/forms/agency/AgencyDetailForAgencyDashboard";
import { useFeedbackTopic } from "src/app/hooks/feedback.hooks";
import { AdminTabs } from "src/app/pages/admin/AdminTabs";
import { AdminUserDetail } from "src/app/pages/admin/AdminUserDetail";
import { AddAgencyPage } from "src/app/pages/agency/AddAgencyPage";
import { AgencyDashboardMainTab } from "src/app/pages/agency-dashboard/AgencyDashboardMainTab";
import { AdminPrivateRoutePage } from "src/app/pages/auth/AdminPrivateRoutePage";
import { ConnectedPrivateRoutePage } from "src/app/pages/auth/ConnectedPrivateRoutePage";
import { DashboardPrivateRoutePage } from "src/app/pages/auth/DashboardPrivateRoutePage";
import { MagicLinkInterstitialPage } from "src/app/pages/auth/MagicLinkInterstitialPage";
import { BeneficiaryDashboardPage } from "src/app/pages/beneficiary-dashboard/BeneficiaryDashboardPage";
import { ArchivedConventionRequestPage } from "src/app/pages/convention/ArchivedConventionRequestPage";
import { AssessmentDocumentPage } from "src/app/pages/convention/AssessmentDocumentPage";
import { ConventionConfirmationPage } from "src/app/pages/convention/ConventionConfirmationPage";
import { ConventionImmersionPage } from "src/app/pages/convention/ConventionImmersionPage";
import { ConventionManageConnectedUser } from "src/app/pages/convention/ConventionManageConnectedUser";
import { ConventionMiniStagePage } from "src/app/pages/convention/ConventionMiniStagePage";
import { ConventionSignPage } from "src/app/pages/convention/ConventionSignPage";
import { ConventionStatusDashboardPage } from "src/app/pages/convention/ConventionStatusDashboardPage";
import { ConventionTemplateForm } from "src/app/pages/convention/ConventionTemplateForm";
import { InitiateConventionPage } from "src/app/pages/convention/InitiateConventionPage";
import { frontErrors } from "src/app/pages/error/front-errors";
import { EstablishmentLeadRegistrationRejectedPage } from "src/app/pages/establishment/EstablishmentLeadRegistrationRejectedPage";
import { EstablishmentDashboardMainTab } from "src/app/pages/establishment-dashboard/EstablishmentDashboardMainTab";
import { StatsPage } from "src/app/pages/StatsPage";
import { SearchPage } from "src/app/pages/search/SearchPage";
import { MyProfileMainTab } from "src/app/pages/user/MyProfileMainTab";
import { RequestAgencyRegistrationTab } from "src/app/pages/user/tabs/RequestAgencyRegistrationTab";
import { RequestEstablishmentRegistrationTab } from "src/app/pages/user/tabs/RequestEstablishmentRegistrationTab";
import { getUrlParameters } from "src/app/utils/url.utils";
import { store } from "src/config/dependencies";
import { connectedUserSlice } from "src/core-logic/domain/connected-user/connectedUser.slice";
import { searchSlice } from "src/core-logic/domain/search/search.slice";
import type { Route } from "type-route";
import {
  type StandardPageSlugs,
  standardPageSlugs,
} from "../../../../shared/src/routes/routeParams/standardPage";
import { StandardLayoutPage } from "../components/layout/StandardLayoutPage";
import { AdminConventionDetail } from "../pages/convention/AdminConventionDetail";
import { ConventionDocumentPage } from "../pages/convention/ConventionDocumentPage";
import { ConventionManagePage } from "../pages/convention/ConventionManagePage";
import { ConventionPageForExternals } from "../pages/convention/ConventionPageForExternals";
import { ErrorPage } from "../pages/error/ErrorPage";
import { EstablishmentCreationFormPage } from "../pages/establishment/EstablishmentCreationFormPage";
import { GroupPage } from "../pages/group/GroupPage";
import { HomePage } from "../pages/home/HomePage";
import { AssessmentPage } from "../pages/immersion-assessment/AssessmentPage";
import { SearchResultPage } from "../pages/search/SearchResultPage";

const OpenApiDocV2Page = lazy(
  () => import("src/app/pages/open-api-doc/OpenApiDocV2Page"),
);

const OpenApiDocV3Page = lazy(
  () => import("src/app/pages/open-api-doc/OpenApiDocV3Page"),
);

type Routes = typeof frontRoutes;

const adminRoutes: {
  [K in AdminTabRouteName]: (route: Route<Routes[K]>) => ReactElement;
} = adminTabRouteNames.reduce(
  (acc, tabRouteName) => ({
    ...acc,
    [tabRouteName]: (route: Route<any>) => (
      <AdminPrivateRoutePage route={route}>
        <AdminTabs route={route} />
      </AdminPrivateRoutePage>
    ),
  }),

  {} as {
    [K in AdminTabRouteName]: (route: Route<Routes[K]>) => ReactElement;
  },
);

const RedirectTo = ({ route }: { route: Route<typeof frontRoutes> }) => {
  const routePush = useCallback(() => {
    route.push();
  }, [route]);

  useEffect(() => {
    routePush();
  }, [routePush]);

  return null;
};

const getPageSideEffectByRouteName: Partial<Record<keyof Routes, () => void>> =
  {
    establishmentDashboard: () => {
      store.dispatch(
        connectedUserSlice.actions.currentUserFetchRequested({
          feedbackTopic: "unused",
        }),
      );
    },
    establishmentDashboardFormEstablishment: () => {
      store.dispatch(
        connectedUserSlice.actions.currentUserFetchRequested({
          feedbackTopic: "unused",
        }),
      );
    },
    establishmentDashboardDiscussions: () => {
      store.dispatch(
        connectedUserSlice.actions.currentUserFetchRequested({
          feedbackTopic: "unused",
        }),
      );
    },
    establishmentDashboardConventions: () => {
      store.dispatch(
        connectedUserSlice.actions.currentUserFetchRequested({
          feedbackTopic: "unused",
        }),
      );
    },
    externalSearch: () => {
      const urlParams = getUrlParameters(window.location);
      const appellations = parseStringToJsonOrThrow<AppellationAndRomeDto[]>(
        urlParams.appellations,
        "appellations",
      );
      store.dispatch(
        searchSlice.actions.getOffersRequested({
          ...urlParams,
          appellations,
          appellationCodes: appellations.map(
            (appellation) => appellation.appellationCode,
          ),
          isExternal: true,
          sortBy: "score",
          sortOrder: "asc",
        }),
      );
    },
  };

const getPageByRouteName: {
  [K in keyof Routes]: (route: Route<Routes[K]>) => ReactNode;
} = {
  addAgency: (route) => <AddAgencyPage route={route} />,
  admin: (route) => (
    <AdminPrivateRoutePage route={frontRoutes.adminConventions(route.params)}>
      <AdminTabs route={frontRoutes.adminConventions(route.params)} />
    </AdminPrivateRoutePage>
  ),
  ...adminRoutes,
  adminConventionDetail: (route) => (
    <AdminPrivateRoutePage route={route}>
      <AdminConventionDetail route={route} />
    </AdminPrivateRoutePage>
  ),
  adminAgencyDetail: (route) => (
    <AdminPrivateRoutePage route={route}>
      <AdminAgencyDetail route={route} />
    </AdminPrivateRoutePage>
  ),
  adminUserDetail: (route) => (
    <RedirectTo route={frontRoutes.adminUserDetailAgencies(route.params)} />
  ),
  adminUserDetailAgencies: (route) => (
    <AdminPrivateRoutePage route={route}>
      <AdminUserDetail route={route} />
    </AdminPrivateRoutePage>
  ),
  adminUserDetailEstablishments: (route) => (
    <AdminPrivateRoutePage route={route}>
      <AdminUserDetail route={route} />
    </AdminPrivateRoutePage>
  ),
  agencyDashboard: (route) => (
    <RedirectTo route={frontRoutes.agencyDashboardMain(route.params)} />
  ),
  agencyDashboardMain: (route) => (
    <DashboardPrivateRoutePage route={route}>
      <AgencyDashboardMainTab route={route} />
    </DashboardPrivateRoutePage>
  ),
  agencyDashboardOnboarding: (route) => (
    <DashboardPrivateRoutePage route={route}>
      <AgencyDashboardMainTab route={route} />
    </DashboardPrivateRoutePage>
  ),
  agencyDashboardAgencies: (route) => (
    <DashboardPrivateRoutePage route={route}>
      <AgencyDashboardMainTab route={route} />
    </DashboardPrivateRoutePage>
  ),
  agencyDashboardAgencyDetails: (route) => (
    <DashboardPrivateRoutePage route={route}>
      <AgencyDetailForAgencyDashboard route={route} />
    </DashboardPrivateRoutePage>
  ),
  agencyManagement: (route) => (
    <DashboardPrivateRoutePage route={route}>
      <AgencyDashboardMainTab route={route} />
    </DashboardPrivateRoutePage>
  ),
  establishmentManagement: (route) => (
    <DashboardPrivateRoutePage route={route}>
      <AgencyDashboardMainTab route={route} />
    </DashboardPrivateRoutePage>
  ),
  statsEstablishmentDetails: (route) => (
    <DashboardPrivateRoutePage route={route}>
      <AgencyDashboardMainTab route={route} />
    </DashboardPrivateRoutePage>
  ),
  conventionTemplate: (route) => (
    <DashboardPrivateRoutePage route={route}>
      <ConventionTemplateForm route={route} />
    </DashboardPrivateRoutePage>
  ),
  assessmentDocument: (route) => <AssessmentDocumentPage route={route} />,
  archivedConventionRequest: (route) => (
    <ArchivedConventionRequestPage route={route} />
  ),
  beneficiaryDashboard: (route) => (
    <RedirectTo
      route={frontRoutes.beneficiaryDashboardDiscussions(route.params)}
    />
  ),
  beneficiaryDashboardDiscussions: (route) => (
    <ConnectedPrivateRoutePage
      route={route}
      oAuthConnectionPageHeader={
        <PageHeader title="Vous devez vous connecter pour accéder à votre espace candidat" />
      }
    >
      <BeneficiaryDashboardPage route={route} />
    </ConnectedPrivateRoutePage>
  ),
  beneficiaryDashboardConventions: (route) => (
    <ConnectedPrivateRoutePage
      route={route}
      oAuthConnectionPageHeader={
        <PageHeader title="Vous devez vous connecter pour accéder à votre espace candidat" />
      }
    >
      <BeneficiaryDashboardPage route={route} />
    </ConnectedPrivateRoutePage>
  ),
  initiateConvention: () => <InitiateConventionPage />,
  conventionImmersion: (route) => <ConventionImmersionPage route={route} />,
  conventionMiniStage: (route) => <ConventionMiniStagePage route={route} />,
  conventionConfirmation: (route) => (
    <ConventionConfirmationPage route={route} />
  ),
  conventionImmersionForExternals: (route) => (
    <ConventionPageForExternals route={route} />
  ),
  conventionDocument: (route) => <ConventionDocumentPage route={route} />,
  conventionStatusDashboard: (route) => (
    <ConventionStatusDashboardPage route={route} />
  ),
  conventionToSign: (route) => <ConventionSignPage route={route} />,

  establishmentDashboard: (route) => (
    <RedirectTo
      route={frontRoutes.establishmentDashboardConventions(route.params)}
    />
  ),
  establishmentDashboardConventions: (route) => (
    <DashboardPrivateRoutePage route={route}>
      <EstablishmentDashboardMainTab route={route} />
    </DashboardPrivateRoutePage>
  ),
  establishmentDashboardFormEstablishment: (route) => (
    <DashboardPrivateRoutePage route={route}>
      <EstablishmentDashboardMainTab route={route} />
    </DashboardPrivateRoutePage>
  ),
  establishmentDashboardDiscussions: (route) => (
    <DashboardPrivateRoutePage route={route}>
      <EstablishmentDashboardMainTab route={route} />
    </DashboardPrivateRoutePage>
  ),
  formEstablishment: (route) => <EstablishmentCreationFormPage route={route} />,
  group: (route) => <GroupPage route={route} />,
  home: () => <HomePage type="default" />,
  homeAgencies: () => <HomePage type="agency" />,
  homeCandidates: () => <HomePage type="candidate" />,
  homeEstablishments: () => <HomePage type="establishment" />,
  assessment: (route) => <AssessmentPage route={route} />,
  searchResult: () => <SearchResultPage isExternal={false} />,
  searchResultForStudent: () => <SearchResultPage isExternal={false} />,
  searchResultExternal: () => <SearchResultPage isExternal={true} />,
  manageConvention: (route) => <ConventionManagePage route={route} />,
  manageConventionConnectedUser: (route) => (
    <ConnectedPrivateRoutePage
      route={route}
      oAuthConnectionPageHeader={
        <PageHeader title="Vous devez vous connecter pour accéder à cette convention" />
      }
    >
      <ConventionManageConnectedUser route={route} />
    </ConnectedPrivateRoutePage>
  ),
  myAccount: (route) => (
    <RedirectTo route={frontRoutes.myAccountAgencies(route.params)} />
  ),
  myAccountAgencies: (route) => (
    <ConnectedPrivateRoutePage
      route={route}
      oAuthConnectionPageHeader={
        <PageHeader title="Vous devez vous connecter pour accéder à votre profil" />
      }
    >
      <MyProfileMainTab route={route} />
    </ConnectedPrivateRoutePage>
  ),

  myAccountEstablishments: (route) => (
    <ConnectedPrivateRoutePage
      route={route}
      oAuthConnectionPageHeader={
        <PageHeader title="Vous devez vous connecter pour accéder à votre profil" />
      }
    >
      <MyProfileMainTab route={route} />
    </ConnectedPrivateRoutePage>
  ),
  myAccountAgencyRegistration: (route) => (
    <ConnectedPrivateRoutePage
      route={route}
      oAuthConnectionPageHeader={
        <PageHeader title="Vous devez vous connecter pour accéder à votre profil" />
      }
    >
      <RequestAgencyRegistrationTab />
    </ConnectedPrivateRoutePage>
  ),

  myAccountEstablishmentRegistration: (route) => (
    <ConnectedPrivateRoutePage
      route={route}
      oAuthConnectionPageHeader={
        <PageHeader title="Vous devez vous connecter pour accéder à votre profil" />
      }
      mainWrapperProps={{
        vSpacing: 0,
      }}
    >
      <RequestEstablishmentRegistrationTab />
    </ConnectedPrivateRoutePage>
  ),
  openApiDoc: (route: Route<typeof frontRoutes.openApiDoc>) => {
    if (route.params.version === "v3") return <OpenApiDocV3Page />;
    return <OpenApiDocV2Page />;
  },
  magicLinkInterstitial: () => <MagicLinkInterstitialPage />,
  search: (route) => (
    <SearchPage
      route={route}
      useNaturalLanguageForAppellations
      isExternal={false}
      key="internal-search"
    />
  ),
  externalSearch: (route) => (
    <SearchPage
      route={route}
      useNaturalLanguageForAppellations
      isExternal
      key="external-search"
    />
  ),
  searchForStudent: (route) => (
    <SearchPage
      route={route}
      useNaturalLanguageForAppellations
      isExternal={false}
    />
  ),
  standard: (route) =>
    standardPageSlugs.includes(route.params.pagePath as StandardPageSlugs) ? (
      <StandardLayoutPage route={route} />
    ) : (
      <ErrorPage error={frontErrors.generic.pageNotFound()} />
    ),
  stats: () => <StatsPage />,
  unregisterEstablishmentLead: (route) => (
    <EstablishmentLeadRegistrationRejectedPage route={route} />
  ),
  temporaryError: (route) => (
    <ErrorPage
      error={
        route.params.message
          ? new Error(route.params.message)
          : frontErrors.generic.temporaryError()
      }
      title={route.params.title ? route.params.title : undefined}
    />
  ),
};

export const Router = (): ReactNode => {
  const featureFlagsGlobalFeedback = useFeedbackTopic("feature-flags-global");

  if (
    featureFlagsGlobalFeedback?.on === "fetch" &&
    featureFlagsGlobalFeedback.level === "error"
  )
    throw frontErrors.generic.backendUnreachable();

  const route = useRoute();
  const routeName = route.name;
  const previousRouteName = useRef<keyof Routes | undefined>(undefined);
  useEffect(() => {
    if (
      routeName &&
      previousRouteName.current !== routeName &&
      getPageSideEffectByRouteName[routeName]
    ) {
      previousRouteName.current = routeName;
      getPageSideEffectByRouteName[routeName]();
    }
  }, [routeName]);
  return routeName === false ? (
    <ErrorPage error={frontErrors.generic.pageNotFound()} />
  ) : (
    (getPageByRouteName[routeName](route as Route<unknown>) as ReactNode)
  );
};
