import { isBefore } from "date-fns";
import {
  addressDtoToString,
  type ConnectedUser,
  type ConventionDto,
  type ConventionReadDto,
  type ConventionStatus,
  type CreateConventionPresentationInitialValues,
  conventionSignatoryRoleBySignatoryKey,
  type DiscussionReadDto,
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

export const makeConventionFromDiscussion = ({
  initialConvention,
  discussion,
  connectedUser,
}: {
  initialConvention: CreateConventionPresentationInitialValues;
  discussion: DiscussionReadDto;
  connectedUser: ConnectedUser;
}): CreateConventionPresentationInitialValues => ({
  ...initialConvention,
  signatories: {
    ...initialConvention.signatories,
    beneficiary: {
      ...initialConvention.signatories.beneficiary,
      firstName: discussion.potentialBeneficiary.firstName,
      lastName: discussion.potentialBeneficiary.lastName,
      email: discussion.potentialBeneficiary.email,
      phone:
        discussion.contactMode === "EMAIL"
          ? discussion.potentialBeneficiary.phone
          : "",
    },
    establishmentRepresentative: {
      ...initialConvention.signatories.establishmentRepresentative,
      firstName: connectedUser.firstName,
      lastName: connectedUser.lastName,
      email: connectedUser.email,
    },
  },
  establishmentTutor: {
    firstName: connectedUser.firstName,
    lastName: connectedUser.lastName,
    email: connectedUser.email,
    job: "",
    phone: "",
    role: "establishment-tutor",
  },
  immersionObjective:
    discussion.contactMode === "EMAIL" &&
    discussion.potentialBeneficiary.immersionObjective
      ? discussion.potentialBeneficiary.immersionObjective
      : undefined,
  siret: discussion.siret,
  businessName: discussion.businessName,
  immersionAppellation: discussion.appellation,
  immersionAddress: addressDtoToString(discussion.address),
});
