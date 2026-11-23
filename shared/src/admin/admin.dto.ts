import type { AgencyId } from "../agency/agency.dto";
import type { AgencyRole } from "../role/role.dto";

export type WithUserFilters = {
  agencyIds?: AgencyId[];
  agencyRole?: AgencyRole;
};

export type BanEstablishmentAdminForm = {
  establishmentBannishmentJustification: string;
};

export type GetUsersFilters = {
  emailContains: string;
};
