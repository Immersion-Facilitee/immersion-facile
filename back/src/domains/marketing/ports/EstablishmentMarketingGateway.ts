import type {
  DepartmentCode,
  Email,
  EstablishmentSearchableByValue,
  NumberEmployeesRange,
  RomeCode,
  SiretDto,
} from "shared";

export type ConventionInfos = {
  firstConventionValidationDate?: Date; //ENT_DATE_PREM_CONVENTION
  lastConvention?: {
    endDate: Date; //ENT_DATE_FIN_DERNIERE_CONVENTION,
    validationDate: Date; //ENT_DATE_VALIDATION_DERNIERE_CONVENTION
  };
  numberOfValidatedConvention: number; //ENT_NB_CONVENTION
};

type CommonEstablishmentMarketingGatewayDto = {
  firstName: string; //PRENOM
  lastName: string; //NOM
  email: Email; //EMAIL (dans le cas d'un establishment lead --> mail du rep légal de l'entreprise / cas entreprise référencée --> mail de contact de l'entreprise)
  conventions: ConventionInfos;
  hasIcAccount: boolean; //COMPTE_IC
  numberEmployeesRange?: NumberEmployeesRange; //ENT_EFFECTIF
  siret: SiretDto;
};

type LeadEstablishmentMarketingGatewayDto =
  CommonEstablishmentMarketingGatewayDto & {
    isRegistered: false; //ENT_REFERENCE_SITE
  };

type SpecificRegistered = {
  departmentCode: DepartmentCode; //ENT_CODE_DEPARTEMENT
  isRegistered: true; //ENT_REFERENCE_SITE
  isSuperEstablishment: boolean; //ENT_SUPER_ENTREPRISE
  maxContactsPerMonth: number; //ENT_MAX_CONTACTS_PER_MONTH
  nafCode: string; //ENT_CODE_NAF
  nextAvailabilityDate?: Date; //ENT_DATE_DISPO
  numberOfDiscussionsAnswered: number; //ENT_NOMBRE_REPONSES_MER
  numberOfDiscussionsReceived: number; //ENT_NOMBRE_MER_RECUES
  searchableBy: EstablishmentMarketingSearchableBy; //ENT_TYPE_PUBLIC_ACCUEILLIS
  romes: RomeCode[]; // ENT_ROMES
};

type RegisteredEstablishmentMarketingGatewayDto =
  CommonEstablishmentMarketingGatewayDto & SpecificRegistered;

export type EstablishmentMarketingGatewayDto =
  | LeadEstablishmentMarketingGatewayDto
  | RegisteredEstablishmentMarketingGatewayDto;

export interface EstablishmentMarketingGateway {
  delete(contactEmail: Email): Promise<void>;
  save(marketing: EstablishmentMarketingGatewayDto): Promise<void>;
}

export type EstablishmentMarketingSearchableBy =
  | EstablishmentSearchableByValue
  | "all";
