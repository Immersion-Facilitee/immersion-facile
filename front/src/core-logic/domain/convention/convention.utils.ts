import { isBefore } from "date-fns";
import {
  type ConventionDto,
  type ConventionReadDto,
  type ConventionStatus,
  conventionSignatoryRoleBySignatoryKey,
  isSignatory,
  type Role,
  type Signatory,
} from "shared";

export const isConventionAlreadyStarted = (convention: ConventionReadDto) =>
  isBefore(new Date(convention.dateStart), new Date());

export const canAssessmentBeFilled = (convention: ConventionReadDto) =>
  convention.status === "ACCEPTED_BY_VALIDATOR" &&
  isConventionAlreadyStarted(convention) &&
  !convention.assessment;

const allowedToSignStatuses: ConventionStatus[] = [
  "READY_TO_SIGN",
  "PARTIALLY_SIGNED",
];

export const getSignatoryToSign = ({
  requesterRoles,
  convention,
}: {
  requesterRoles: Role[];
  convention: ConventionDto;
}): Signatory | undefined => {
  if (!allowedToSignStatuses.includes(convention.status)) return undefined;

  const signatoryRole = requesterRoles.find(isSignatory);
  if (!signatoryRole) return undefined;

  const signatoryKey = conventionSignatoryRoleBySignatoryKey[signatoryRole];
  const signatory = convention.signatories[signatoryKey];
  if (!signatory || signatory.signedAt) return undefined;

  return signatory;
};
