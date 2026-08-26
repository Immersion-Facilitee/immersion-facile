import type { AgencyId } from "../agency/agency.dto";
import type {
  PaginationQueryParams,
  WithRequiredPagination,
} from "../pagination/pagination.dto";
import type { DateString } from "../utils/date";
import type {
  ConventionAssessmentFields,
  ConventionId,
  WithOptionalFirstnameAndLastname,
} from "./convention.dto";
import type { WithFirstnameAndLastname } from "./convention.schema";

export type ConventionWithUnfinalizedAssessment = {
  id: ConventionId;
  dateEnd: DateString;
  beneficiary: WithFirstnameAndLastname;
  assessment: ConventionAssessmentFields["assessment"];
  agencyId: AgencyId;
  agencyReferent: WithOptionalFirstnameAndLastname | null;
};

export type ConventionWithUnfinalizedAssessmentReadDto =
  ConventionWithUnfinalizedAssessment & {
    agencyName: string;
  };

export const unfinalizedAssessmentCompletionStatuses = [
  "to-complete",
  "to-sign",
] as const;
export type UnfinalizedAssessmentCompletionStatus =
  (typeof unfinalizedAssessmentCompletionStatuses)[number];

export type ConventionsWithUnfinalizedAssessmentFilters = {
  assessmentCompletionStatus?: UnfinalizedAssessmentCompletionStatus;
  search?: string;
};

export type FlatGetConventionsWithUnfinalizedAssessmentParams =
  Required<PaginationQueryParams> & ConventionsWithUnfinalizedAssessmentFilters;

export type GetConventionsWithUnfinalizedAssessmentParams =
  WithRequiredPagination & {
    filters?: ConventionsWithUnfinalizedAssessmentFilters;
  };

export const flatParamsToGetConventionsWithUnfinalizedAssessmentParams = (
  flatParams: FlatGetConventionsWithUnfinalizedAssessmentParams,
): GetConventionsWithUnfinalizedAssessmentParams => {
  const { page, perPage, assessmentCompletionStatus, search, ...rest } =
    flatParams;

  rest satisfies Record<string, never>;

  return {
    pagination: {
      page,
      perPage,
    },
    filters: {
      assessmentCompletionStatus,
      search,
    },
  };
};
