import type { AlertProps } from "@codegouvfr/react-dsfr/Alert";
import Badge from "@codegouvfr/react-dsfr/Badge";
import { type AgencyStatus, agencyStatusToLabel } from "shared";

const agencyStatusToSeverity: Record<AgencyStatus, AlertProps.Severity> = {
  "from-api-PE": "success",
  active: "success",
  closed: "error",
  rejected: "error",
  needsReview: "warning",
};

export const AgencyStatusBadge = ({ status }: { status: AgencyStatus }) => (
  <Badge noIcon severity={agencyStatusToSeverity[status]} small>
    {agencyStatusToLabel[status]}
  </Badge>
);
