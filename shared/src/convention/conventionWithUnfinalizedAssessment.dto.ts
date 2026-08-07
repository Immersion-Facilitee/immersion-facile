import type {
  PaginationQueryParams,
  WithRequiredPagination,
} from "../pagination/pagination.dto";
import type { DateString } from "../utils/date";
import type {
  ConventionAssessmentFields,
  ConventionId,
} from "./convention.dto";
import type { WithFirstnameAndLastname } from "./convention.schema";

export type ConventionWithUnfinalizedAssessment = {
  id: ConventionId;
  dateEnd: DateString;
  beneficiary: WithFirstnameAndLastname;
  assessment: ConventionAssessmentFields["assessment"];
};

export type UnfinalizedAssessmentCompletionStatus = "to-complete" | "to-sign";

export type ConventionsWithUnfinalizedAssessmentFilters = {
  assessmentCompletionStatus?: UnfinalizedAssessmentCompletionStatus;
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
  const { page, perPage, assessmentCompletionStatus, ...rest } = flatParams;

  rest satisfies Record<string, never>;

  return {
    pagination: {
      page,
      perPage,
    },
    filters: {
      assessmentCompletionStatus,
    },
  };
};
