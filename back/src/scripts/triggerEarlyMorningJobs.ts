import "./instrumentSentryCron";
import { createLogger } from "../utils/logger";
import { triggerUpdateEstablishmentsFromSireneApiScript } from "./scheduledScripts/updateEstablishmentsFromSireneApiScript";

const logger = createLogger(__filename);

const main = async () => {
  await triggerUpdateEstablishmentsFromSireneApiScript({ exitOnFinish: false });
};

main()
  .then(() => {
    logger.info({ message: "Early morning jobs executed successfully" });
    process.exit(0);
  })
  .catch((error) => {
    logger.error({ message: "Early morning jobs triggered failed", error });
    process.exit(1);
  });
