import {
  expectToEqual,
  type FeatureFlagHighlight,
  type FeatureFlags,
  makeBooleanFeatureFlag,
  makeHighlightFeatureFlag,
  makeTextImageAndRedirectFeatureFlag,
  makeTextWithSeverityFeatureFlag,
} from "shared";
import { featureFlagSelectors } from "src/core-logic/domain/featureFlags/featureFlags.selector";
import {
  type FeatureFlagsState,
  featureFlagsSlice,
} from "src/core-logic/domain/featureFlags/featureFlags.slice";
import { feedbacksSelectors } from "src/core-logic/domain/feedback/feedback.selectors";
import {
  createTestStore,
  type TestDependencies,
} from "src/core-logic/storeConfig/createTestStore";
import type { ReduxStore } from "src/core-logic/storeConfig/store";

const defaultHighlightFeatureFlagValue: FeatureFlagHighlight["value"] = {
  title: "",
  message: "",
  href: "",
  label: "",
};

const highlightFeatureFlagFromApi: FeatureFlagHighlight["value"] = {
  title: "My establishment dashboard highlight",
  message: "My establishment dashboard highlight message",
  href: "https://",
  label: "My establishment dashboard highlight label",
};

const defaultFeatureFlags: FeatureFlags = {
  enableTemporaryOperation: makeTextImageAndRedirectFeatureFlag(false, {
    imageAlt: "",
    imageUrl: "https://",
    message: "",
    redirectUrl: "https://",
    overtitle: "",
    title: "",
  }),
  enableMaintenance: makeTextWithSeverityFeatureFlag(false, {
    message: "",
    severity: "warning",
  }),
  enableSearchByScore: makeBooleanFeatureFlag(false),
  enableBroadcastOfConseilDepartementalToFT: makeBooleanFeatureFlag(false),
  enableBroadcastOfCapEmploiToFT: makeBooleanFeatureFlag(false),
  enableBroadcastOfMissionLocaleToFT: makeBooleanFeatureFlag(false),
  enableEstablishmentDashboardHighlight: makeHighlightFeatureFlag(
    false,
    defaultHighlightFeatureFlagValue,
  ),
  enableAgencyDashboardHighlight: makeHighlightFeatureFlag(
    false,
    defaultHighlightFeatureFlagValue,
  ),
  enableInactiveUsersCleanup: makeBooleanFeatureFlag(false),
  enableInactiveUsersDeletionAutoProcessing: makeBooleanFeatureFlag(false),
  enableRequestArchivedConvention: makeBooleanFeatureFlag(false),
  enableBeneficiaryManageConvention: makeBooleanFeatureFlag(false),
  enableFranceTravailConventionBroadcast: makeBooleanFeatureFlag(true),
};

const flagsFromApi: FeatureFlags = {
  enableTemporaryOperation: makeTextImageAndRedirectFeatureFlag(false, {
    imageAlt: "",
    imageUrl: "https://",
    message: "",
    redirectUrl: "https://",
    overtitle: "",
    title: "",
  }),
  enableMaintenance: makeTextWithSeverityFeatureFlag(true, {
    message: "My maintenance message",
    severity: "error",
  }),
  enableSearchByScore: makeBooleanFeatureFlag(true),
  enableBroadcastOfConseilDepartementalToFT: makeBooleanFeatureFlag(false),
  enableBroadcastOfCapEmploiToFT: makeBooleanFeatureFlag(false),
  enableBroadcastOfMissionLocaleToFT: makeBooleanFeatureFlag(false),
  enableEstablishmentDashboardHighlight: makeHighlightFeatureFlag(
    false,
    highlightFeatureFlagFromApi,
  ),
  enableAgencyDashboardHighlight: makeHighlightFeatureFlag(
    false,
    highlightFeatureFlagFromApi,
  ),
  enableInactiveUsersCleanup: makeBooleanFeatureFlag(true),
  enableInactiveUsersDeletionAutoProcessing: makeBooleanFeatureFlag(false),
  enableRequestArchivedConvention: makeBooleanFeatureFlag(false),
  enableBeneficiaryManageConvention: makeBooleanFeatureFlag(false),
  enableFranceTravailConventionBroadcast: makeBooleanFeatureFlag(true),
};

