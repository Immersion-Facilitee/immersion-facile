import type { SiretDto } from "shared";
import { AppConfig } from "../../config/bootstrap/appConfig";
import { createMakeProductionPgPool } from "../../config/pg/pgPool";
import { makeSaveNotificationAndRelatedEvent } from "../../domains/core/notifications/helpers/Notification";
import { RealTimeGateway } from "../../domains/core/time-gateway/adapters/RealTimeGateway";
import { createDbRelatedSystems } from "../../domains/core/unit-of-work/adapters/createDbRelatedSystems";
import { UuidV4Generator } from "../../domains/core/uuid-generator/adapters/UuidGeneratorImplementations";
import { makeSuggestEstablishmentReengagement } from "../../domains/establishment/use-cases/SuggestEstablishmentReengagement";
import { makeSuggestEstablishmentReengagementsScript } from "../../domains/establishment/use-cases/SuggestEstablishmentReengagementsScript";
import { handleCRONScript } from "../handleCRONScript";

const config = AppConfig.createFromEnv();

type Report = {
  numberOfEstablishmentsToContact: number;
  errors?: Record<SiretDto, any>;
};

const BATCH_SIZE = 5000;
const MAX_ESTABLISHMENTS_TO_REENGAGE = 15000;

const startScript = async (): Promise<Report> => {
  const timeGateway = new RealTimeGateway();

  const { uowPerformer } = createDbRelatedSystems(
    config,
    createMakeProductionPgPool(config),
  );

  return makeSuggestEstablishmentReengagementsScript({
    deps: {
      suggestEstablishmentReengagement: makeSuggestEstablishmentReengagement({
        uowPerformer,
        deps: {
          saveNotificationAndRelatedEvent: makeSaveNotificationAndRelatedEvent(
            new UuidV4Generator(),
            timeGateway,
          ),
        },
      }),
      timeGateway,
      uowPerformer,
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
    handleResults: ({ numberOfEstablishmentsToContact, errors = {} }) => {
      const nSiretFailed = Object.keys(errors).length;
      const nSiretSuccess = numberOfEstablishmentsToContact - nSiretFailed;
      const errorsAsString = Object.keys(errors)
        .map((siret) => `For siret ${siret} : ${errors[siret]} `)
        .join("\n");

      return [
        `Successfully sent to ${nSiretSuccess} sirets`,
        `Number of failures: ${nSiretFailed}`,
        ...(nSiretFailed > 0 ? [`Errors were: ${errorsAsString}`] : []),
      ].join("\n");
    },
    exitOnFinish,
  });
