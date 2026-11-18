import type { AgencyId } from "../agency/agency.dto";
import type { AgencyRole } from "../role/role.dto";
import type { SiretDto } from "../siret/siret";

export type WithUserFilters = {
  agencyIds?: AgencyId[];
  agencyRole?: AgencyRole;
};

export type ManageEstablishmentAdminForm = {
  siret: SiretDto;
};

export type BanEstablishmentAdminForm = {
  establishmentBannishmentJustification: string;
};

export type GetUsersFilters = {
  emailContains: string;
};
