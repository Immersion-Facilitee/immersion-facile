import type { AbsoluteUrl } from "../AbsoluteUrl";
import type {
  DelegationAgencyKind,
  DelegationConventionReminderKind,
} from "../agency/agency.dto";
import type { ArchivedConventionRequestId } from "../archivedConventionRequest/archivedConventionRequest.dto";
import type {
  AssessmentDtoCompleted,
  AssessmentDtoPartiallyCompleted,
} from "../assessment/assessment.dto";
import type {
  ConventionId,
  ImmersionObjective,
  InternshipKind,
  Renewed,
} from "../convention/convention.dto";
import type {
  ContactLevelOfEducation,
  DiscussionExchangeForbiddenParams,
  DiscussionKind,
} from "../discussion/discussion.dto";
import type { EstablishmentUserRightStatus } from "../formEstablishment/FormEstablishment.dto";
import type { AgencyRole, EstablishmentRole } from "../role/role.dto";
import type { AppellationLabel } from "../romeAndAppellationDtos/romeAndAppellation.dto";
import type { SiretDto } from "../siret/siret";
import type { DateString } from "../utils/date";
import type { Email } from "./email.dto";

export type UserParamsForMail = {
  agencyName: string;
  isNotifiedByEmail: boolean;
  roles: AgencyRole[];
  firstName: string;
  lastName: string;
  email: Email;
};

export type MagicLinkRenewalParams = {
  conventionId?: ConventionId;
  internshipKind?: InternshipKind;
  magicLink: string;
};

