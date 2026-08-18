import type { BadgeProps } from "@codegouvfr/react-dsfr/Badge";
import {
  type AssessmentCompletionStatusFilter,
  type ConventionAssessmentFields,
  isAssessmentToSign,
  type Role,
} from "shared";

export type AssessmentLabelsAndSeverity = {
  shortLabel: { agencyLabel: string; beneficiaryLabel: string };
  longLabel: string;
  description: string;
  severity: BadgeProps["severity"];
};

export const getAssessmentLabelsAndSeverityByStatus = ({
  isPlural,
}: {
  isPlural: boolean;
}): Record<AssessmentCompletionStatusFilter, AssessmentLabelsAndSeverity> => ({
  finalized: {
    shortLabel: {
      agencyLabel: isPlural ? "Bilans complétés" : "Bilan complété",
      beneficiaryLabel: isPlural ? "Bilans complétés" : "Bilan complété",
    },
    longLabel: isPlural
      ? "Bilans complétés et signés"
      : "Bilan complété et signé",
    description:
      "La signature n'est requise que lorsque la personne en immersion s'est présentée.",
    severity: "success",
  },
  "to-sign": {
    shortLabel: {
      agencyLabel: isPlural ? "Bilans à signer" : "Bilan à signer",
      beneficiaryLabel: isPlural ? "Bilans à signer" : "Bilan à signer",
    },
    longLabel: isPlural
      ? "Bilans à signer par la personne en immersion"
      : "Bilan à signer par la personne en immersion",
    description:
      "Le bilan n'a pas encore été signé par la personne en immersion.",
    severity: "warning",
  },
  "to-complete": {
    shortLabel: {
      agencyLabel: isPlural ? "Bilans à compléter" : "Bilan à compléter",
      beneficiaryLabel: isPlural ? "Attente bilans" : "Attente bilan",
    },
    longLabel: isPlural
      ? "Bilans à compléter par le tuteur"
      : "Bilan à compléter par le tuteur",
    description: "Le bilan n'a pas encore été complété par l'entreprise.",
    severity: "warning",
  },
});

export const getAssessmentCompletionStatus = (
  assessment: ConventionAssessmentFields["assessment"],
): AssessmentCompletionStatusFilter => {
  if (assessment == null) return "to-complete";
  if (isAssessmentToSign(assessment)) return "to-sign";
  return "finalized";
};

export const isAssessmentToBeSignedByBeneficiary = ({
  requesterRoles,
  assessment,
}: {
  requesterRoles: Role[];
  assessment: ConventionAssessmentFields["assessment"];
}): boolean =>
  requesterRoles.includes("beneficiary") &&
  getAssessmentCompletionStatus(assessment) === "to-sign";
