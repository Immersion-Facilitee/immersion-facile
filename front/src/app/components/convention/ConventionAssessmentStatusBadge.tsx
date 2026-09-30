import Badge from "@codegouvfr/react-dsfr/Badge";
import {
  type ConventionAssessmentFields,
  type ConventionDto,
  isConventionEndingInOneDayOrMore,
  isConventionValidated,
} from "shared";
import {
  getAssessmentCompletionStatus,
  getAssessmentLabelsAndSeverityByStatus,
} from "src/app/utils/assessment.utils";

export const ConventionAssessmentStatusBadge = ({
  conventionParams: { status, dateEnd, assessment },
  userKind,
}: {
  conventionParams: Pick<ConventionDto, "status" | "dateEnd"> & {
    assessment: ConventionAssessmentFields["assessment"];
  };
  userKind: "agency" | "beneficiary";
}): React.ReactNode => {
  const shouldShowBadge =
    isConventionValidated(status) && !isConventionEndingInOneDayOrMore(dateEnd);
  if (!shouldShowBadge) return <Badge small>Non Concernée</Badge>;
  return (
    <Badge
      small
      severity={
        getAssessmentLabelsAndSeverityByStatus({
          isPlural: false,
        })[getAssessmentCompletionStatus(assessment)].severity
      }
    >
      {
        getAssessmentLabelsAndSeverityByStatus({
          isPlural: false,
        })[getAssessmentCompletionStatus(assessment)].shortLabel[
          userKind === "agency" ? "agencyLabel" : "beneficiaryLabel"
        ]
      }
    </Badge>
  );
};
