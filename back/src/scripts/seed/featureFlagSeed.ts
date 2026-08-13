import {
  type FeatureFlags,
  makeBooleanFeatureFlag,
  makeHighlightFeatureFlag,
  makeTextImageAndRedirectFeatureFlag,
  makeTextWithSeverityFeatureFlag,
} from "shared";
import type { UnitOfWork } from "../../domains/core/unit-of-work/ports/UnitOfWork";

export const featureFlagsSeed = async (uow: UnitOfWork) => {
  // biome-ignore lint/suspicious/noConsole: <explanation>
  console.log("featureFlagsSeed start ...");

  const featureFlags: FeatureFlags = {
    enableTemporaryOperation: makeTextImageAndRedirectFeatureFlag(false, {
      message: "message",
      imageUrl: "https://imageUrl",
      redirectUrl: "https://redirect-url",
      imageAlt: "",
      title: "",
      overtitle: "",
    }),
    enableMaintenance: makeTextWithSeverityFeatureFlag(false, {
      message: "Mon message de maintenance",
      severity: "warning",
    }),
    enableSearchByScore: makeBooleanFeatureFlag(true),
    enableBroadcastOfConseilDepartementalToFT: makeBooleanFeatureFlag(false),
    enableBroadcastOfCapEmploiToFT: makeBooleanFeatureFlag(false),
    enableBroadcastOfMissionLocaleToFT: makeBooleanFeatureFlag(false),
    enableEstablishmentDashboardHighlight: makeHighlightFeatureFlag(false, {
      title: "Mon titre de highlight",
      message: "Mon message de highlight",
      href: "https://www.example.com",
      label: "Mon label de highlight",
    }),
    enableAgencyDashboardHighlight: makeHighlightFeatureFlag(false, {
      title: "Mon titre de highlight",
      message: "Mon message de highlight",
      href: "https://www.example.com",
      label: "Mon label de highlight",
    }),
    enableInactiveUsersCleanup: makeBooleanFeatureFlag(false),
    enableInactiveUsersDeletionAutoProcessing: makeBooleanFeatureFlag(false),
    enableRequestArchivedConvention: makeBooleanFeatureFlag(false),
    enableBeneficiaryConventionPilotage: makeBooleanFeatureFlag(true),
  };

  await uow.featureFlagRepository.insertAll(featureFlags);

  // biome-ignore lint/suspicious/noConsole: <explanation>
  console.log("featureFlagsSeed done");
};
