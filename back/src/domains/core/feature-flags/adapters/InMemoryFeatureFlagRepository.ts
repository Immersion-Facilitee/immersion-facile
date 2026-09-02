import {
  type FeatureFlags,
  makeBooleanFeatureFlag,
  makeHighlightFeatureFlag,
  makeTextImageAndRedirectFeatureFlag,
  makeTextWithSeverityFeatureFlag,
  type SetFeatureFlagParam,
} from "shared";
import type { FeatureFlagRepository } from "../ports/FeatureFlagRepository";

const defaultFlags: FeatureFlags = {
  enableTemporaryOperation: makeTextImageAndRedirectFeatureFlag(false, {
    imageAlt: "altImage",
    imageUrl: "https://imageUrl",
    message: "message",
    redirectUrl: "https://redirect-url",
    overtitle: "overtitle",
    title: "title",
  }),
  enableMaintenance: makeTextWithSeverityFeatureFlag(false, {
    message: "Maintenance message",
    severity: "warning",
  }),
  enableSearchByScore: makeBooleanFeatureFlag(false),
  enableBroadcastOfConseilDepartementalToFT: makeBooleanFeatureFlag(false),
  enableBroadcastOfCapEmploiToFT: makeBooleanFeatureFlag(false),
  enableBroadcastOfMissionLocaleToFT: makeBooleanFeatureFlag(false),
  enableEstablishmentDashboardHighlight: makeHighlightFeatureFlag(false, {
    title: "Mon titre de highlight pour l'entreprise",
    message: "Mon message de highlight pour l'entreprise",
    href: "https://www.example.com",
    label: "Mon label de highlight pour l'entreprise",
  }),
  enableAgencyDashboardHighlight: makeHighlightFeatureFlag(false, {
    title: "Mon titre de highlight pour l'agence",
    message: "Mon message de highlight pour l'agence",
    href: "https://www.example.com",
    label: "Mon label de highlight pour l'agence",
  }),
  enableInactiveUsersCleanup: makeBooleanFeatureFlag(false),
  enableInactiveUsersDeletionAutoProcessing: makeBooleanFeatureFlag(false),
  enableRequestArchivedConvention: makeBooleanFeatureFlag(false),
  enableBeneficiaryManageConvention: makeBooleanFeatureFlag(false),
  enableFranceTravailConventionBroadcast: makeBooleanFeatureFlag(true),
};

export class InMemoryFeatureFlagRepository implements FeatureFlagRepository {
  #featureFlags: FeatureFlags;

  constructor(featureFlags: Partial<FeatureFlags> = {}) {
    this.#featureFlags = { ...defaultFlags, ...featureFlags };
  }

  public async getAll(): Promise<FeatureFlags> {
    return this.#featureFlags;
  }

  public async insertAll(flags: FeatureFlags): Promise<void> {
    this.#featureFlags = flags;
  }

  public async update(params: SetFeatureFlagParam): Promise<void> {
    this.#featureFlags[params.flagName] = {
      ...this.#featureFlags[params.flagName],
      ...(params.featureFlag as any),
    };
  }

  set featureFlags(featureFlags: Partial<FeatureFlags>) {
    this.#featureFlags = { ...defaultFlags, ...featureFlags };
  }
}
