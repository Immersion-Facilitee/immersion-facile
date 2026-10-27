import type { AgencyKind } from "../agency/agency.dto";
import type { Email } from "../email/email.dto";
import type { BusinessName } from "../establishment/establishment.dto";
import type { FtConnectIdentityWithoutToken } from "../federatedIdentities/federatedIdentity.dto";
import type { PaginationQueryParams } from "../pagination/pagination.dto";
import type { AppellationAndRomeDto } from "../romeAndAppellationDtos/romeAndAppellation.dto";
import type { SiretDto } from "../siret/siret";
import type { Firstname, Lastname } from "../user/user.dto";
import type { NotEmptyArray } from "../utils";
import type { DateString } from "../utils/date";
import type { ConventionId, ConventionStatus } from "./convention.dto";
import type { ConventionDraftId } from "./conventionDraftId";

export const adminConventionListMaxResults = 100;

export const adminConventionListTextFilterMinLength = 3;

export type FlatGetConventionsForAdminParams = PaginationQueryParams & {
  statuses?: NotEmptyArray<ConventionStatus>;
  agencyNameContains?: string;
  beneficiaryEmail?: Email;
  beneficiaryNameContains?: string;
  beneficiaryRepresentativeEmail?: Email;
  establishmentTutorEmail?: Email;
  establishmentRepresentativeEmail?: Email;
  businessNameContains?: string;
  siret?: SiretDto;
  dateStartFrom?: DateString;
  dateStartTo?: DateString;
  dateValidationFrom?: DateString;
  dateValidationTo?: DateString;
};

export type AdminConventionListDto = {
  id: ConventionId;
  sourceConventionDraftId?: ConventionDraftId;
  status: ConventionStatus;
  dateSubmission: DateString;
  agency: {
    name: string;
    kind: AgencyKind;
    refersToAgencyName: string | null;
    departmentName: string | null;
  };
  businessName: BusinessName;
  siret: SiretDto;
  immersionAppellation: AppellationAndRomeDto;
  dateStart: DateString;
  dateEnd: DateString;
  beneficiary: {
    firstName: Firstname;
    lastName: Lastname;
    federatedIdentity?: FtConnectIdentityWithoutToken;
  };
};
