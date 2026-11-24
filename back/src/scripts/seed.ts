import { AppConfig } from "../config/bootstrap/appConfig";
import {
  type AppDependencies,
  createAppDependencies,
} from "../config/bootstrap/createAppDependencies";
import { type KyselyDb, makeKyselyDb } from "../config/pg/kysely/kyselyUtils";
import { agencySeed } from "./seed/agencySeed";
import { conventionDraftSeed } from "./seed/conventionDraftSeed";
import { conventionSeed } from "./seed/conventionSeed";
import { establishmentSeed } from "./seed/establishmentSeed";
import { eventSeed } from "./seed/eventSeed";
import { featureFlagsSeed } from "./seed/featureFlagSeed";
import { userSeed } from "./seed/userSeed";

const executeSeedTasks = async (db: KyselyDb, deps: AppDependencies) => {
  // biome-ignore lint/suspicious/noConsole: <explanation>
  console.log("Seed start");

  await userSeed(db);

  await deps.uowPerformer.perform(async (uow) => {
    await featureFlagsSeed(uow);
    const agencyIds = await agencySeed(uow);
    await establishmentSeed(uow);
    await conventionSeed(uow, agencyIds);
    await conventionDraftSeed(uow);
    await eventSeed(uow);
  });

  // biome-ignore lint/suspicious/noConsole: <explanation>
  console.log("Seed end");
};

const resetDb = async (db: KyselyDb) => {
  // biome-ignore lint/suspicious/noConsole: <explanation>
  console.log("Reset Db start");

  await db.deleteFrom("immersion_assessments").execute();
  await db.deleteFrom("api_consumers_subscriptions").execute();
  await db.deleteFrom("api_consumers").execute();
  await db.deleteFrom("users_ongoing_oauths").execute();
  await db.deleteFrom("convention_templates").execute();
  await db.deleteFrom("users").execute();
  await db.deleteFrom("users_admins").execute();
  await db.deleteFrom("conventions").execute();
  await db.deleteFrom("convention_drafts").execute();
  await db.deleteFrom("agency_groups__agencies").execute();
  await db.deleteFrom("agency_groups").execute();
  await db.deleteFrom("agencies").execute();
  await db.deleteFrom("discussions").execute();
  await db.deleteFrom("establishments__users").execute();
  await db.deleteFrom("establishments").execute();
  await db.deleteFrom("groups").execute();
  await db.deleteFrom("feature_flags").execute();
  await db.deleteFrom("notifications_email_recipients").execute();
  await db.deleteFrom("notifications_email_attachments").execute();
  await db.deleteFrom("notifications_email").execute();
  await db.deleteFrom("notifications_sms").execute();
  await db.deleteFrom("outbox_failures").execute();
  await db.deleteFrom("outbox_publications").execute();
  await db.deleteFrom("outbox").execute();
  await db.deleteFrom("banned_establishments").execute();

  // biome-ignore lint/suspicious/noConsole: <explanation>
  console.log("Reset Db done");
};

const seed = async () => {
  const config = AppConfig.createFromEnv();
  const deps = await createAppDependencies(config);
  const pool = deps.getPgPoolFn();
  const db = makeKyselyDb(pool, {
    isDev: config.envType !== "production",
  });

  await resetDb(db);

  await executeSeedTasks(db, deps);

  await pool.end();
  await deps.gateways.disconnectCache();

  // biome-ignore lint/suspicious/noConsole: <explanation>
  console.log("Pool end");
};

seed()
  .then(() => {
    // biome-ignore lint/suspicious/noConsole: <explanation>
    console.log("Seeding script ended !");
    process.exit(0);
  })
  .catch((err) => {
    console.error("Something went wrong with seed script : ", err);
    process.exit(1);
  });

// un lien rapide pour pas remplir le formulaire à la main en local (avec le siret france merguez, et l'agence pole emploi paris défini dans cette seed)
// http://localhost:3000/demande-immersion?conventionDraftId=11111111-1111-4111-9111-111111111111
