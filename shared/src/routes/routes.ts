import {
  createRouter,
  defineRoute,
  param,
  type Route,
  type ValueSerializer,
} from "type-route";
import type {
  AbsoluteUrl,
  AlreadyAuthenticatedUserQueryParams,
  ConnectedUserQueryParams,
} from "..";
import {
  type AdminTabRouteName,
  adminTabRouteNames,
  adminTabs,
} from "../admin/adminTabs";
import type { ValueOf } from "../utils";
import { standardPagesSerializer } from "./routeParams/standardPage";
import {
  appellationAndRomeDtoArraySerializer,
  appellationAndRomeDtoSerializer,
  appellationStringSerializer,
  nafCodeSerializer,
  remoteWorkModeSerializer,
} from "./valueSerializer";

export const ftConnect = "pe-connect";

export const uploadFileRoute = "upload-file";

export type AcquisitionParams = Partial<{
  [K in AcquisitionParamsKeys]: (typeof acquisitionParams)[K]["~internal"]["valueSerializer"] extends ValueSerializer<
    infer T
  >
    ? T
    : never;
}>;

type AcquisitionParamsKeys = keyof typeof acquisitionParams;

export type WithAcquisitionQueryParams = Partial<{
  [key in AcquisitionParamsKeys]: string;
}>;

const connectedUserParams = {
  token: param.query.optional.string,
  provider: param.query.optional.string,
  alreadyUsedAuthentication: param.query.optional.string,
} satisfies Record<
  keyof ConnectedUserQueryParams | keyof AlreadyAuthenticatedUserQueryParams,
  typeof param.query.optional.string
>;

export const acquisitionParams = {
  at_campaign: param.query.optional.string,
  at_kwd: param.query.optional.string,
};

const agencyParamsForConventionForm = {
  agencyDepartment: param.query.optional.string,
  agencyKind: param.query.optional.string,
  agencyId: param.query.optional.string,
};

const establishmentParamsForConventionForm = {
  siret: param.query.optional.string,
  immersionAddress: param.query.optional.string,
  immersionAppellation: param.query.optional.ofType(
    appellationAndRomeDtoSerializer,
  ),
};

export const conventionForExternalParams = {
  consumer: param.path.string,
  jwt: param.query.optional.string,
};

export const establishmentParams = {
  ...acquisitionParams,
  fromConventionId: param.query.optional.string,
};

const temporaryErrorParams = {
  message: param.query.optional.string,
  kind: param.query.optional.string,
  title: param.query.optional.string,
};

export const searchParams = {
  distanceKm: param.query.optional.number,
  latitude: param.query.optional.number,
  longitude: param.query.optional.number,
  appellations: param.query.optional.ofType(
    appellationAndRomeDtoArraySerializer,
  ),
  appellationCodes: param.query.optional.ofType(appellationStringSerializer),
  sortBy: param.query.optional.string,
  sortOrder: param.query.optional.string,
  place: param.query.optional.string,
  fitForDisabledWorkers: param.query.optional.boolean,
  page: param.query.optional.number,
  perPage: param.query.optional.number,
  nafCodes: param.query.optional.ofType(nafCodeSerializer),
  nafLabel: param.query.optional.string,
  remoteWorkModes: param.query.optional.ofType(remoteWorkModeSerializer),
  showOnlyAvailableOffers: param.query.optional.boolean,
  ...acquisitionParams,
};

export type FrontRouteUnion = ValueOf<typeof frontRoutes>;
export type FrontRouteKeys = keyof typeof frontRoutes;

export type ConventionTemplateFromRoute = Extract<
  FrontRouteKeys,
  "agencyDashboard" | "establishmentDashboard"
>;

const admin = defineRoute(connectedUserParams, () => "/admin");

const myAccount = defineRoute(
  {
    ...connectedUserParams,
    ...acquisitionParams,
  },
  () => "/mon-compte",
);

const beneficiaryDashboard = myAccount.extend("/tableau-de-bord-beneficiaire");

const agencyDashboard = myAccount.extend(
  {
    isAgencyRegistration: param.query.optional.boolean,
  },
  () => "/tableau-de-bord-agence",
);

const establishmentDashboard = myAccount.extend(
  "/tableau-de-bord-etablissement",
);

const agencyDashboardAgencies = agencyDashboard.extend("/agences");

const {
  adminConventions,
  adminAgencies,
  adminUsers,
  adminEstablishments,
  ...restOfAdminRoutes
} = adminTabRouteNames.reduce(
  (acc, adminTabName) => ({
    ...acc,
    [adminTabName]: admin.extend(`/${adminTabs[adminTabName].slug}`),
  }),
  {} as Record<AdminTabRouteName, typeof admin>,
);

const conventionTemplateFromRouteValues = [
  "establishmentDashboard",
  "agencyDashboard",
] as const;

