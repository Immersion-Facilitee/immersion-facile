import "./instrumentSentryCron";
import { createLogger } from "../utils/logger";
import { triggerCloseInactiveAgenciesWithoutRecentConventions } from "./scheduledScripts/closeInactiveAgenciesWithoutRecentConventions";
import { triggerWarnInactiveAgenciesWithoutRecentConventions } from "./scheduledScripts/warnInactiveAgenciesWithoutRecentConventions";

const logger = createLogger(__filename);

const main = async () => {
  await triggerCloseInactiveAgenciesWithoutRecentConventions({
    exitOnFinish: false,
  });
  await triggerWarnInactiveAgenciesWithoutRecentConventions({
    exitOnFinish: false,
  });
};

main()
  .then(() => {
    logger.info({ message: "Monthly jobs executed successfully" });
    process.exit(0);
  })
  .catch((error) => {
    logger.error({ message: "Monthly jobs triggered failed", error });
    process.exit(1);
  });
