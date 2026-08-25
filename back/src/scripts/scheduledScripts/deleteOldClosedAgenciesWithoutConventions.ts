import { AppConfig } from "../../config/bootstrap/appConfig";
import { createMakeProductionPgPool } from "../../config/pg/pgPool";
import {
  makeDeleteOldClosedAgenciesWithoutConventions,
  numberOfMonthsBeforeDeletion,
} from "../../domains/agency/use-cases/DeleteOldClosedAgenciesWithoutConventions";
import { RealTimeGateway } from "../../domains/core/time-gateway/adapters/RealTimeGateway";
import { createDbRelatedSystems } from "../../domains/core/unit-of-work/adapters/createDbRelatedSystems";
import { createLogger } from "../../utils/logger";
import { handleCRONScript } from "../handleCRONScript";

const logger = createLogger(__filename);
const config = AppConfig.createFromEnv();

const deleteOldClosedAgenciesWithoutConventions = async () => {
  const { uowPerformer } = createDbRelatedSystems(
    config,
    createMakeProductionPgPool(config),
  );

  return makeDeleteOldClosedAgenciesWithoutConventions({
    uowPerformer,
    deps: { timeGateway: new RealTimeGateway() },
  }).execute();
};

export const triggerDeleteOldClosedAgenciesWithoutConventions = ({
  exitOnFinish,
}: {
  exitOnFinish: boolean;
}) =>
  handleCRONScript({
    name: "triggerDeleteOldClosedAgenciesWithoutConventions",
    config,
    script: deleteOldClosedAgenciesWithoutConventions,
    handleResults: ({ deletedAgencies }) =>
      `${deletedAgencies.length} agencies were deleted, because they were more than ${numberOfMonthsBeforeDeletion} months old, had status closed or rejected, and had no conventions`,
    logger,
    exitOnFinish,
  });
