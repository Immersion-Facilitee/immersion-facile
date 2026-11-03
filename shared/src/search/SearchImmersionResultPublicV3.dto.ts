import type { AddressDto, LocationId } from "../address/address.dto";
import type {
  BusinessName,
  BusinessNameCustomized,
} from "../establishment/establishment.dto";
import type {
  ContactMode,
  EstablishmentWebSite,
  FitForDisableWorkerOption,
} from "../formEstablishment/FormEstablishment.dto";
import type { GeoPositionDto } from "../geoPosition/geoPosition.dto";
import type { NafCode, NafSousClasseLabel } from "../naf/naf.dto";
import type { RemoteWorkMode } from "../remoteWorkMode/remoteWorkMode.dto";
import type {
  AppellationDto,
  RomeCode,
  RomeLabel,
} from "../romeAndAppellationDtos/romeAndAppellation.dto";
import type { NumberEmployeesRange, SiretDto } from "../siret/siret";
import type { DateTimeIsoString } from "../utils/date";
import type { InternalOfferDto } from "./Offer.dto";

export type SearchImmersionResultPublicV3 = {
  rome: RomeCode;
  romeLabel: RomeLabel;
  appellations: AppellationDto[];
  establishmentScore: number;
  naf: NafCode;
  nafLabel: NafSousClasseLabel;
  siret: SiretDto;
  name: BusinessName;
  customizedName?: BusinessNameCustomized;
  voluntaryToImmersion: boolean;
  fitForDisabledWorkers: FitForDisableWorkerOption | null;
  locationId: LocationId | null;
  position: GeoPositionDto;
  address: AddressDto;
  contactMode?: ContactMode;
  distance_m?: number;
  numberOfEmployeeRange?: NumberEmployeesRange;
  website?: EstablishmentWebSite;
  additionalInformation?: string;
  urlOfPartner?: string;
  updatedAt?: DateTimeIsoString;
  createdAt?: DateTimeIsoString;
  remoteWorkMode: RemoteWorkMode;
  isAvailable: boolean;
};

export const domainToSearchImmersionResultPublicV3 = ({
  rome,
  romeLabel,
  appellations,
  establishmentScore,
  naf,
  nafLabel,
  siret,
  name,
  customizedName,
  voluntaryToImmersion,
  fitForDisabledWorkers,
  locationId,
  position,
  address,
  contactMode,
  distance_m,
  numberOfEmployeeRange,
  website,
  additionalInformation,
  urlOfPartner,
  updatedAt,
  createdAt,
  remoteWorkMode,
  isAvailable,
}: InternalOfferDto): SearchImmersionResultPublicV3 => ({
  rome,
  romeLabel,
  appellations,
  establishmentScore,
  naf,
  nafLabel,
  siret,
  name,
  customizedName,
  voluntaryToImmersion,
  fitForDisabledWorkers,
  locationId,
  position,
  address,
  contactMode,
  distance_m,
  numberOfEmployeeRange,
  website,
  additionalInformation,
  urlOfPartner,
  updatedAt,
  createdAt,
  remoteWorkMode,
  isAvailable,
});
