import "./instrumentSentryCron";
import { AppConfig } from "../config/bootstrap/appConfig";
import { createMakeProductionPgPool } from "../config/pg/pgPool";
import { makeDeleteNotifications } from "../domains/core/notifications/useCases/DeleteNotifications";
import { RealTimeGateway } from "../domains/core/time-gateway/adapters/RealTimeGateway";
import { createDbRelatedSystems } from "../domains/core/unit-of-work/adapters/createDbRelatedSystems";
import { createLogger } from "../utils/logger";
import { handleCRONScript } from "./handleCRONScript";

const logger = createLogger(__filename);
const config = AppConfig.createFromEnv();

const deleteOldNotifications = async () => {
  const totalLimit = Number(process.argv.at(2) ?? 100_000);
  const batchSize = 1_000;

  const { uowPerformer } = createDbRelatedSystems(
    config,
    createMakeProductionPgPool(config),
  );

  const deleteNotifications = makeDeleteNotifications({
    uowPerformer,
    deps: { timeGateway: new RealTimeGateway() },
  });

  let totalDeletedNotifications = 0;

  while (totalDeletedNotifications < totalLimit) {
    const remaining = totalLimit - totalDeletedNotifications;
    const limitForThisBatch = Math.min(batchSize, remaining);

    const { deletedNotifications } = await deleteNotifications.execute({
      limit: limitForThisBatch,
    });

    if (deletedNotifications === 0) {
      logger.info({ message: "No more notification to delete." });
      break;
    }

    totalDeletedNotifications += deletedNotifications;

    logger.info({
      message: `Batch deleted: ${deletedNotifications}, total deleted: ${totalDeletedNotifications}/${totalLimit}`,
    });
  }

  return { totalDeletedNotifications };
};

handleCRONScript({
  name: "triggerDeleteOldNotifications",
  config,
  script: deleteOldNotifications,
  handleResults: ({ totalDeletedNotifications }) =>
    `${totalDeletedNotifications} notifications deleted.`,
  logger,
});
