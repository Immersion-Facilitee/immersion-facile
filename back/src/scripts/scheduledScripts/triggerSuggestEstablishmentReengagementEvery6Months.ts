import { AppConfig } from "../../config/bootstrap/appConfig";
import { createMakeProductionPgPool } from "../../config/pg/pgPool";
import { makeSaveNotificationsBatchAndRelatedEvent } from "../../domains/core/notifications/helpers/Notification";
import { RealTimeGateway } from "../../domains/core/time-gateway/adapters/RealTimeGateway";
import { createDbRelatedSystems } from "../../domains/core/unit-of-work/adapters/createDbRelatedSystems";
import { UuidV4Generator } from "../../domains/core/uuid-generator/adapters/UuidGeneratorImplementations";
import {
  makeSuggestEstablishmentsReengagement,
  type SuggestEstablishmentsReengagementResult,
} from "../../domains/establishment/use-cases/SuggestEstablishmentsReengagement";
import { handleCRONScript } from "../handleCRONScript";

const config = AppConfig.createFromEnv();

const BATCH_SIZE = 500;
const MAX_ESTABLISHMENTS_TO_REENGAGE = 15000;

const startScript =
  async (): Promise<SuggestEstablishmentsReengagementResult> => {
    const timeGateway = new RealTimeGateway();

    const { uowPerformer } = createDbRelatedSystems(
      config,
      createMakeProductionPgPool(config),
    );

    return makeSuggestEstablishmentsReengagement({
      deps: {
        uowPerformer,
        timeGateway,
        saveNotificationsBatchAndRelatedEvent:
          makeSaveNotificationsBatchAndRelatedEvent(
            new UuidV4Generator(),
            timeGateway,
          ),
        batchSize: BATCH_SIZE,
        maxEstablishmentsToReengage: MAX_ESTABLISHMENTS_TO_REENGAGE,
      },
    }).execute();
  };

export const triggerSuggestEstablishmentReengagementEvery6Months = ({
  exitOnFinish,
}: {
  exitOnFinish: boolean;
}) =>
  handleCRONScript({
    name: "triggerSuggestEstablishmentReengagementEvery6Months",
    config,
    script: startScript,
    handleResults: ({
      numberOfEstablishmentsNotified,
      numberOfNotificationsSent,
    }) =>
      [
        `Number of establishments notified: ${numberOfEstablishmentsNotified}`,
        `Number of notifications sent: ${numberOfNotificationsSent}`,
      ].join("\n"),
    exitOnFinish,
  });
