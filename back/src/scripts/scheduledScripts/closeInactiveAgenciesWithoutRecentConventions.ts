import { AppConfig } from "../../config/bootstrap/appConfig";
import { createMakeProductionPgPool } from "../../config/pg/pgPool";
import { makeCloseInactiveAgenciesWithoutRecentConventions } from "../../domains/agency/use-cases/CloseInactiveAgenciesWithoutRecentConventions";
import { makeSaveNotificationsBatchAndRelatedEvent } from "../../domains/core/notifications/helpers/Notification";
import { RealTimeGateway } from "../../domains/core/time-gateway/adapters/RealTimeGateway";
import { createDbRelatedSystems } from "../../domains/core/unit-of-work/adapters/createDbRelatedSystems";
import { UuidV4Generator } from "../../domains/core/uuid-generator/adapters/UuidGeneratorImplementations";
import { createLogger } from "../../utils/logger";
import { handleCRONScript } from "../handleCRONScript";

const logger = createLogger(__filename);
const config = AppConfig.createFromEnv();
export const numberOfMonthsWithoutConvention = 3;

const closeInactiveAgenciesWithoutRecentConventionsScript = async () => {
  const { uowPerformer } = createDbRelatedSystems(
    config,
    createMakeProductionPgPool(config),
  );

  const timeGateway = new RealTimeGateway();
  const closeInactiveAgenciesWithoutRecentConventions =
    makeCloseInactiveAgenciesWithoutRecentConventions({
      deps: {
        uowPerformer,
        timeGateway,
        batchSize: 500,
        saveNotificationsBatchAndRelatedEvent:
          makeSaveNotificationsBatchAndRelatedEvent(
            new UuidV4Generator(),
            timeGateway,
          ),
      },
    });

  const result = await closeInactiveAgenciesWithoutRecentConventions.execute({
    numberOfMonthsWithoutConvention,
  });
  return result;
};

export const triggerCloseInactiveAgenciesWithoutRecentConventions = ({
  exitOnFinish,
}: {
  exitOnFinish: boolean;
}) =>
  handleCRONScript({
    name: "triggerCloseInactiveAgenciesWithoutRecentConventions",
    config,
    script: closeInactiveAgenciesWithoutRecentConventionsScript,
    handleResults: ({ numberOfAgenciesClosed }) =>
      `${numberOfAgenciesClosed} agencies were closed, because they had no conventions validated or to be validated since the last inactivity warning 3 months ago`,
    logger,
    exitOnFinish,
  });
