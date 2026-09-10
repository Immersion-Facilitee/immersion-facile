import { AppConfig } from "../../config/bootstrap/appConfig";
import { createMakeProductionPgPool } from "../../config/pg/pgPool";
import { makeConventionSummaryNotifications } from "../../domains/agency/use-cases/notifications/ConventionSummaryNotifications";
import { makeSaveNotificationsBatchAndRelatedEvent } from "../../domains/core/notifications/helpers/Notification";
import { RealTimeGateway } from "../../domains/core/time-gateway/adapters/RealTimeGateway";
import { createDbRelatedSystems } from "../../domains/core/unit-of-work/adapters/createDbRelatedSystems";
import { UuidV4Generator } from "../../domains/core/uuid-generator/adapters/UuidGeneratorImplementations";
import { createLogger } from "../../utils/logger";
import { handleCRONScript } from "../handleCRONScript";

const logger = createLogger(__filename);
const config = AppConfig.createFromEnv();

const conventionSummaryNotificationsScript = async () => {
  const getPgPool = createMakeProductionPgPool(config);

  const { uowPerformer } = createDbRelatedSystems(config, getPgPool);

  const pgPool = getPgPool();

  const uuidGenerator = new UuidV4Generator();
  const timeGateway = new RealTimeGateway();

  const notifications = await makeConventionSummaryNotifications({
    uowPerformer,
    deps: {
      timeGateway,
      saveNotificationsBatchAndRelatedEvent:
        makeSaveNotificationsBatchAndRelatedEvent(uuidGenerator, timeGateway),
    },
  }).execute();

  await pgPool.end();

  return { notifications };
};

export const triggerConventionSummaryNotificationsScript = ({
  exitOnFinish,
}: {
  exitOnFinish: boolean;
}) =>
  handleCRONScript({
    name: "conventionSummaryNotificationsScript",
    config,
    script: conventionSummaryNotificationsScript,
    handleResults: ({ notifications }) =>
      `${notifications} notifications has been prepared to be sent to notified agence users`,
    logger,
    exitOnFinish,
  });