describe("feature flag slice", () => {
  let store: ReduxStore;
  let dependencies: TestDependencies;

  beforeEach(() => {
    ({ store, dependencies } = createTestStore());
  });

  it("fetches feature flags and shows when loading", () => {
    expectFeatureFlagsStateToEqual({
      ...defaultFeatureFlags,
      isLoading: true, // feature flags are loading by default
    });
    store.dispatch(featureFlagsSlice.actions.retrieveFeatureFlagsRequested());
    expectFeatureFlagsStateToEqual({
      ...defaultFeatureFlags,
      isLoading: true,
    });
    dependencies.technicalGateway.featureFlags$.next(flagsFromApi);
    expectFeatureFlagsStateToEqual({
      ...flagsFromApi,
      isLoading: false,
    });
  });

  it("fetches feature flags and shows when failed", () => {
    expectFeatureFlagsStateToEqual({
      ...defaultFeatureFlags,
      isLoading: true,
    });
    store.dispatch(featureFlagsSlice.actions.retrieveFeatureFlagsRequested());
    expectFeatureFlagsStateToEqual({
      ...defaultFeatureFlags,
      isLoading: true,
    });
    dependencies.technicalGateway.featureFlags$.error(
      new Error("Failed to fetch feature flags"),
    );
    expectFeatureFlagsStateToEqual({
      ...defaultFeatureFlags,
      isLoading: false,
    });

    expectToEqual(feedbacksSelectors.feedbacks(store.getState()), {
      "feature-flags-global": {
        level: "error",
        message: "Failed to fetch feature flags",
        on: "fetch",
        title: "Problème de communication avec le serveur Immersion Facilitée",
      },
    });
  });

  it("sets feature flag to given value", () => {
    ({ store, dependencies } = createTestStore({
      featureFlags: {
        ...defaultFeatureFlags,
        enableTemporaryOperation: makeTextImageAndRedirectFeatureFlag(false, {
          imageAlt: "",
          imageUrl: "https://",
          message: "",
          redirectUrl: "https://",
          overtitle: "",
          title: "",
        }),
        isLoading: false,
      },
    }));

    store.dispatch(
      featureFlagsSlice.actions.setFeatureFlagRequested({
        flagName: "enableTemporaryOperation",
        featureFlag: makeTextImageAndRedirectFeatureFlag(true, {
          imageAlt: "",
          imageUrl: "https://",
          message: "",
          redirectUrl: "https://",
          overtitle: "",
          title: "",
        }),
      }),
    );
    expectFeatureFlagsStateToEqual({
      ...defaultFeatureFlags,
      enableTemporaryOperation: makeTextImageAndRedirectFeatureFlag(true, {
        imageAlt: "",
        imageUrl: "https://",
        message: "",
        redirectUrl: "https://",
        overtitle: "",
        title: "",
      }),
      isLoading: true,
    });
    dependencies.adminGateway.setFeatureFlagResponse$.next(undefined);
    expectToEqual(dependencies.adminGateway.setFeatureFlagLastCalledWith, {
      flagName: "enableTemporaryOperation",
      featureFlag: makeTextImageAndRedirectFeatureFlag(true, {
        imageAlt: "",
        imageUrl: "https://",
        message: "",
        redirectUrl: "https://",
        overtitle: "",
        title: "",
      }),
    });
    expectFeatureFlagsStateToEqual({
      ...defaultFeatureFlags,
      enableTemporaryOperation: makeTextImageAndRedirectFeatureFlag(true, {
        imageAlt: "",
        imageUrl: "https://",
        message: "",
        redirectUrl: "https://",
        overtitle: "",
        title: "",
      }),
      isLoading: false,
    });
  });
  it("sets feature flag to given value and shows when failed", () => {
    ({ store, dependencies } = createTestStore({
      featureFlags: {
        ...defaultFeatureFlags,
        enableTemporaryOperation: makeTextImageAndRedirectFeatureFlag(false, {
          imageAlt: "",
          imageUrl: "https://",
          message: "",
          redirectUrl: "https://",
          overtitle: "",
          title: "",
        }),
        isLoading: false,
      },
    }));

    store.dispatch(
      featureFlagsSlice.actions.setFeatureFlagRequested({
        flagName: "enableTemporaryOperation",
        featureFlag: makeTextImageAndRedirectFeatureFlag(true, {
          imageAlt: "",
          imageUrl: "https://",
          message: "",
          redirectUrl: "https://",
          overtitle: "",
          title: "",
        }),
      }),
    );
    expectFeatureFlagsStateToEqual({
      ...defaultFeatureFlags,
      enableTemporaryOperation: makeTextImageAndRedirectFeatureFlag(true, {
        imageAlt: "",
        imageUrl: "https://",
        message: "",
        redirectUrl: "https://",
        overtitle: "",
        title: "",
      }),
      isLoading: true,
    });
    dependencies.adminGateway.setFeatureFlagResponse$.error(
      new Error("Failed to set feature flag"),
    );
    expectFeatureFlagsStateToEqual({
      ...defaultFeatureFlags,
      enableTemporaryOperation: makeTextImageAndRedirectFeatureFlag(true, {
        imageAlt: "",
        imageUrl: "https://",
        message: "",
        redirectUrl: "https://",
        overtitle: "",
        title: "",
      }),
      isLoading: false,
    });
  });

  const expectFeatureFlagsStateToEqual = (expected: FeatureFlagsState) => {
    expectToEqual(
      featureFlagSelectors.featureFlagState(store.getState()),
      expected,
    );
  };
});
