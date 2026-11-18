import type { Email } from "../email/email.dto";
import type { AgencyRole } from "../role/role.dto";
import type { UserId } from "../user/user.dto";
import type { AgencyId } from "./agency.dto";

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
