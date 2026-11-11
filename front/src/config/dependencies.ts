import type { SchedulerLike } from "rxjs";
import { createHttpDependencies } from "src/config/createHttpDependencies";
import { createInMemoryDependencies } from "src/config/createInMemoryDependencies";
import { ENV } from "src/config/environmentVariables";
import type { AddressGateway } from "src/core-logic/ports/AddressGateway";
import type { AdminGateway } from "src/core-logic/ports/AdminGateway";
import type { AgencyGateway } from "src/core-logic/ports/AgencyGateway";
import type { AssessmentGateway } from "src/core-logic/ports/AssessmentGateway";
import type { AuthGateway } from "src/core-logic/ports/AuthGateway";
import type { ConventionGateway } from "src/core-logic/ports/ConventionGateway";
import type {
  DeviceRepository,
  LocalStoragePair,
  SessionStoragePair,
} from "src/core-logic/ports/DeviceRepository";
import type { EstablishmentGateway } from "src/core-logic/ports/EstablishmentGateway";
import type { EstablishmentLeadGateway } from "src/core-logic/ports/EstablishmentLeadGateway";
import type { FormCompletionGateway } from "src/core-logic/ports/FormCompletionGateway";
import type { JwtValidator } from "src/core-logic/ports/JwtDecoder";
import type { NafGateway } from "src/core-logic/ports/NafGateway";
import type { NavigationGateway } from "src/core-logic/ports/NavigationGateway";
import type { OtpChallengeGateway } from "src/core-logic/ports/OtpChallengeGateway";
import type { SearchGateway } from "src/core-logic/ports/SearchGateway";
import type { TechnicalGateway } from "src/core-logic/ports/TechnicalGateway";
import { createStore } from "src/core-logic/storeConfig/store";

export type Dependencies = {
  adminGateway: AdminGateway;
  assessmentGateway: AssessmentGateway;
  authGateway: AuthGateway;
  formCompletionGateway: FormCompletionGateway;
  agencyGateway: AgencyGateway;
  addressGateway: AddressGateway;
  technicalGateway: TechnicalGateway;
  establishmentGateway: EstablishmentGateway;
  establishmentLeadGateway: EstablishmentLeadGateway;
  conventionGateway: ConventionGateway;
  jwtValidator: JwtValidator;
  searchGateway: SearchGateway;
  navigationGateway: NavigationGateway;
  otpChallengeGateway: OtpChallengeGateway;
  localDeviceRepository: DeviceRepository<LocalStoragePair>;
  sessionDeviceRepository: DeviceRepository<SessionStoragePair>;
  minSearchResultsToPreventRefetch: number;
  scheduler: SchedulerLike;
  nafGateway: NafGateway;
};

const dependencies =
  ENV.gateway === "IN_MEMORY"
    ? createInMemoryDependencies()
    : createHttpDependencies();

// these are exported for usages in component, we should try to have less and less (logic should go in redux)
const {
  conventionGateway,
  searchGateway,
  localDeviceRepository,
  sessionDeviceRepository,
  technicalGateway,
  authGateway,
} = dependencies;

export const outOfReduxDependencies = {
  conventionGateway,
  searchGateway,
  localDeviceRepository,
  sessionDeviceRepository,
  technicalGateway,
  authGateway,
};

export const store = createStore({
  dependencies,
});
