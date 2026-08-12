import type { AgencyId } from "../agency/agency.dto";
import type { ConventionId } from "../convention/convention.dto";
import type { Email } from "../email/email.dto";
import type { AgencyRole } from "../role/role.dto";
import type { SiretDto } from "../siret/siret";
import type { UserId } from "../user/user.dto";

export type WithAgencyIdAndUserId = {
  agencyId: AgencyId;
  userId: UserId;
};

export type UserParamsForAgency = WithAgencyIdAndUserId & {
  roles: AgencyRole[];
  isNotifiedByEmail: boolean;
  email: Email;
};

export type RejectConnectedUserRoleForAgencyParams = WithAgencyIdAndUserId & {
  justification: string;
};

export type WithUserFilters = {
  agencyIds?: AgencyId[];
  agencyRole?: AgencyRole;
};

export type ManageConventionAdminForm = {
  conventionId: ConventionId;
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
