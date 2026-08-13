import type { Pool } from "pg";
import {
  expectToEqual,
  type FeatureFlags,
  makeBooleanFeatureFlag,
  makeHighlightFeatureFlag,
  makeTextImageAndRedirectFeatureFlag,
  makeTextWithSeverityFeatureFlag,
} from "shared";
import {
  type KyselyDb,
  makeKyselyDb,
} from "../../../../config/pg/kysely/kyselyUtils";
import { makeTestPgPool } from "../../../../config/pg/pgPool";
import type { FeatureFlagQueries } from "../ports/FeatureFlagQueries";
import type { FeatureFlagRepository } from "../ports/FeatureFlagRepository";
import { PgFeatureFlagQueries } from "./PgFeatureFlagQueries";
import { PgFeatureFlagRepository } from "./PgFeatureFlagRepository";

describe("PG getFeatureFlags", () => {
  let pool: Pool;
  let db: KyselyDb;
  let featureFlagRepository: FeatureFlagRepository;
  let featureFlagQueries: FeatureFlagQueries;

  beforeAll(async () => {
    pool = makeTestPgPool();
    db = makeKyselyDb(pool);
    featureFlagRepository = new PgFeatureFlagRepository(db);
    featureFlagQueries = new PgFeatureFlagQueries(db);
  });

  beforeEach(async () => {
    await db.deleteFrom("feature_flags").execute();
  });

  afterAll(async () => {
    await pool.end();
  });

  it("gets all the Feature Flags of the app", async () => {
    const expectedFeatureFlags: FeatureFlags = {
      enableTemporaryOperation: makeTextImageAndRedirectFeatureFlag(false, {
        imageAlt: "Alt",
        imageUrl: "http://image",
        message: "message",
        redirectUrl: "http://redirect",
        overtitle: "",
        title: "",
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
      enableBeneficiaryConventionPilotage: makeBooleanFeatureFlag(false),
    };

    await featureFlagRepository.insertAll(expectedFeatureFlags);

    expectToEqual(await featureFlagQueries.getAll(), {
      enableTemporaryOperation: makeTextImageAndRedirectFeatureFlag(false, {
        imageAlt: "Alt",
        imageUrl: "http://image",
        message: "message",
        redirectUrl: "http://redirect",
        overtitle: "",
        title: "",
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
      enableBeneficiaryConventionPilotage: makeBooleanFeatureFlag(false),
    });
  });

  it("inserts featureFlags then updates a Feature Flag to the given value", async () => {
    const initialFeatureFlags: FeatureFlags = {
      enableTemporaryOperation: makeTextImageAndRedirectFeatureFlag(false, {
        imageAlt: "Alt",
        imageUrl: "http://image",
        message: "message",
        redirectUrl: "http://redirect",
        overtitle: "overtitle",
        title: "title",
      }),
      enableMaintenance: makeTextWithSeverityFeatureFlag(false, {
        message: "Maintenance message",
        severity: "error",
      }),
      enableSearchByScore: makeBooleanFeatureFlag(false),
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
      enableBeneficiaryConventionPilotage: makeBooleanFeatureFlag(false),
    };

    await featureFlagRepository.insertAll(initialFeatureFlags);

    expectToEqual(await featureFlagQueries.getAll(), initialFeatureFlags);

    await featureFlagRepository.update({
      flagName: "enableTemporaryOperation",
      featureFlag: makeTextImageAndRedirectFeatureFlag(true, {
        imageAlt: "updatedAlt",
        imageUrl: "http://updatedImage",
        message: "updatedMessage",
        redirectUrl: "http://updatedRedirect",
        overtitle: "updatedOvertitle",
        title: "updatedTitle",
      }),
    });

    await featureFlagRepository.update({
      flagName: "enableEstablishmentDashboardHighlight",
      featureFlag: makeHighlightFeatureFlag(true, {
        title: "updatedTitle",
        message: "updatedMessage",
        href: "https://www.example.com",
        label: "updatedLabel",
      }),
    });

    await featureFlagRepository.update({
      flagName: "enableSearchByScore",
      featureFlag: makeBooleanFeatureFlag(true),
    });

    expectToEqual(await featureFlagQueries.getAll(), {
      enableTemporaryOperation: makeTextImageAndRedirectFeatureFlag(true, {
        imageAlt: "updatedAlt",
        imageUrl: "http://updatedImage",
        message: "updatedMessage",
        redirectUrl: "http://updatedRedirect",
        overtitle: "updatedOvertitle",
        title: "updatedTitle",
      }),
      enableMaintenance: makeTextWithSeverityFeatureFlag(false, {
        message: "Maintenance message",
        severity: "error",
      }),
      enableSearchByScore: makeBooleanFeatureFlag(true),
      enableBroadcastOfConseilDepartementalToFT: makeBooleanFeatureFlag(false),
      enableBroadcastOfCapEmploiToFT: makeBooleanFeatureFlag(false),
      enableBroadcastOfMissionLocaleToFT: makeBooleanFeatureFlag(false),
      enableEstablishmentDashboardHighlight: makeHighlightFeatureFlag(true, {
        title: "updatedTitle",
        message: "updatedMessage",
        href: "https://www.example.com",
        label: "updatedLabel",
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
      enableBeneficiaryConventionPilotage: makeBooleanFeatureFlag(false),
    });
  });
});
