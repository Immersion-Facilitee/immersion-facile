import "./instrumentSentryCron";
import { triggerWarnInactiveAgenciesWithoutRecentConventions } from "./scheduledScripts/warnInactiveAgenciesWithoutRecentConventions";

triggerWarnInactiveAgenciesWithoutRecentConventions({ exitOnFinish: true });
