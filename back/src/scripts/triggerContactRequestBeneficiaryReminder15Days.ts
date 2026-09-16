import "./instrumentSentryCron";
import { triggerContactRequestBeneficiaryReminder15Days } from "./scheduledScripts/contactRequestBeneficiaryReminder15Days";

triggerContactRequestBeneficiaryReminder15Days({ exitOnFinish: true });
