import type { PaginationQueryParams } from "../pagination/pagination.dto";
import type { SiretDto } from "../siret/siret";
import type { NotEmptyArray } from "../utils";
import type { AgencyId, AgencyKind, AgencyStatus } from "./agency.dto";

export const adminAgencyListSearchMinLength = 3;

export type GetAgenciesForAdminParams = PaginationQueryParams & {
  search?: string;
  kinds?: NotEmptyArray<AgencyKind>;
  statuses?: NotEmptyArray<AgencyStatus>;
};

export type AdminAgencyListItemDto = {
  id: AgencyId;
  name: string;
  kind: AgencyKind;
  status: AgencyStatus;
  siret: SiretDto;
  refersToAgencyName: string | null;
};
