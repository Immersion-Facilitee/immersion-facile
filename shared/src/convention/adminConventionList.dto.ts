import type { AgencyKind } from "../agency/agency.dto";
import type { PaginationQueryParams } from "../pagination/pagination.dto";
import type { NotEmptyArray } from "../utils";
import type { DateString } from "../utils/date";
import type { AgencyUserConventionListDto } from "./agencyUserConventionList.dto";
import type {
  AssessmentCompletionStatusFilter,
  ConventionStatus,
} from "./convention.dto";

export const adminConventionListMaxResults = 100;

export const adminConventionListTextFilterMinLength = 3;

export type FlatGetConventionsForAdminParams = PaginationQueryParams & {
  search?: string;
  statuses?: NotEmptyArray<ConventionStatus>;
  assessmentCompletionStatus?: NotEmptyArray<AssessmentCompletionStatusFilter>;
  agencyNameContains?: string;
  dateStartFrom?: DateString;
  dateStartTo?: DateString;
  dateValidationFrom?: DateString;
  dateValidationTo?: DateString;
};

export type AdminConventionListDto = AgencyUserConventionListDto & {
  agencyKind: AgencyKind;
  agencyDepartmentName: string | null;
  agencyRefersToAgencyName: string | null;
};
