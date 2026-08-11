import { toPairs } from "ramda";
import type { ArchivedConventionRequestDto } from "shared";

export const archiveReasonContentMapping: Record<
  ArchivedConventionRequestDto["reason"],
  string
> = {
  legalDispute: "Contentieux juridique",
  other: "Autre",
  rpeAdvisorAccessToBeneficiaryHistory:
    "Demande d'accès d'un conseiller du Réseau pour l'emploi (RPE) sur l'historique d'une personne",
  urssafOrInspectionControl: "Contrôle URSSAF ou inspection du travail",
};

export const archiveReasonOptions: {
  label: string;
  value: ArchivedConventionRequestDto["reason"];
}[] = toPairs(archiveReasonContentMapping).map(([key, value]) => ({
  label: value,
  value: key,
}));
