import type { AgencyId, AgencyKind } from "../agency/agency.dto";
import type { PaginationQueryParams } from "../pagination/pagination.dto";
import type { NotEmptyArray } from "../utils";
import type { DateString } from "../utils/date";
import type { AgencyUserConventionListDto } from "./agencyUserConventionList.dto";
import type {
  AssessmentCompletionStatusFilter,
  ConventionStatus,
  GetPaginatedConventionsSortBy,
} from "./convention.dto";

export const adminConventionListMaxResults = 100;

export const adminConventionListPerPage = 10;

export const adminConventionListTextFilterMinLength = 3;

export type AdminConventionListSortBy = Extract<
  GetPaginatedConventionsSortBy,
  "dateSubmission" | "dateStart"
>;

export type FlatGetConventionsForAdminParams = PaginationQueryParams & {
  sortBy?: AdminConventionListSortBy;
  search?: string;
  agencyIds?: NotEmptyArray<AgencyId>;
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
