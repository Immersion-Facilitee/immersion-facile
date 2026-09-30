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

const assessmentShortLabelKeyByUserKind = {
  agency: "agencyLabel",
  beneficiary: "beneficiaryLabel",
  establishment: "establishmentLabel",
} as const;

export const ConventionAssessmentStatusBadge = ({
  conventionParams: { status, dateEnd, assessment },
  userKind,
}: {
  conventionParams: Pick<ConventionDto, "status" | "dateEnd"> & {
    assessment: ConventionAssessmentFields["assessment"];
  };
  userKind: "agency" | "beneficiary" | "establishment";
}): React.ReactNode => {
  const shouldShowBadge =
    isConventionValidated(status) && !isConventionEndingInOneDayOrMore(dateEnd);
  if (!shouldShowBadge) return <Badge small>Non Concernée</Badge>;

  const assessmentLabel = getAssessmentLabelsAndSeverityByStatus({
    isPlural: false,
  })[getAssessmentCompletionStatus(assessment)];

  return (
    <Badge small severity={assessmentLabel.severity}>
      {assessmentLabel.shortLabel[assessmentShortLabelKeyByUserKind[userKind]]}
    </Badge>
  );
};
