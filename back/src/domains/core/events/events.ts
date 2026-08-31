import {
  type AgencyId,
  type ArchivedConventionRequestHandledStatus,
  type ContactEstablishmentEventPayload,
  type ConventionDraftId,
  type ConventionId,
  type ConventionTemplateId,
  type DateString,
  type DeleteAssessmentRequestDto,
  type Flavor,
  type FtExternalId,
  type InitiateLoginByEmailParams,
  type NotificationKind,
  type RangeOfPosition,
  type RejectConnectedUserRoleForAgencyParams,
  type Role,
  roleSchema,
  type SignatoryRole,
  type UserId,
  userIdSchema,
  type WithAgencyId,
  type WithAgencyIdAndUserId,
  type WithArchivedConventionRequestId,
  type WithAssessmentDto,
  type WithConventionDraftId,
  type WithConventionDto,
  type WithConventionId,
  type WithConventionIdLegacy,
  type WithDiscussionDto,
  type WithDiscussionId,
  type WithOptionalFirstnameAndLastname,
  type WithSiretDto,
  type WithUserId,
  type ZodSchemaWithInputMatchingOutput,
} from "shared";
import { z } from "zod";
import type { DeleteUserInputSchema } from "../../connected-users/use-cases/DeleteUser";
import type { UserAuthenticatedPayload } from "../../connected-users/use-cases/LinkFranceTravailUsersToTheirAgencies";
import type { NotifyConventionDraftSavedInputParams } from "../../convention/use-cases/notifications/NotifyConventionDraftSaved";
import type {
  EstablishmentUserRight,
  WithEstablishmentAggregate,
} from "../../establishment/entities/EstablishmentAggregate";
import type { WarnSenderThatMessageCouldNotBeDeliveredParams } from "../../establishment/use-cases/discussions/WarnSenderThatMessageCouldNotBeDelivered";
import type { WithNotificationIdAndKind } from "../notifications/helpers/Notification";
import type { UpdatePhonePayload } from "../phone-number/use-cases/UpdateInvalidPhone";
import type {
  ConventionReminderPayload,
  DelegationConventionReminderPayload,
  TransferConventionToAgencyPayload,
} from "./eventPayload.dto";

export type SubscriptionId = Flavor<string, "SubscriptionId">;

export type EventFailure = {
  subscriptionId: SubscriptionId;
  errorMessage: string;
};

export type EventPublication = {
  publishedAt: DateString;
  failures: EventFailure[];
};

export type EventStatus =
  | "never-published"
  | "to-republish"
  | "in-process"
  | "published"
  | "failed-but-will-retry"
  | "failed-to-many-times";

// The lower is the higher the priority:
// 0 super important to process ASAP
// 10 can be delayed without problems
export type EventPriority = 0 | RangeOfPosition<10>;

type GenericEvent<T extends string, P> = {
  id: string;
  occurredAt: DateString;
  topic: T;
  payload: P;
  publications: EventPublication[];
  wasQuarantined: boolean;
  status: EventStatus;
  priority: EventPriority;
};

export type NotificationAddedEvent = GenericEvent<
  "NotificationAdded",
  WithNotificationIdAndKind
>;

export type TriggeredBy =
  | { kind: "connected-user"; userId: UserId }
  | { kind: "convention-magic-link"; role: Role }
  | { kind: "crawler" };

export const triggeredBySchema: ZodSchemaWithInputMatchingOutput<TriggeredBy> =
  z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("connected-user"), userId: userIdSchema }),
    z.object({ kind: z.literal("convention-magic-link"), role: roleSchema }),
    z.object({ kind: z.literal("crawler") }),
  ]);

export const withTriggeredBySchema: ZodSchemaWithInputMatchingOutput<WithTriggeredBy> =
  z.object({
    triggeredBy: triggeredBySchema,
  });

type WithFTConnectEvent = {
  ftConnectUserId: FtExternalId;
  conventionDraftId: ConventionDraftId;
};

export type WithTriggeredBy = {
  triggeredBy: TriggeredBy | null;
};

