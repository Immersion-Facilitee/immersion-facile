import type { PaginationQueryParams } from "../pagination/pagination.dto";
import type { SiretDto } from "../siret/siret";
import type { DateTimeIsoString } from "../utils/date";

export const adminEstablishmentListSearchMinLength = 3;
export const adminEstablishmentListDefaultPerPage = 10;
export const adminEstablishmentListMaxPerPage = 50;

export type GetEstablishmentsForAdminParams = PaginationQueryParams & {
  search?: string;
};

export type AdminEstablishmentListItemDto = {
  siret: SiretDto;
  name: string;
  customizedName: string | null;
  city: string;
  postcode: string;
  otherLocationsCount: number;
  createdAt: DateTimeIsoString;
  updatedAt: DateTimeIsoString;
  discussionsCount: number;
  validatedConventionsCount: number;
};
