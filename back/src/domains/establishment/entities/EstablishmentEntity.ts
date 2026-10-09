import type {
  AbsoluteUrl,
  AddressAndPosition,
  ContactMode,
  DateTimeIsoString,
  EstablishmentSearchableBy,
  FitForDisableWorkerOption,
  FormEstablishmentSource,
  Location,
  NafDto,
  NumberEmployeesRange,
  SiretDto,
  WithAcquisition,
  WithBannedEstablishmentInformations,
} from "shared";

type ApiSource = "api_labonneboite";
type SourceProvider = FormEstablishmentSource | ApiSource;

export type EstablishmentEntity = {
  additionalInformation?: string;
  createdAt: Date;
  customizedName?: string;
  fitForDisabledWorkers: FitForDisableWorkerOption;
  isOpen: boolean;
  isMaxDiscussionsForPeriodReached: boolean;
  lastInseeCheckDate?: Date;
  locations: Location[];
  maxContactsPerMonth: number;
  nafDto: NafDto;
  name: string;
  nextAvailabilityDate?: DateTimeIsoString;
  numberEmployeesRange: NumberEmployeesRange;
  searchableBy: EstablishmentSearchableBy;
  siret: SiretDto;
  sourceProvider: SourceProvider;
  updatedAt: Date;
  voluntaryToImmersion: boolean;
  website?: AbsoluteUrl | "";
  score: number;
  contactMode: ContactMode;
  potentialBeneficiaryWelcomeAddress?: AddressAndPosition;
} & WithAcquisition &
  WithBannedEstablishmentInformations;
