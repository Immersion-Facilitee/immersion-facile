import type { WithAcquisition } from "../acquisition.dto";
import type { DepartmentCode, LocationId } from "../address/address.dto";
import type {
  EstablishmentSearchableByValue,
  FitForDisableWorkerOption,
} from "../formEstablishment/FormEstablishment.dto";
import type { NafCode } from "../naf/naf.dto";
import type {
  PaginationQueryParams,
  SortDirection,
} from "../pagination/pagination.dto";
import type { WithOptionalRemoteWorkModes } from "../remoteWorkMode/remoteWorkMode.dto";
import type { AppellationCode } from "../romeAndAppellationDtos/romeAndAppellation.dto";
import type { SiretDto } from "../siret/siret";

type GetOffersFlatParamsPublicV3Common = WithAcquisition & {
  place?: string;
  fitForDisabledWorkers?: FitForDisableWorkerOption[];
  locationIds?: LocationId[];
  nafCodes?: NafCode[];
  searchableBy?: EstablishmentSearchableByValue;
  sirets?: SiretDto[];
  departmentCodes?: DepartmentCode[];
  showOnlyAvailableOffers?: boolean;
  appellationCodes?: AppellationCode[];
} & WithOptionalRemoteWorkModes;

type GetOffersFlatParamsPublicV3WithDistance = {
  sortBy: "distance";
  sortOrder: SortDirection;
  latitude: number;
  longitude: number;
  distanceKm: number;
};

type GetOffersFlatParamsPublicV3WithDateOrScore = {
  sortBy: "date" | "score";
  sortOrder: SortDirection;
  latitude?: number;
  longitude?: number;
  distanceKm?: number;
};

export type GetOffersFlatParamsPublicV3 = PaginationQueryParams &
  GetOffersFlatParamsPublicV3Common &
  (
    | GetOffersFlatParamsPublicV3WithDistance
    | GetOffersFlatParamsPublicV3WithDateOrScore
  );