// biome-ignore format: better readability without formatting
export type DomainEvent =
  | NotificationAddedEvent
  // IMMERSION APPLICATION RELATED
  // HAPPY PATH
  | GenericEvent<"ConventionSubmittedByBeneficiary", WithConventionDto & Partial<WithDiscussionId> & Partial<WithConventionDraftId> & WithTriggeredBy>
  | GenericEvent<"ConventionSubmittedAfterModification", WithConventionDto & WithTriggeredBy>
  | GenericEvent<"ConventionPartiallySigned", WithConventionDto & WithTriggeredBy>
  | GenericEvent<"ConventionFullySigned", WithConventionDto & WithTriggeredBy>
  | GenericEvent<"ConventionModifiedAndSigned", WithConventionDto & WithTriggeredBy>
  | GenericEvent<"ConventionAcceptedByCounsellor", WithConventionDto & WithTriggeredBy>
  | GenericEvent<"ConventionAcceptedByValidator", WithConventionDto & WithTriggeredBy>
  | GenericEvent<"ConventionReminderRequired", ConventionReminderPayload>
  | GenericEvent<"ConventionWithAssessmentBroadcastRequested", WithConventionId & WithAssessmentDto & WithTriggeredBy>
  | GenericEvent<"ConventionBroadcastRequested", WithConventionId & WithTriggeredBy>
  | GenericEvent<"ConventionTransferredToAgency", WithConventionDto & TransferConventionToAgencyPayload & WithTriggeredBy>
  | GenericEvent<"ConventionCounsellorNameEdited", WithConventionId & WithOptionalFirstnameAndLastname & WithTriggeredBy>
  | GenericEvent<"ConventionWithFinalStatusEdited", WithConventionDto & WithTriggeredBy>
  | GenericEvent<"ConventionSignatureLinkManuallySent", WithConventionDto & { recipientRole: SignatoryRole, transport: NotificationKind } & WithTriggeredBy>
  | GenericEvent<"AssessmentReminderManuallySent", WithConventionDto & { transport: NotificationKind } & WithTriggeredBy>
  | GenericEvent<"AssessmentSignatureReminderManuallySent", WithConventionDto & { transport: NotificationKind } & WithTriggeredBy>
  // UNHAPPY PATHS
  | GenericEvent<"ConventionRejected", WithConventionDto & WithTriggeredBy>
  | GenericEvent<"ConventionCancelled", WithConventionDto & WithTriggeredBy>
  | GenericEvent<"ConventionDeprecated", WithConventionDto & WithTriggeredBy>
  | GenericEvent<"ConventionDraftToDelete", WithConventionDraftId & WithTriggeredBy>
  | GenericEvent<"ConventionDraftSaved",NotifyConventionDraftSavedInputParams>
  | GenericEvent<"ArchivedConventionRequestCreated", WithArchivedConventionRequestId & WithTriggeredBy>
  | GenericEvent<"ArchivedConventionRequestHandled", WithArchivedConventionRequestId & { status: ArchivedConventionRequestHandledStatus } & WithTriggeredBy>

  // ESTABLISHMENT RELATED
  | GenericEvent<"NewEstablishmentAggregateInsertedFromForm", WithEstablishmentAggregate & WithTriggeredBy>
  | GenericEvent<"UpdatedEstablishmentAggregateInsertedFromForm", WithSiretDto & WithTriggeredBy>
  | GenericEvent<"AllEstablishmentUsersDeleted", WithSiretDto & WithTriggeredBy>
  | GenericEvent<"EstablishmentDeleted", WithSiretDto & WithTriggeredBy>
  | GenericEvent<"PendingUserRightRegisteredOnEstablishment", WithSiretDto & Pick<EstablishmentUserRight, "role" | "userId"> & WithTriggeredBy>
  | GenericEvent<"EstablishmentBanned", WithSiretDto & WithTriggeredBy>

  // CONTACT REQUEST RELATED
  | GenericEvent<"ContactRequestedByBeneficiary", ContactEstablishmentEventPayload & WithTriggeredBy>
  | GenericEvent<"DiscussionExchangeDeliveryFailed", WarnSenderThatMessageCouldNotBeDeliveredParams>
  | GenericEvent<"DiscussionStatusManuallyUpdated", WithDiscussionDto & { skipSendingEmail?: boolean } & WithTriggeredBy>
  | GenericEvent<"DiscussionMarkedAsDeprecated", WithDiscussionId & WithTriggeredBy>
  | GenericEvent<"DiscussionBeneficiaryFollowUpRequested", WithDiscussionId & WithTriggeredBy>
  | GenericEvent<"ExchangeAddedToDiscussion", WithSiretDto & WithDiscussionId>

  // ESTABLISHMENT LEAD RELATED
  | GenericEvent<"EstablishmentLeadReminderSent", WithConventionIdLegacy>

  // AGENCY RELATED
  | GenericEvent<"NewAgencyAdded", WithAgencyId & WithTriggeredBy>
  | GenericEvent<"AgencyActivated", WithAgencyId & WithTriggeredBy>
  | GenericEvent<"AgencyUpdated", WithAgencyId & WithTriggeredBy>
  | GenericEvent<"AgencyRejected", WithAgencyId & WithTriggeredBy>
  | GenericEvent<"AgencyHasBeenPutOnHold", WithAgencyId & WithTriggeredBy>
  | GenericEvent<
      "DelegationConventionReminderRequired",
      DelegationConventionReminderPayload
    >

  // IMMERSION ASSESSMENT related
  | GenericEvent<"AssessmentCreated", WithConventionDto & WithAssessmentDto & WithTriggeredBy>
  | GenericEvent<"AssessmentSignedByBeneficiary", WithConventionId & WithAssessmentDto & WithTriggeredBy>
  | GenericEvent<"AssessmentDeleted", DeleteAssessmentRequestDto & WithTriggeredBy>
  | GenericEvent<
    "ConventionTemplateDeleted",
    { conventionTemplateId: ConventionTemplateId } & WithTriggeredBy
  >
  | GenericEvent<"ConventionTemplateCreatedOrUpdated", { conventionTemplateId: ConventionTemplateId } & WithTriggeredBy>
  | GenericEvent<"EmailWithLinkToCreateAssessmentSent", WithConventionIdLegacy>
  | GenericEvent<"BeneficiaryAssessmentEmailSent", WithConventionIdLegacy>

  // FTCONNECT related
  | GenericEvent<"FTConnectedSuccessfully", WithFTConnectEvent>
  | GenericEvent<"FederatedIdentityBoundToConvention", WithConventionDto & WithTriggeredBy>
  | GenericEvent<"FederatedIdentityNotBoundToConvention", WithConventionDto & WithTriggeredBy>
  // USER CONNECTED related.
  // We don't put full OAuth in payload to avoid private data in logs etc...
  | GenericEvent<"UserAuthenticationByEmailRequested", InitiateLoginByEmailParams>
  | GenericEvent<"UserAuthenticatedSuccessfully", UserAuthenticatedPayload & WithTriggeredBy>

  // INACTIVE USER ACCOUNT DELETION
  | GenericEvent<"InactiveUserAccountDeletionTriggered", DeleteUserInputSchema>
  | GenericEvent<"UserDeleted", WithUserId & WithTriggeredBy>

  // Est-ce que les deux events au final c'est pas la même chose ???????!!!!!!! De quoi péter un gros boulard!
  | GenericEvent<"AgencyRegisteredToConnectedUser", { userId: UserId; agencyIds: AgencyId[] } & WithTriggeredBy> // Old name AgencyRegisteredToInclusionConnectedUser
  | GenericEvent<"ConnectedUserAgencyRightChanged", WithAgencyIdAndUserId & WithTriggeredBy> // Old name IcUserAgencyRightChanged


  | GenericEvent<"ConnectedUserAgencyRightRejected", RejectConnectedUserRoleForAgencyParams & WithTriggeredBy> // Old name IcUserAgencyRightRejected
  // API CONSUMER related
  | GenericEvent<"ApiConsumerSaved", { consumerId: string } & WithTriggeredBy>
  | GenericEvent<"ApiConsumerRevoked", { consumerId: string } & WithTriggeredBy>
  | GenericEvent<"ApiConsumerKeyRenewed", { consumerId: string } & WithTriggeredBy>
  // ERRORED CONVENTION RELATED
  | GenericEvent<"PartnerErroredConventionMarkedAsHandled", { conventionId: ConventionId; userId: UserId } & WithTriggeredBy>

  // PHONE RELATED
  | GenericEvent<"InvalidPhoneUpdateRequested", UpdatePhonePayload>;

export type DomainTopic = DomainEvent["topic"];
