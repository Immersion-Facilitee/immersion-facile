import { AppConfig } from "../../config/bootstrap/appConfig";
import { createMakeProductionPgPool } from "../../config/pg/pgPool";
import { makeWarnInactiveAgenciesWithoutRecentConventions } from "../../domains/agency/use-cases/WarnInactiveAgenciesWithoutRecentConventions";
import { makeSaveNotificationsBatchAndRelatedEvent } from "../../domains/core/notifications/helpers/Notification";
import { RealTimeGateway } from "../../domains/core/time-gateway/adapters/RealTimeGateway";
import { createDbRelatedSystems } from "../../domains/core/unit-of-work/adapters/createDbRelatedSystems";
import { UuidV4Generator } from "../../domains/core/uuid-generator/adapters/UuidGeneratorImplementations";
import { createLogger } from "../../utils/logger";
import { handleCRONScript } from "../handleCRONScript";

const logger = createLogger(__filename);
const config = AppConfig.createFromEnv();
export const numberOfMonthsWithoutConvention = 3;

const warnInactiveAgenciesWithoutRecentConventionsScript = async () => {
  const { uowPerformer } = createDbRelatedSystems(
    config,
    createMakeProductionPgPool(config),
  );

  const timeGateway = new RealTimeGateway();
  const warnInactiveAgenciesWithoutRecentConventions =
    makeWarnInactiveAgenciesWithoutRecentConventions({
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

  const result = await warnInactiveAgenciesWithoutRecentConventions.execute({
    numberOfMonthsWithoutConvention,
  });
  return result;
};

export const triggerWarnInactiveAgenciesWithoutRecentConventions = ({
  exitOnFinish,
}: {
  exitOnFinish: boolean;
}) =>
  handleCRONScript({
    name: "triggerWarnInactiveAgenciesWithoutRecentConventions",
    config,
    script: warnInactiveAgenciesWithoutRecentConventionsScript,
    handleResults: ({ numberOfAgenciesWarned }) =>
      `${numberOfAgenciesWarned} agencies were warned, because they had no conventions validated or to be validated for the last ${numberOfMonthsWithoutConvention} months`,
    logger,
    exitOnFinish,
  });
