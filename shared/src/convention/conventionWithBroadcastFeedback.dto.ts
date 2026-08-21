import type { ConventionLastBroadcastFeedbackResponse } from "../broadcast/broadcastFeedback.dto";
import type {
  PaginationQueryParams,
  WithRequiredPagination,
} from "../pagination/pagination.dto";
import type { SearchTextAlphaNumeric } from "../search/searchText.schema";
import {
  type ConventionId,
  type ConventionStatus,
  conventionStatusesAllowedForModification,
  type WithOptionalFirstnameAndLastname,
} from "./convention.dto";
import type { WithFirstnameAndLastname } from "./convention.schema";

export type ConventionWithBroadcastFeedback = {
  id: ConventionId;
  status: ConventionStatus;
  beneficiary: WithFirstnameAndLastname;
  lastBroadcastFeedback: ConventionLastBroadcastFeedbackResponse;
  agencyReferent: WithOptionalFirstnameAndLastname | null;
};

export const functionalBroadcastFeedbackErrorMessage = [
  "Aucun dossier trouvé pour les critères d'identité transmis",
  "Aucune mission locale trouvée pour le numéro de SIRET fourni",
  "L'email transmis par le partenaire ne correspond pas à l'email renseigné dans le dossier du jeune",
  "Aucun employeur trouvé pour le code renseigné",
  "Le téléphone transmis par le partenaire ne correspond pas au téléphone renseigné dans le dossier du jeune",
  "Aucun métier trouvé pour le code ROME renseigné",
  "L'email et le téléphone transmis par le partenaires ne correspondent pas aux email et téléphone renseignés dans le dossier du jeune",
  "Plusieurs dossiers trouvés pour les critères transmis",
  "Identifiant National DE non trouvé",
  "Identifiant National DE trouvé mais écart sur la date de naissance",
  "Identifiant National DE trouvé, le bénéficiaire est un candidat",
  "Identifiant National DE trouvé mais écart sur la date de naissance, le bénéficiaire est un candidat",
  "Identifiant national non trouvé",
  "Identifiant national non trouvé avec le numéro de téléphone",
  "Identifiant national trouvé avec le mail, bénéficiaire est un candidat",
  "Identifiant national trouvé avec le téléphone, bénéficiaire est un candidat ",
  "Identifiant national DE trouvé avec le mail mais écart sur la date de naissance",
  "Identifiant National DE trouvé avec le téléphone, mais écart sur la date de naissance",
  "Identifiant National trouvé avec le mail, mais écart sur la date de naissance, bénéficiaire est un candidat",
  "Identifiant National trouvé avec le téléphone, mais écart sur la date de naissance, bénéficiaire est un candidat",
  "Plusieurs Identifiant National DE trouvés",
  "Plusieurs Identifiants nationaux DE trouvés avec mail",
  "Plusieurs Identifiants nationaux DE trouvés avec téléphone",
  "Plusieurs Identifiants nationaux DE trouvés avec mail et téléphone ",
  "Le bénéficiaire FT connect est un candidat",
  "Accord non signé pour ce type de structure d'accompagnement",
] as const;

export type FunctionalBroadcastFeedbackErrorMessage =
  (typeof functionalBroadcastFeedbackErrorMessage)[number];

export const isFunctionalBroadcastFeedbackError = (
  message: string,
): message is FunctionalBroadcastFeedbackErrorMessage =>
  functionalBroadcastFeedbackErrorMessage.includes(
    message as FunctionalBroadcastFeedbackErrorMessage,
  );

export const isFranceTravailBroadcastTemporaryNetworkErrorMessage = (
  message: string,
): boolean => {
  const trimmedMessage = message.trim().toLowerCase();
  return (
    trimmedMessage === "read econnreset" || trimmedMessage.includes("timeout")
  );
};

export type BroadcastFeedbackConventionStatusCategory =
  | "pendingValidation"
  | "validated"
  | "unvalidated";

export const getBroadcastFeedbackConventionStatusCategory = (
  status: ConventionStatus,
): BroadcastFeedbackConventionStatusCategory => {
  if (conventionStatusesAllowedForModification.includes(status))
    return "pendingValidation";
  if (status === "ACCEPTED_BY_VALIDATOR") return "validated";
  return "unvalidated";
};

export type BroadcastErrorKind = "functional" | "technical";

export type ConventionsWithErroredBroadcastFeedbackFilters = {
  broadcastErrorKind?: BroadcastErrorKind;
  conventionStatus?: ConventionStatus[];
  search?: SearchTextAlphaNumeric;
};

export type FlatGetConventionsWithErroredBroadcastFeedbackParams =
  Required<PaginationQueryParams> &
    ConventionsWithErroredBroadcastFeedbackFilters;

export type GetConventionsWithErroredBroadcastFeedbackParams =
  WithRequiredPagination & {
    filters?: ConventionsWithErroredBroadcastFeedbackFilters;
  };

export const flatParamsToGetConventionsWithErroredBroadcastFeedbackParams = (
  flatParams: FlatGetConventionsWithErroredBroadcastFeedbackParams,
): GetConventionsWithErroredBroadcastFeedbackParams => {
  const {
    page,
    perPage,
    broadcastErrorKind,
    conventionStatus,
    search,
    ...rest
  } = flatParams;

  rest satisfies Record<string, never>;

  return {
    pagination: {
      page,
      perPage,
    },
    filters: {
      broadcastErrorKind,
      conventionStatus,
      search,
    },
  };
};
