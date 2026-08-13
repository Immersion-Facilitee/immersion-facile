import {
  type FeatureFlags,
  makeBooleanFeatureFlag,
  makeHighlightFeatureFlag,
  makeTextImageAndRedirectFeatureFlag,
  makeTextWithSeverityFeatureFlag,
} from "shared";

const defaultFlagsInFront: FeatureFlags = {
  enableTemporaryOperation: makeTextImageAndRedirectFeatureFlag(false, {
    imageAlt: "imageAlt",
    imageUrl: "https://imageUrl",
    message: "message",
    redirectUrl: "https://redirect-url",
    overtitle: "overtitle",
    title: "title",
  }),
  enableMaintenance: makeTextWithSeverityFeatureFlag(false, {
    message: "My maintenance message",
    severity: "warning",
  }),
  enableSearchByScore: makeBooleanFeatureFlag(false),
  enableBroadcastOfConseilDepartementalToFT: makeBooleanFeatureFlag(false),
  enableBroadcastOfCapEmploiToFT: makeBooleanFeatureFlag(false),
  enableBroadcastOfMissionLocaleToFT: makeBooleanFeatureFlag(false),
  enableEstablishmentDashboardHighlight: makeHighlightFeatureFlag(false, {
    title: "",
    message: "",
    href: "",
    label: "",
  }),
  enableAgencyDashboardHighlight: makeHighlightFeatureFlag(false, {
    title: "",
    message: "",
    href: "",
    label: "",
  }),
  enableInactiveUsersCleanup: makeBooleanFeatureFlag(false),
  enableInactiveUsersDeletionAutoProcessing: makeBooleanFeatureFlag(false),
  enableRequestArchivedConvention: makeBooleanFeatureFlag(false),
  enableBeneficiaryConventionPilotage: makeBooleanFeatureFlag(false),
};

export const makeStubFeatureFlags = (
  flags: Partial<FeatureFlags> = {},
): FeatureFlags => ({ ...defaultFlagsInFront, ...flags });
