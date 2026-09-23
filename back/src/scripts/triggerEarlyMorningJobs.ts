import "./instrumentSentryCron";
import { createLogger } from "../utils/logger";
import { triggerUpdateEstablishmentsFromSireneApiScript } from "./scheduledScripts/updateEstablishmentsFromSireneApiScript";
import { triggerWarnInactiveAgenciesWithoutRecentConventions } from "./scheduledScripts/warnInactiveAgenciesWithoutRecentConventions";

const logger = createLogger(__filename);

const main = async () => {
  await triggerUpdateEstablishmentsFromSireneApiScript({ exitOnFinish: false });
  await triggerWarnInactiveAgenciesWithoutRecentConventions({
    exitOnFinish: false,
  });
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
