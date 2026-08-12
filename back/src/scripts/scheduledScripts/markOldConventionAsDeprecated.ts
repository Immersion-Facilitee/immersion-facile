import { subMonths } from "date-fns";
import { AppConfig } from "../../config/bootstrap/appConfig";
import { createMakeProductionPgPool } from "../../config/pg/pgPool";
import { makeMarkOldConventionAsDeprecated } from "../../domains/convention/use-cases/MarkOldConventionAsDeprecated";
import { makeCreateNewEvent } from "../../domains/core/events/ports/EventBus";
import { RealTimeGateway } from "../../domains/core/time-gateway/adapters/RealTimeGateway";
import { createDbRelatedSystems } from "../../domains/core/unit-of-work/adapters/createDbRelatedSystems";
import { UuidV4Generator } from "../../domains/core/uuid-generator/adapters/UuidGeneratorImplementations";
import { createLogger } from "../../utils/logger";
import { handleCRONScript } from "../handleCRONScript";

const logger = createLogger(__filename);

const config = AppConfig.createFromEnv();

const markOldConventionAsDeprecated = async () => {
  const deprecateSince = subMonths(new Date(), 1);

  const { numberOfUpdatedConventions } =
    await makeMarkOldConventionAsDeprecated({
      uowPerformer: createDbRelatedSystems(
        config,
        createMakeProductionPgPool(config),
      ).uowPerformer,
      deps: {
        createNewEvent: makeCreateNewEvent({
          timeGateway: new RealTimeGateway(),
          uuidGenerator: new UuidV4Generator(),
        }),
      },
    }).execute({
      deprecateSince,
    });

  return { numberOfUpdatedConventions };
};

export const triggerMarkOldConventionAsDeprecated = ({
  exitOnFinish,
}: {
  exitOnFinish: boolean;
}) =>
  handleCRONScript({
    name: "triggerMarkOldConventionAsDeprecated",
    config,
    script: markOldConventionAsDeprecated,
    handleResults: ({ numberOfUpdatedConventions }) =>
      `Marked ${numberOfUpdatedConventions} as deprecated`,
    logger,
    exitOnFinish,
  });
