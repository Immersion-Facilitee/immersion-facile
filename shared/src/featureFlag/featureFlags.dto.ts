import type { AbsoluteUrl } from "../AbsoluteUrl";

type FeatureFlagSeverity = (typeof featureFlagSeverities)[number];

const featureFlagSeverities = ["warning", "error", "success", "info"] as const;

export type FeatureFlagName = keyof FeatureFlags;

export const featureFlagNames = [
  "enableTemporaryOperation",
  "enableMaintenance",
  "enableSearchByScore",
  "enableBroadcastOfMissionLocaleToFT",
  "enableBroadcastOfConseilDepartementalToFT",
  "enableBroadcastOfCapEmploiToFT",
  "enableEstablishmentDashboardHighlight",
  "enableAgencyDashboardHighlight",
  "enableInactiveUsersCleanup",
  "enableInactiveUsersDeletionAutoProcessing",
  "enableRequestArchivedConvention",
  "enableBeneficiaryManageConvention",
  "enableFranceTravailConventionBroadcast",
] as const;

const _insureAllFeatureFlagsAreInList = (
  featureFlagName: FeatureFlagName,
): (typeof featureFlagNames)[number] => featureFlagName;

export type FeatureFlagKind = (typeof featureFlagKinds)[number];

const featureFlagKinds = [
  "boolean",
  "textImageAndRedirect",
  "textWithSeverity",
  "highlight",
] as const;

type GenericFeatureFlag<K extends FeatureFlagKind, V = void> = {
  kind: K;
  isActive: boolean;
} & (V extends void ? object : { value: V });

export type WithFeatureFlagTextValue = { message: string };
export type WithFeatureFlagTitleValue = { title: string };
export type WithFeatureFlagButtonValue = { href: string; label: string };

type WithImageAndRedirect = {
  imageUrl: AbsoluteUrl;
  imageAlt: string;
  redirectUrl: AbsoluteUrl;
  overtitle: string;
} & WithFeatureFlagTitleValue;

type WithHighlight = WithFeatureFlagTitleValue &
  WithFeatureFlagTextValue &
  WithFeatureFlagButtonValue;

type WithSeverityValue = {
  severity: FeatureFlagSeverity;
};

export type FeatureFlagTextWithSeverity = GenericFeatureFlag<
  "textWithSeverity",
  WithFeatureFlagTextValue & WithSeverityValue
>;

export type FeatureFlagTextImageAndRedirect = GenericFeatureFlag<
  "textImageAndRedirect",
  WithFeatureFlagTextValue & WithImageAndRedirect
>;
export type FeatureFlagBoolean = GenericFeatureFlag<"boolean">;
export type FeatureFlagHighlight = GenericFeatureFlag<
  "highlight",
  WithHighlight
>;

export type FeatureFlag =
  | FeatureFlagBoolean
  | FeatureFlagTextImageAndRedirect
  | FeatureFlagTextWithSeverity
  | FeatureFlagHighlight;

export type FeatureFlags = {
  enableMaintenance: FeatureFlagTextWithSeverity;
  enableTemporaryOperation: FeatureFlagTextImageAndRedirect;
  enableSearchByScore: FeatureFlagBoolean;
  enableBroadcastOfMissionLocaleToFT: FeatureFlagBoolean;
  enableBroadcastOfConseilDepartementalToFT: FeatureFlagBoolean;
  enableBroadcastOfCapEmploiToFT: FeatureFlagBoolean;
  enableEstablishmentDashboardHighlight: FeatureFlagHighlight;
  enableAgencyDashboardHighlight: FeatureFlagHighlight;
  enableInactiveUsersCleanup: FeatureFlagBoolean;
  enableInactiveUsersDeletionAutoProcessing: FeatureFlagBoolean;
  enableRequestArchivedConvention: FeatureFlagBoolean;
  enableBeneficiaryManageConvention: FeatureFlagBoolean;
  enableFranceTravailConventionBroadcast: FeatureFlagBoolean;
};

export type SetFeatureFlagParam = {
  flagName: FeatureFlagName;
  featureFlag: FeatureFlag;
};

const makeFeatureFlag =
  <K extends FeatureFlagKind>(kind: K) =>
  (
    isActive: boolean,
    ...value: K extends "textWithSeverity"
      ? [FeatureFlagTextWithSeverity["value"]]
      : K extends "textImageAndRedirect"
        ? [FeatureFlagTextImageAndRedirect["value"]]
        : K extends "highlight"
          ? [FeatureFlagHighlight["value"]]
          : []
  ): Extract<FeatureFlag, { kind: K }> => {
    if (kind === "boolean")
      return { kind, isActive } as Extract<FeatureFlag, { kind: K }>;
    return {
      kind,
      isActive,
      value: value[0],
    } as Extract<FeatureFlag, { kind: K }>;
  };

export const makeBooleanFeatureFlag = makeFeatureFlag("boolean");
export const makeTextImageAndRedirectFeatureFlag = makeFeatureFlag(
  "textImageAndRedirect",
);
export const makeTextWithSeverityFeatureFlag =
  makeFeatureFlag("textWithSeverity");
export const makeHighlightFeatureFlag = makeFeatureFlag("highlight");
export const hasFeatureFlagValue = (
  flag: FeatureFlag | SetFeatureFlagParam["featureFlag"],
): flag is Extract<FeatureFlag, { value: object }> =>
  "value" in flag && flag.value !== undefined;
