import "./instrumentSentryCron";
import { createLogger } from "../utils/logger";
import { triggerAssessmentReminder } from "./scheduledScripts/assessmentReminder";
import { triggerContactRequestReminder3Days } from "./scheduledScripts/contactRequestReminder3Days";
import { triggerContactRequestReminder7Days } from "./scheduledScripts/contactRequestReminder7Days";
import { triggerConventionReminder } from "./scheduledScripts/conventionReminder";
import { triggerDelegationConventionReminder } from "./scheduledScripts/delegationConventionReminder";
import { triggerNotifyConventionSummaryScript } from "./scheduledScripts/notifyConventionSummary";
import { triggerSendAssessmentNeededNotifications } from "./scheduledScripts/sendAssessmentNeededNotifications";

const logger = createLogger(__filename);

const main = async () => {
  await triggerSendAssessmentNeededNotifications({ exitOnFinish: false });
  await triggerAssessmentReminder({ exitOnFinish: false });
  await triggerConventionReminder({ exitOnFinish: false });
  await triggerDelegationConventionReminder({ exitOnFinish: false });
  await triggerContactRequestReminder3Days({ exitOnFinish: false });
  await triggerContactRequestReminder7Days({ exitOnFinish: false });
  await triggerNotifyConventionSummaryScript({ exitOnFinish: false });
};

main()
  .then(() => {
    logger.info({ message: "Morning jobs executed successfully" });
    process.exit(0);
  })
  .catch((error) => {
    logger.error({ message: "Morning jobs triggered failed", error });
    process.exit(1);
  });
