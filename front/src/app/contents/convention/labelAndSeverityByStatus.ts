import type { FrCxArg } from "@codegouvfr/react-dsfr";
import type { ConventionStatus } from "shared";

export const labelAndSeverityByStatus: Record<
  ConventionStatus,
  {
    label: { agency: string; beneficiary: string; establishment: string };
    color: FrCxArg;
  }
> = {
  ACCEPTED_BY_COUNSELLOR: {
    label: {
      beneficiary: "📄 En cours d'examen",
      agency: "📄 Demande éligible",
      establishment: "📄 En cours d'examen",
    },
    color: "fr-badge--purple-glycine",
  },
  ACCEPTED_BY_VALIDATOR: {
    label: {
      beneficiary: "✅ Demande validée",
      agency: "✅ Demande validée",
      establishment: "✅ Demande validée",
    },
    color: "fr-badge--green-emeraude",
  },
  CANCELLED: {
    label: {
      beneficiary: "❌ Convention annulée",
      agency: "❌ Convention annulée",
      establishment: "❌ Convention annulée",
    },
    color: "fr-badge--error",
  },
  IN_REVIEW: {
    label: {
      beneficiary: "📄 En cours d'examen",
      agency: "📄 Demande à étudier",
      establishment: "📄 En cours d'examen",
    },
    color: "fr-badge--purple-glycine",
  },
  PARTIALLY_SIGNED: {
    label: {
      beneficiary: "✍ Partiellement signée",
      agency: "✍ Partiellement signée",
      establishment: "✍ En cours de signature",
    },
    color: "fr-badge--purple-glycine",
  },
  READY_TO_SIGN: {
    label: {
      beneficiary: "✍ En cours de signature",
      agency: "✍ En cours de signature",
      establishment: "✍ En cours de signature",
    },
    color: "fr-badge--purple-glycine",
  },
  REJECTED: {
    label: {
      beneficiary: "❌ Demande rejetée",
      agency: "❌ Demande rejetée",
      establishment: "❌ Demande rejetée",
    },
    color: "fr-badge--error",
  },
  DEPRECATED: {
    label: {
      beneficiary: "❌ Demande obsolète",
      agency: "❌ Demande obsolète",
      establishment: "❌ Demande obsolète",
    },
    color: "fr-badge--error",
  },
};
