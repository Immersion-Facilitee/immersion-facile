import type {
  BusinessAddress,
  BusinessName,
} from "../establishment/establishment.dto";
import type { NafDto } from "../naf/naf.dto";
import type { Flavor } from "../typeFlavors";

// Matches strings containing exactly 14 digits with any number of interspersed whitespaces.
export const siretRegex = /^(?:\s*\d){14}\s*$/;

export const tooManySirenRequestsSiret = "42900000000429";
export const conflictErrorSiret = "40900000000409";
export const apiSirenUnexpectedError = "66600666600666";

export const tooManySirenRequestsSiretErrorMessage =
  "Too many requests on SIRENE API.";
export const siretApiUnexpectedErrorErrorMessage = "Unexpected Error";
export const siretApiMissingEstablishmentMessage =
  "Missing establishment on SIRENE API.";

export const siretInfoErrors = [
  "L'entreprise avec ce siret est bannie",
  tooManySirenRequestsSiretErrorMessage,
  siretApiMissingEstablishmentMessage,
  "Erreur sur le siret fourni",
] as const;

export type SiretDto = Flavor<string, "SiretDto">;
export type WithSiretDto = { siret: SiretDto };
export type SiretEstablishmentDto = {
  siret: SiretDto;
  businessName: BusinessName;
  businessAddress: BusinessAddress;
  // true if the office is currently open for business.
  isOpen: boolean;
  isAlreadySaved: boolean;
  nafDto?: NafDto;
  numberEmployeesRange: NumberEmployeesRange;
};

export type NumberEmployeesRange = (typeof numberEmployeesRanges)[number];

export const numberEmployeesRanges = [
  "",
  "0",
  "0-0",
  "1-2",
  "3-5",
  "6-9",
  "10-19",
  "20-49",
  "50-99",
  "100-199",
  "200-249",
  "250-499",
  "500-999",
  "1000-1999",
  "2000-4999",
  "5000-9999",
  "+10000",
] as const;

export type GetSiretInfoError = (typeof siretInfoErrors)[number];
export type GetSiretEstablishmentDtoResponse =
  | SiretEstablishmentDto
  | GetSiretInfoError;
export type GetSiretRequestDto = {
  siret: SiretDto;
  includeClosedEstablishments?: boolean;
};

export const makeSiretDescriptionLink = (siret: SiretDto) =>
  `https://annuaire-entreprises.data.gouv.fr/etablissement/${siret}`;

export const toFormatedTextSiret = (siret: SiretDto): string =>
  `${siret.substring(0, 3)} ${siret.substring(3, 6)} ${siret.substring(
    6,
    9,
  )} ${siret.substring(9, siret.length)}`;