export type EmailParamsByEmailType = {
  AGENCY_ADMIN_NEW_USERS_TO_REVIEW_NOTIFICATION: {
    firstName: string;
    lastName: string;
    immersionBaseUrl: AbsoluteUrl;
    agencies: {
      agencyName: string;
      numberOfUsersToReview: number;
    }[];
  };
  AGENCY_DELEGATION_CONTACT_INFORMATION: {
    delegationProviderMail: string;
  };
  AGENCY_DELEGATION_CONVENTION_EXPIRED: {
    agencyName: string;
    delegationAgencyName: string;
    delegationAgencyKind: DelegationAgencyKind | null;
  };
  AGENCY_DELEGATION_CONVENTION_EXPIRING_SOON: {
    agencyName: string;
    delegationEndDate: DateString;
    delegationAgencyName: string;
    reminderKind: Extract<
      DelegationConventionReminderKind,
      "threeMonthsBefore" | "oneMonthBefore"
    >;
  };
  AGENCY_FIRST_REMINDER: {
    manageConventionLink: string;
    agencyName: string;
    agencyReferentName: string | undefined;
    beneficiaryFirstName: string;
    beneficiaryLastName: string;
    conventionId: ConventionId;
    businessName: string;
    dateStart: string;
    dateEnd: string;
  };
  AGENCY_HAS_BEEN_PUT_ON_HOLD: { agencyName: string };
  AGENCY_LAST_REMINDER: {
    manageConventionLink: string;
    agencyReferentName: string | undefined;
    beneficiaryFirstName: string;
    beneficiaryLastName: string;
    businessName: string;
    conventionId: ConventionId;
  };
  AGENCY_OF_TYPE_OTHER_ADDED: {
    agencyName: string;
    agencyLogoUrl: AbsoluteUrl | undefined;
  };
  AGENCY_REGISTRATION_REQUEST_CONFIRMATION: {
    immersionBaseUrl: AbsoluteUrl;
    agencies: {
      agencyName: string;
      adminEmails: Email[];
    }[];
  };
  ARCHIVED_CONVENTION_REQUEST_RECEIVED: {
    archivedConventionRequestId: ArchivedConventionRequestId;
  };
  AGENCY_WAS_ACTIVATED: {
    agencyName: string;
    agencyLogoUrl: AbsoluteUrl | undefined;
    agencyReferdToName: string | undefined;
    agencyDashboardUrl: AbsoluteUrl;
    refersToOtherAgency: boolean;
  };
  AGENCY_WAS_REJECTED: {
    agencyName: string;
    statusJustification: string;
  };
  AGENCY_CLOSED_FOR_INACTIVITY: {
    agencyName: string;
    numberOfMonthsWithoutConvention: number;
  };
  AGENCY_WITH_REFERS_TO_ACTIVATED: {
    nameOfAgencyRefering: string;
    refersToAgencyName: string;
    agencyLogoUrl: AbsoluteUrl | undefined;
    validatorEmails: string[];
  };
  ASSESSMENT_AGENCY_NOTIFICATION: {
    agencyLogoUrl: AbsoluteUrl | undefined;
    agencyReferentName: string | undefined;
    manageConventionLink: string;
    beneficiaryFirstName: string;
    beneficiaryLastName: string;
    tutorEmail: string;
    businessName: string;
    conventionId: ConventionId;
    internshipKind: InternshipKind;
  };
  ASSESSMENT_BENEFICIARY_NOTIFICATION: {
    conventionId: ConventionId;
    beneficiaryFirstName: string;
    beneficiaryLastName: string;
    businessName: string;
    internshipKind: InternshipKind;
    establishmentTutorEmail: Email;
  };
  ASSESSMENT_NEEDS_SIGNATURE_BENEFICIARY_NOTIFICATION: {
    beneficiaryFirstName: string;
    beneficiaryLastName: string;
    businessName: string;
    internshipKind: InternshipKind;
    assessmentSignatureLink: string;
    conventionId: ConventionId;
  };
  ASSESSMENT_CREATED_BENEFICIARY_NOTIFICATION: {
    internshipKind: InternshipKind;
    conventionId: ConventionId;
    beneficiaryFirstName: string;
    beneficiaryLastName: string;
    assessmentDocumentLink: string;
  };
  ASSESSMENT_CREATED_ESTABLISHMENT_NOTIFICATION: {
    recipientFullName: string;
    beneficiaryFullName: string;
    businessName: string;
    linkToAssessment: AbsoluteUrl;
    internshipKind: InternshipKind;
  };
  ASSESSMENT_CREATED_WITH_STATUS_COMPLETED_AGENCY_NOTIFICATION: {
    agencyReferentName: string | undefined;
    immersionObjective: ImmersionObjective | undefined;
    conventionId: ConventionId;
    beneficiaryFirstName: string;
    beneficiaryLastName: string;
    businessName: string;
    conventionDateEnd: DateString;
    internshipKind: InternshipKind;
    assessment: AssessmentDtoCompleted | AssessmentDtoPartiallyCompleted;
    immersionAppellationLabel: string;
    numberOfHoursMade: string;
    manageConventionLink: string;
  };
  ASSESSMENT_CREATED_WITH_STATUS_DID_NOT_SHOW_AGENCY_NOTIFICATION: {
    agencyReferentName: string | undefined;
    immersionObjective: ImmersionObjective | undefined;
    conventionId: ConventionId;
    beneficiaryFirstName: string;
    beneficiaryLastName: string;
    businessName: string;
    internshipKind: InternshipKind;
    immersionAppellationLabel: string;
  };
  ASSESSMENT_ESTABLISHMENT_NOTIFICATION: {
    agencyLogoUrl: AbsoluteUrl | undefined;
    assessmentCreationLink: string;
    beneficiaryFirstName: string;
    beneficiaryLastName: string;
    conventionId: ConventionId;
    establishmentTutorName: string;
    internshipKind: InternshipKind;
  };
  ASSESSMENT_ESTABLISHMENT_REMINDER: {
    assessmentCreationLink: string;
    beneficiaryFirstName: string;
    beneficiaryLastName: string;
    establishmentTutorFirstName: string;
    establishmentTutorLastName: string;
    conventionId: ConventionId;
    internshipKind: InternshipKind;
  };
  ASSESSMENT_DELETED_ESTABLISHMENT_NOTIFICATION: {
    assessmentCreationLink: string;
    beneficiaryName: string;
    establishmentTutorName: string;
    justification: string;
    internshipKind: InternshipKind;
  };
  ASSESSMENT_DELETED_BENEFICIARY_NOTIFICATION: {
    beneficiaryName: string;
    conventionId: ConventionId;
    internshipKind: InternshipKind;
  };
  CANCELLED_CONVENTION_NOTIFICATION: {
    agencyName: string;
    agencyLogoUrl: AbsoluteUrl | undefined;
    beneficiaryFirstName: string;
    beneficiaryLastName: string;
    businessName: string;
    conventionId: ConventionId;
    immersionProfession: string;
    internshipKind: InternshipKind;
    signature: string;
    dateEnd: string;
    dateStart: string;
    justification: string;
  };
  CONTACT_BY_EMAIL_CANDIDATE_CONFIRMATION: {
    kind: DiscussionKind;
    beneficiaryFirstName: string;
    beneficiaryLastName: string;
    businessName: string;
    beneficiaryDashboardUrl: AbsoluteUrl;
  };
  CONTACT_BY_EMAIL_REQUEST: {
    businessName: string;
    businessAddress: string;
    appellationLabel: string;
    immersionObjective: ImmersionObjective | undefined;
    replyToEmail: Email;
    potentialBeneficiaryFirstName: string;
    potentialBeneficiaryLastName: string;
    potentialBeneficiaryPhone: string;
    potentialBeneficiaryDatePreferences: string;
    discussionUrl: AbsoluteUrl;
  } & (
    | {
        kind: "IF";
        potentialBeneficiaryExperienceAdditionalInformation?: string;
        potentialBeneficiaryResumeLink?: string;
      }
    | {
        kind: "1_ELEVE_1_STAGE";
        levelOfEducation: ContactLevelOfEducation;
      }
  );
  CONTACT_BY_EMAIL_REQUEST_LEGACY: {
    businessName: string;
    businessAddress: string;
    appellationLabel: string;
    potentialBeneficiaryFirstName: string;
    potentialBeneficiaryLastName: string;
    potentialBeneficiaryPhone: string;
    immersionObjective: ImmersionObjective | undefined;
    potentialBeneficiaryResumeLink?: string;
    message: string;
    replyToEmail: Email;
  };
  CONTACT_BY_PHONE_INSTRUCTIONS: {
    businessName: string;
    contactFirstName?: string;
    contactLastName?: string;
    contactPhone: string;
    kind: DiscussionKind;
    potentialBeneficiaryFirstName: string;
    potentialBeneficiaryLastName: string;
  };
  CONTACT_IN_PERSON_INSTRUCTIONS: {
    businessName: string;
    contactFirstName?: string;
    contactLastName?: string;
    welcomeAddress: string;
    kind: DiscussionKind;
    potentialBeneficiaryFirstName: string;
    potentialBeneficiaryLastName: string;
  };
  CONVENTION_TRANSFERRED_AGENCY_NOTIFICATION: {
    previousAgencyName: string;
    justification: string;
    manageConventionLink: string;
    conventionId: ConventionId;
    beneficiaryFirstName: string;
    beneficiaryLastName: string;
    beneficiaryEmail: string;
    beneficiaryPhone: string;
    internshipKind: InternshipKind;
  };
  CONVENTION_TRANSFERRED_SIGNATORY_NOTIFICATION: {
    internshipKind: InternshipKind;
    immersionProfession: string;
    previousAgencyName: string;
    newAgencyName: string;
    agencyAddress: string;
    businessName: string;
    justification: string;
    manageConventionLink: AbsoluteUrl;
    conventionId: ConventionId;
  };
  DEPRECATED_CONVENTION_NOTIFICATION: {
    beneficiaryFirstName: string;
    beneficiaryLastName: string;
    businessName: string;
    conventionId: ConventionId;
    deprecationReason: string;
    dateEnd: string;
    dateStart: string;
    immersionProfession: string;
    internshipKind: InternshipKind;
  };
  DISCUSSION_BENEFICIARY_FOLLOW_UP: {
    beneficiaryFirstName: string;
    beneficiaryLastName: string;
    businessName: string;
    contactFirstName: string;
    contactLastName: string;
    contactJob: string | undefined;
    contactPhone: string;
  };
  DISCUSSION_DEPRECATED_NOTIFICATION_BENEFICIARY: {
    beneficiaryFirstName: string;
    beneficiaryLastName: string;
    businessName: string;
    discussionCreatedAt: string;
    searchPageUrl: string;
  };
  DISCUSSION_DEPRECATED_NOTIFICATION_ESTABLISHMENT: {
    beneficiaryFirstName: string;
    beneficiaryLastName: string;
    businessName: string;
    discussionCreatedAt: string;
    establishmentDashboardUrl: AbsoluteUrl;
  };
  DISCUSSION_EXCHANGE: {
    subject: string;
    htmlContent: string;
  };
  DISCUSSION_EXCHANGE_FORBIDDEN: DiscussionExchangeForbiddenParams;
  ESTABLISHMENT_CONTACT_REQUEST_REMINDER: {
    beneficiaryFirstName: string;
    beneficiaryLastName: string;
    beneficiaryReplyToEmail: string;
    appellationLabel: AppellationLabel;
    domain: string;
    mode: "3days" | "7days";
  };
  ESTABLISHMENT_BANNED_NOTIFICATION_TO_ESTABLISHMENT_USERS: {
    businessName: string;
    siret: SiretDto;
  };
  ESTABLISHMENT_BANNED_NOTIFICATION_TO_BENEFICIARY: {
    beneficiaryFirstName: string;
    beneficiaryLastName: string;
    businessName: string;
    immersionBaseUrl: AbsoluteUrl;
  };
  ESTABLISHMENT_BANNED_NOTIFICATION_TO_VALIDATOR_AND_PREVALIDATOR: {
    conventionId: ConventionId;
    beneficiaryFirstName: string;
    beneficiaryLastName: string;
    businessName: string;
    immersionBaseUrl: AbsoluteUrl;
  };
  ESTABLISHMENT_DELETED: {
    businessName: string;
    siret: SiretDto;
    businessAddresses: string[];
  };
  ESTABLISHMENT_LEAD_REMINDER: {
    businessName: string;
    registerEstablishmentShortLink: string;
    unsubscribeToEmailShortLink: string;
  };
  ESTABLISHMENT_USER_RIGHTS_ADDED: {
    businessName: string;
    firstName: string;
    lastName: string;
    triggeredByUserFirstName: string;
    triggeredByUserLastName: string;
    role: EstablishmentRole;
    immersionBaseUrl: AbsoluteUrl;
  };
  ESTABLISHMENT_USER_RIGHTS_UPDATED: {
    businessName: string;
    firstName: string;
    lastName: string;
    triggeredByUserFirstName: string;
    triggeredByUserLastName: string;
    updatedRole: EstablishmentRole;
  };
  ESTABLISHMENT_USER_RIGHTS_STATUS_UPDATED: {
    businessName: string;
    firstName: string;
    lastName: string;
    triggeredByUserFirstName: string;
    triggeredByUserLastName: string;
    updatedStatus:
      | Extract<EstablishmentUserRightStatus, "ACCEPTED">
      | "REJECTED";
    immersionBaseUrl: AbsoluteUrl;
  };
  FULL_PREVIEW_EMAIL: {
    agencyLogoUrl: AbsoluteUrl | undefined;
    beneficiaryName: string;
    conventionId: ConventionId;
    conventionStatusLink: string;
    internshipKind: InternshipKind;
  };
  IC_USER_REGISTRATION_TO_AGENCY_REJECTED: {
    agencyName: string;
    justification: string;
  };
  IC_USER_RIGHTS_HAS_CHANGED: UserParamsForMail;
  LOGIN_BY_EMAIL_REQUESTED: {
    validMinutes: number;
    fullname?: string;
    loginLink: AbsoluteUrl;
  };
  MAGIC_LINK_RENEWAL: MagicLinkRenewalParams;
  NEW_CONVENTION_AGENCY_NOTIFICATION: {
    agencyLogoUrl: AbsoluteUrl | undefined;
    agencyName: string;
    agencyReferentName: string | undefined;
    businessName: string;
    conventionId: ConventionId;
    dateEnd: string;
    dateStart: string;
    internshipKind: InternshipKind;
    firstName: string;
    lastName: string;
    manageConventionLink: AbsoluteUrl;
    warning?: string;
  };
  NEW_CONVENTION_CONFIRMATION_REQUEST_SIGNATURE: {
    agencyLogoUrl: AbsoluteUrl | undefined;
    beneficiaryName: string;
    beneficiaryRepresentativeName?: string;
    beneficiaryCurrentEmployerName?: string;
    businessName: string;
    conventionId: ConventionId;
    establishmentRepresentativeName: string;
    establishmentTutorName: string;
    internshipKind: InternshipKind;
    conventionSignatureLink: AbsoluteUrl;
    signatoryName: string;
    renewed?: Renewed;
  };
  NEW_CONVENTION_CONFIRMATION_REQUEST_SIGNATURE_AFTER_MODIFICATION: {
    agencyLogoUrl: AbsoluteUrl | undefined;
    beneficiaryFirstName: string;
    beneficiaryLastName: string;
    businessName: string;
    conventionId: ConventionId;
    conventionSignatureLink: AbsoluteUrl;
    internshipKind: InternshipKind;
    justification: string;
    signatoryFirstName: string;
    signatoryLastName: string;
  };
  NEW_CONVENTION_REVIEW_FOR_ELIGIBILITY_OR_VALIDATION: {
    agencyLogoUrl: AbsoluteUrl | undefined;
    agencyReferentName: string | undefined;
    beneficiaryFirstName: string;
    beneficiaryLastName: string;
    businessName: string;
    conventionId: ConventionId;
    internshipKind: InternshipKind;
    manageConventionLink: string;
    possibleRoleAction: string;
    validatorName: string;
    peAdvisor:
      | {
          recipientIsPeAdvisor: boolean;
          firstName: string;
          lastName: string;
          email: string;
        }
      | undefined;
  };
  NEW_ESTABLISHMENT_CREATED_CONTACT_CONFIRMATION: {
    businessName: string;
    businessAddresses: string[];
    appelationLabels: string[];
  };
  POLE_EMPLOI_ADVISOR_ON_CONVENTION_FULLY_SIGNED: {
    advisorFirstName: string;
    advisorLastName: string;
    agencyLogoUrl: AbsoluteUrl | undefined;
    beneficiaryFirstName: string;
    beneficiaryLastName: string;
    beneficiaryEmail: string;
    businessName: string;
    conventionId: ConventionId;
    dateEnd: string;
    dateStart: string;
    immersionAddress: string;
    manageConventionLink: string;
  };
  REJECTED_CONVENTION_NOTIFICATION: {
    agencyName: string;
    agencyLogoUrl: AbsoluteUrl | undefined;
    beneficiaryFirstName: string;
    beneficiaryLastName: string;
    businessName: string;
    conventionId: ConventionId;
    immersionProfession: string;
    internshipKind: InternshipKind;
    rejectionReason: string;
    signature: string;
  };
  SHARE_CONVENTION_DRAFT_RECIPIENT: {
    internshipKind: InternshipKind;
    additionalDetails: string | undefined;
    conventionFormUrl: string;
  };
  SHARE_CONVENTION_DRAFT_SENDER: {
    internshipKind: InternshipKind;
    conventionFormUrl: string;
  };
  SIGNATORY_REMINDER: {
    actorFirstName: string;
    actorLastName: string;
    businessName: string;
    beneficiaryFirstName: string;
    beneficiaryLastName: string;
    conventionId: ConventionId;
    magicLinkUrl: AbsoluteUrl | undefined;
    signatoriesSummary: string;
  };
  SIGNEE_HAS_SIGNED_CONVENTION: {
    agencyLogoUrl: AbsoluteUrl | undefined;
    conventionId: ConventionId;
    magicLink: AbsoluteUrl;
    internshipKind: InternshipKind;
    signedAt: string;
    agencyName: string;
  };
  ESTABLISHMENT_REENGAGEMENT_SUGGESTION: {
    businessName: string;
  };
  TEST_EMAIL: {
    input1: string;
    input2: string;
    url: AbsoluteUrl;
  };
  VALIDATED_CONVENTION_FINAL_CONFIRMATION: {
    agencyLogoUrl: AbsoluteUrl | undefined;
    beneficiaryBirthdate: string;
    beneficiaryFirstName: string;
    beneficiaryLastName: string;
    businessName: string;
    conventionId: ConventionId;
    dateStart: string;
    dateEnd: string;
    emergencyContactInfos: string;
    establishmentTutorName: string;
    immersionAppellationLabel: string;
    internshipKind: InternshipKind;
    magicLink: string;
    validatorName: string;
    agencyName: string;
  };
  ACCOUNT_DELETION_WARNING: {
    fullName: string;
    deletionDate: string;
    loginUrl: AbsoluteUrl;
  };
  WARN_DISCUSSION_DELIVERY_FAILED: {
    recipientsInEmailInError: string[];
    errorMessage: string;
  };
  ESTABLISHMENT_USER_RIGHT_IS_PENDING: {
    establishmentDashboardUrl: AbsoluteUrl;
    adminFirstName: string | undefined;
    adminLastName: string | undefined;
    pendingUserFirstName: string | undefined;
    pendingUserLastName: string | undefined;
    pendingUserRole: EstablishmentRole;
    pendingUserEmail: Email;
  };
};
