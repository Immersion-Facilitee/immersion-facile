import { type AgencyKind, agencyKindToLabelIncludingIFAndPrepa } from "shared";

export const agencyKindToShortLabel: Record<AgencyKind, string> = {
  ...agencyKindToLabelIncludingIFAndPrepa,
  "france-travail": "France Travail",
};
