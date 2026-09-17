import { AppConfig } from "../../config/bootstrap/appConfig";
import { createMakeProductionPgPool } from "../../config/pg/pgPool";
import { makeCreateNewEvent } from "../../domains/core/events/ports/EventBus";
import { RealTimeGateway } from "../../domains/core/time-gateway/adapters/RealTimeGateway";
import { createDbRelatedSystems } from "../../domains/core/unit-of-work/adapters/createDbRelatedSystems";
import { UuidV4Generator } from "../../domains/core/uuid-generator/adapters/UuidGeneratorImplementations";
import { makeGetDiscussionsNeedingBeneficiaryFollowUpAndEmitEvents } from "../../domains/establishment/use-cases/discussions/GetDiscussionsNeedingBeneficiaryFollowUpAndEmitEvents";
import { createLogger } from "../../utils/logger";
import { handleCRONScript } from "../handleCRONScript";

const logger = createLogger(__filename);

const config = AppConfig.createFromEnv();

const executeContactRequestBeneficiaryReminder15Days = () => {
  logger.info({
    message:
      "Starting contact request beneficiary reminder script 15 days without answers",
  });

  const timeGateway = new RealTimeGateway();

  return makeGetDiscussionsNeedingBeneficiaryFollowUpAndEmitEvents({
    uowPerformer: createDbRelatedSystems(
      config,
      createMakeProductionPgPool(config),
    ).uowPerformer,
    deps: {
      timeGateway,
      createNewEvent: makeCreateNewEvent({
        timeGateway,
        uuidGenerator: new UuidV4Generator(),
      }),
    },
  }).execute();
};

export const triggerContactRequestBeneficiaryReminder15Days = ({
  exitOnFinish,
}: {
  exitOnFinish: boolean;
}) =>
  handleCRONScript({
    name: "contactRequestBeneficiaryReminderScript15Days",
    config,
    script: executeContactRequestBeneficiaryReminder15Days,
    handleResults: ({ numberOfDiscussionsToFollowUp }) =>
      `Total of beneficiary follow up events emitted : ${numberOfDiscussionsToFollowUp}`,
    logger,
    exitOnFinish,
  });