export const isConventionTemplateFromRoute = (
  value: unknown,
): value is ConventionTemplateFromRoute =>
  typeof value === "string" &&
  conventionTemplateFromRouteValues.some((v) => v === value);

export const conventionTemplateFromRouteSerializer: ValueSerializer<
  "agencyDashboard" | "establishmentDashboard"
> = {
  parse: (value) => {
    if (isConventionTemplateFromRoute(value)) return value;
    throw new Error(
      `Invalid convention template fromRoute: expected one of ${conventionTemplateFromRouteValues.join(", ")}, got "${value}"`,
    );
  },
  stringify: (value) => value,
};

export const {
  RouteProvider,
  useRoute,
  routes: frontRoutes,
} = createRouter({
  addAgency: defineRoute(
    { ...connectedUserParams, siret: param.query.optional.string },
    () => "/ajouter-prescripteur",
  ),
  archivedConventionRequest: defineRoute(
    connectedUserParams,
    () => "/demande-convention-archivee",
  ),
  admin,
  ...restOfAdminRoutes,
  adminConventions,
  adminConventionDetail: adminConventions.extend(
    { conventionId: param.path.string },
    ({ conventionId }) => `/${conventionId}`,
  ),
  adminUsers,
  adminUserDetail: adminUsers.extend(
    { userId: param.path.string },
    ({ userId }) => `/${userId}`,
  ),
  adminUserDetailAgencies: adminUsers.extend(
    { userId: param.path.string },
    ({ userId }) => `/${userId}/agences`,
  ),
  adminUserDetailEstablishments: adminUsers.extend(
    { userId: param.path.string },
    ({ userId }) => `/${userId}/etablissements`,
  ),
  adminAgencies,
  adminAgencyDetail: adminAgencies.extend(
    { agencyId: param.path.string },
    ({ agencyId }) => `/${agencyId}`,
  ),
  adminEstablishments: adminEstablishments.extend(
    { siret: param.path.optional.string },
    ({ siret }) => `/${siret}`,
  ),

  agencyDashboard,
  agencyDashboardMain: agencyDashboard.extend("/dashboard"),
  agencyDashboardOnboarding: agencyDashboard.extend("/onboarding"),
  statsEstablishmentDetails: agencyDashboard.extend(
    "/stats-activites-par-entreprise",
  ),
  agencyManagement: agencyDashboard.extend("/pilotage-structure"),
  establishmentManagement: agencyDashboard.extend("/pilotage-entreprises"),

  myAccount,
  myAccountAgencies: myAccount.extend("/mes-agences"),
  myAccountEstablishments: myAccount.extend("/mes-etablissements"),
  myAccountAgencyRegistration: myAccount.extend("/agency-registration"),
  myAccountEstablishmentRegistration: myAccount.extend(
    { siret: param.query.optional.string },
    () => "/rattachement-entreprise",
  ),
  agencyDashboardAgencies: agencyDashboardAgencies,
  agencyDashboardAgencyDetails: agencyDashboardAgencies.extend(
    { agencyId: param.path.optional.string },
    ({ agencyId }) => `/${agencyId}`,
  ),
  beneficiaryDashboard,
  beneficiaryDashboardDiscussions: beneficiaryDashboard.extend(
    {
      discussionId: param.path.optional.string,
    },
    ({ discussionId }) => `/discussions/${discussionId}`,
  ),
  beneficiaryDashboardConventions: beneficiaryDashboard.extend("/conventions"),
  conventionConfirmation: defineRoute(
    {
      conventionId: param.path.string,
    },
    ({ conventionId }) => `/demande-immersion/confirmation/${conventionId}`,
  ),
  assessmentDocument: defineRoute(
    {
      jwt: param.query.optional.string,
      conventionId: param.query.optional.string,
      ...acquisitionParams,
    },
    () => "/bilan-document",
  ),
  conventionDocument: defineRoute(
    {
      jwt: param.query.optional.string,
      conventionId: param.query.optional.string,
    },
    () => "/convention-immersion",
  ),
  initiateConvention: defineRoute(
    {
      ...acquisitionParams,
      skipFirstStep: param.query.optional.boolean,
    },
    () => "/initier-convention",
  ),
  conventionImmersion: defineRoute(
    {
      jwt: param.query.optional.string,
      skipIntro: param.query.optional.boolean,
      conventionId: param.query.optional.string,
      conventionDraftId: param.query.optional.string,
      conventionTemplateId: param.query.optional.string,
      discussionId: param.query.optional.string,
      ...agencyParamsForConventionForm,
      ...establishmentParamsForConventionForm,
      ...acquisitionParams,
    },
    () => "/demande-immersion",
  ),
  conventionImmersionForExternals: defineRoute(
    {
      discussionId: param.query.optional.string,
      ...agencyParamsForConventionForm,
      ...establishmentParamsForConventionForm,
      ...acquisitionParams,
      ...conventionForExternalParams,
    },
    (params) => `/demande-immersion/${params.consumer}`,
  ),
  conventionMiniStage: defineRoute(
    {
      jwt: param.query.optional.string,
      conventionId: param.query.optional.string,
      conventionDraftId: param.query.optional.string,
      conventionTemplateId: param.query.optional.string,
      ...agencyParamsForConventionForm,
      ...establishmentParamsForConventionForm,
    },
    () => "/demande-mini-stage",
  ),
  conventionStatusDashboard: defineRoute(
    { jwt: param.query.string },
    () => "/statut-convention",
  ),
  conventionTemplate: defineRoute(
    {
      ...connectedUserParams,
      fromRoute: param.query.optional.ofType(
        conventionTemplateFromRouteSerializer,
      ),
      conventionTemplateId: param.query.optional.string,
    },
    () => "/modele-convention",
  ),
  conventionToSign: defineRoute(
    {
      jwt: param.query.string,
      ...acquisitionParams,
    },
    () => "/verifier-et-signer",
  ),
  establishmentDashboard,
  establishmentDashboardConventions:
    establishmentDashboard.extend("/conventions"),
  establishmentDashboardFormEstablishment: establishmentDashboard.extend(
    {
      siret: param.query.optional.string,
      shouldUpdateAvailability: param.query.optional.string,
    },
    () => "/fiche-entreprise",
  ),
  establishmentDashboardDiscussions: establishmentDashboard.extend(
    {
      discussionId: param.path.optional.string,
    },
    ({ discussionId }) => `/discussions/${discussionId}`,
  ),
  formEstablishment: defineRoute(
    {
      ...connectedUserParams,
      ...establishmentParams,
    },
    () => "/establishment",
  ),
  unregisterEstablishmentLead: defineRoute(
    {
      jwt: param.query.string,
    },
    () => "/desinscription-prospect",
  ),
  group: defineRoute(
    { groupSlug: param.path.string },
    (params) => `/groupe/${params.groupSlug}`,
  ),
  home: defineRoute("/"),
  homeAgencies: defineRoute("/accueil-prescripteurs"),
  homeCandidates: defineRoute("/accueil-beneficiaires"),
  homeEstablishments: defineRoute([
    "/accueil-entreprises",
    "/accueil-etablissement",
  ]),
  assessment: defineRoute(
    {
      jwt: param.query.string,
      conventionId: param.query.optional.string,
      ...acquisitionParams,
    },
    () => "/bilan-immersion",
  ),
  searchResult: defineRoute(
    {
      appellationCode: param.query.ofType(appellationStringSerializer),
      siret: param.query.string,
      location: param.query.optional.string,
      contactFirstName: param.query.optional.string,
      contactLastName: param.query.optional.string,
      contactEmail: param.query.optional.string,
      contactPhone: param.query.optional.string,
      contactMessage: param.query.optional.string,
    },
    () => "/offre",
  ),
  searchResultForStudent: defineRoute(
    {
      appellationCode: param.query.ofType(appellationStringSerializer),
      siret: param.query.string,
      location: param.query.optional.string,
      contactFirstName: param.query.optional.string,
      contactLastName: param.query.optional.string,
      contactEmail: param.query.optional.string,
      contactPhone: param.query.optional.string,
      contactMessage: param.query.optional.string,
    },
    () => "/offre-scolaire",
  ),
  searchResultExternal: defineRoute(
    {
      siret: param.query.string,
      appellationCode: param.query.ofType(appellationStringSerializer),
    },
    () => "/tentez-votre-chance",
  ),
  magicLinkInterstitial: defineRoute(
    {
      code: param.query.string,
      state: param.query.string,
      email: param.query.string,
    },
    () => "/connexion-interstitiel",
  ),
  manageConvention: defineRoute(
    { jwt: param.query.string },
    () => "/pilotage-convention",
  ),
  manageConventionConnectedUser: defineRoute(
    { ...connectedUserParams, conventionId: param.query.optional.string },
    () => "/pilotage-convention-inclusion-connect",
  ),
  openApiDoc: defineRoute(
    { version: param.query.optional.string },
    () => "/doc-api",
  ),
  search: defineRoute(searchParams, () => "/recherche"),
  externalSearch: defineRoute(searchParams, () => "/recherche-partenaires"),
  searchForStudent: defineRoute(searchParams, () => "/recherche-scolaire"),
  standard: defineRoute(
    {
      pagePath: param.path.ofType(standardPagesSerializer),
      version: param.query.optional.string,
    },
    (params) => `/pages/${params.pagePath}`,
  ),
  stats: defineRoute("/stats"),
  temporaryError: defineRoute(temporaryErrorParams, () => "/error"),
});

export const makeRouteAbsoluteUrl = ({
  route,
  baseUrl,
}: {
  route: Route<typeof frontRoutes>;
  baseUrl: AbsoluteUrl;
}): AbsoluteUrl => `${baseUrl}${route.href}`;

export const removeAllParamsFromUrl = (url: string) => url.split("?")[0];
