import {
  keys,
  type WithConventionDraftId,
  type WithConventionDto,
  type WithConventionId,
  type WithSiretDto,
} from "shared";
import type { AppDependencies } from "../../../config/bootstrap/createAppDependencies";
import type {
  InstantiatedUseCase,
  UseCases,
} from "../../../config/bootstrap/createUseCases";
import type { WithConventionIdAndPreviousAgencyId } from "../../convention/use-cases/broadcast/broadcastConventionParams";
import type { WithEstablishmentAggregate } from "../../establishment/entities/EstablishmentAggregate";
import type { TransferConventionToAgencyPayload } from "./eventPayload.dto";
import type { DomainTopic } from "./events";
import type { NarrowEvent } from "./ports/EventBus";

type DomainUseCase = UseCases[keyof UseCases];

type ExtractUseCasesMatchingTopic<Topic extends DomainTopic> = Parameters<
  DomainUseCase["execute"]
>[0] extends NarrowEvent<Topic>["payload"]
  ? InstantiatedUseCase<NarrowEvent<Topic>["payload"], void, any>
  : never;

type UseCaseSubscriptionsByTopics = {
  [K in DomainTopic]: ExtractUseCasesMatchingTopic<K>[];
};

const getUseCasesByTopics = (
  useCases: UseCases,
): UseCaseSubscriptionsByTopics => ({
  ArchivedConventionRequestCreated: [
    useCases.notifyUserThatArchivedConventionRequestWasReceived,
  ],
  ConventionDraftSaved: [useCases.notifyConventionDraftSaved],
  UserDeleted: [],
  AllEstablishmentUsersDeleted: [useCases.deleteEstablishment],
  InactiveUserAccountDeletionTriggered: [useCases.deleteUser],
  NotificationAdded: [useCases.sendNotification],
  ExchangeAddedToDiscussion: [
    useCases.sendExchangeToRecipient,
    useCases.updateMarketingEstablishmentContactList,
  ],
  DiscussionExchangeDeliveryFailed: [
    useCases.warnSenderThatMessageCouldNotBeDelivered,
  ],
  DiscussionStatusManuallyUpdated: [
    {
      useCaseName: useCases.sendExchangeToRecipient.useCaseName,
      execute: async ({ discussion, skipSendingEmail, triggeredBy }) =>
        useCases.sendExchangeToRecipient.execute({
          discussionId: discussion.id,
          triggeredBy,
          skipSendingEmail,
        }),
    },
  ],
  DiscussionMarkedAsDeprecated: [useCases.markDiscussionDeprecatedAndNotify],
  DiscussionBeneficiaryFollowUpRequested: [
    useCases.notifyBeneficiaryToFollowUpContactRequest,
  ],

  // "Happy case" for conventions.
  ConventionSubmittedByBeneficiary: [
    useCases.bindConventionToFederatedIdentity,
    useCases.markDiscussionLinkedToConvention,
    extractWithConventionDraftIdFromAddConventionInput(
      useCases.deleteConventionDraft,
    ),
  ],

  // Convention Federated Identities
  FTConnectedSuccessfully: [],
  FederatedIdentityBoundToConvention: [
    useCases.notifyToAgencyConventionSubmitted,
    useCases.notifySignatoriesThatConventionSubmittedNeedsSignature,
    extractConventionIdFromConvention(
      useCases.broadcastToFranceTravailOnConventionUpdates,
    ),
    extractConventionIdFromConvention(
      useCases.broadcastToPartnersOnConventionUpdates,
    ),
  ],
  FederatedIdentityNotBoundToConvention: [
    useCases.notifyToAgencyConventionSubmitted,
    useCases.notifySignatoriesThatConventionSubmittedNeedsSignature,
    extractConventionIdFromConvention(
      useCases.broadcastToFranceTravailOnConventionUpdates,
    ),
    extractConventionIdFromConvention(
      useCases.broadcastToPartnersOnConventionUpdates,
    ),
  ],

  ConventionSubmittedAfterModification: [
    extractConventionIdFromConvention(
      useCases.removeConventionFTAdvisorIfAgencyIsNotFranceTravail,
    ),
    useCases.notifySignatoriesThatConventionSubmittedNeedsSignatureAfterNotification,
    extractConventionIdFromConvention(
      useCases.broadcastToFranceTravailOnConventionUpdates,
    ),
    extractConventionIdFromConvention(
      useCases.broadcastToPartnersOnConventionUpdates,
    ),
  ],
  ConventionModifiedAndSigned: [
    extractConventionIdFromConvention(
      useCases.removeConventionFTAdvisorIfAgencyIsNotFranceTravail,
    ),
    useCases.notifySignatoriesThatConventionSubmittedNeedsSignatureAfterNotification,
    useCases.notifyLastSigneeThatConventionHasBeenSigned,
    extractConventionIdFromConvention(
      useCases.broadcastToFranceTravailOnConventionUpdates,
    ),
    extractConventionIdFromConvention(
      useCases.broadcastToPartnersOnConventionUpdates,
    ),
  ],
  ConventionPartiallySigned: [
    useCases.notifyLastSigneeThatConventionHasBeenSigned,
    extractConventionIdFromConvention(
      useCases.broadcastToFranceTravailOnConventionUpdates,
    ),
    extractConventionIdFromConvention(
      useCases.broadcastToPartnersOnConventionUpdates,
    ),
  ],
  ConventionFullySigned: [
    useCases.notifyLastSigneeThatConventionHasBeenSigned,
    useCases.notifyNewConventionNeedsReview,
    useCases.notifyFranceTravailUserAdvisorOnConventionFullySigned,
    extractConventionIdFromConvention(
      useCases.broadcastToFranceTravailOnConventionUpdates,
    ),
    extractConventionIdFromConvention(
      useCases.broadcastToPartnersOnConventionUpdates,
    ),
  ],
  ConventionAcceptedByCounsellor: [
    useCases.notifyNewConventionNeedsReview,
    extractConventionIdFromConvention(
      useCases.broadcastToFranceTravailOnConventionUpdates,
    ),
    extractConventionIdFromConvention(
      useCases.broadcastToPartnersOnConventionUpdates,
    ),
  ],
  ConventionAcceptedByValidator: [
    useCases.notifyAllActorsOfFinalConventionValidation,
    extractConventionIdFromConvention(
      useCases.broadcastToFranceTravailOnConventionUpdates,
    ),
    extractConventionIdFromConvention(
      useCases.broadcastToPartnersOnConventionUpdates,
    ),
    useCases.addEstablishmentLead,
    extractSiretFromConvention(
      useCases.updateMarketingEstablishmentContactList,
    ),
  ],
  ConventionTransferredToAgency: [
    extractConventionIdFromConvention(
      useCases.removeConventionFTAdvisorIfAgencyIsNotFranceTravail,
    ),
    useCases.notifyAllActorsThatConventionHasBeenTransferred,
    extractConventionIdAndPreviousAgencyFromTransfer(
      useCases.broadcastToFranceTravailOnConventionUpdates,
    ),
    extractConventionIdAndPreviousAgencyFromTransfer(
      useCases.broadcastToPartnersOnConventionUpdates,
    ),
  ],
  ConventionCounsellorNameEdited: [],
  ConventionWithFinalStatusEdited: [
    extractConventionIdFromConvention(
      useCases.broadcastToFranceTravailOnConventionUpdates,
    ),
    extractConventionIdFromConvention(
      useCases.broadcastToPartnersOnConventionUpdates,
    ),
  ],

  // Edge cases for immersion application.

  ConventionRejected: [
    useCases.notifyAllActorsThatConventionIsRejected,
    extractConventionIdFromConvention(
      useCases.broadcastToFranceTravailOnConventionUpdates,
    ),
    extractConventionIdFromConvention(
      useCases.broadcastToPartnersOnConventionUpdates,
    ),
  ],
  ConventionCancelled: [
    useCases.notifyAllActorsThatConventionIsCancelled,
    extractConventionIdFromConvention(
      useCases.broadcastToFranceTravailOnConventionUpdates,
    ),
    extractConventionIdFromConvention(
      useCases.broadcastToPartnersOnConventionUpdates,
    ),
  ],
  ConventionDeprecated: [
    useCases.notifyAllActorsThatConventionIsDeprecated,
    extractConventionIdFromConvention(
      useCases.broadcastToFranceTravailOnConventionUpdates,
    ),
    extractConventionIdFromConvention(
      useCases.broadcastToPartnersOnConventionUpdates,
    ),
  ],
  ConventionSignatureLinkManuallySent: [],
  ConventionReminderRequired: [useCases.notifyConventionReminder],
  ConventionDraftToDelete: [useCases.deleteConventionDraft],

  // Establishment form related
  UpdatedEstablishmentAggregateInsertedFromForm: [
    useCases.updateMarketingEstablishmentContactList,
  ],
  NewEstablishmentAggregateInsertedFromForm: [
    extractSiretFromArg(useCases.notifyConfirmationEstablishmentCreated),
    extractSiretFromArg(
      useCases.notifyPassEmploiOnNewEstablishmentAggregateInsertedFromForm,
    ),
    extractSiretFromArg(useCases.updateMarketingEstablishmentContactList),
    extractSiretFromArg(useCases.markEstablishmentLeadAsRegistrationAccepted),
  ],
  EstablishmentBanned: [
    useCases.notifyThatReferencedEstablishmentIsBanned,
    useCases.notifyThatEstablishmentFromConventionIsBanned,
  ],
  EstablishmentDeleted: [],
  PendingUserRightRegisteredOnEstablishment: [
    useCases.notifyEstablishmentAdminsThatUserRightIsPending,
  ],
  // Establishment lead related
  EstablishmentLeadReminderSent: [],

  // Search related
  ContactRequestedByBeneficiary: [
    useCases.notifyContactRequest,
    useCases.notifyCandidateThatContactRequestHasBeenSent,
    useCases.updateMarketingEstablishmentContactList,
  ],

  // Agency related :
  NewAgencyAdded: [useCases.sendEmailWhenNewAgencyOfTypeOtherAdded],
  AgencyActivated: [useCases.sendEmailsWhenAgencyIsActivated],
  AgencyUpdated: [useCases.updateAgencyReferringToUpdatedAgency],
  AgencyRejected: [useCases.sendEmailWhenAgencyIsRejected],
  AgencyRegisteredToConnectedUser: [
    useCases.notifyUserThatAgencyRegistrationRequestWasReceived,
  ],
  AgencyHasBeenPutOnHold: [useCases.notifyAgencyHasBeenPutOnHold],
  DelegationConventionReminderRequired: [
    useCases.notifyDelegationConventionReminder,
  ],

  // Assessment related:
  AssessmentCreated: [
    useCases.notifyBeneficiaryThatAssessmentNeedsSignature,
    extractConventionIdFromConvention(
      useCases.broadcastToFranceTravailOnAssessmentCreated,
    ),
    useCases.notifyAgencyThatAssessmentIsCreatedWithStatusDidNotShow,
  ],
  AssessmentDeleted: [
    useCases.notifyActorsThatAssessmentDeleted,
    useCases.broadcastToFranceTravailOnConventionUpdates,
    useCases.broadcastToPartnersOnConventionUpdates,
  ],
  AssessmentSignedByBeneficiary: [
    useCases.notifyAgencyThatAssessmentIsCreatedWithStatusCompletedOrPartiallyCompleted,
    useCases.notifyEstablishmentThatAssessmentWasCreated,
    useCases.notifyBeneficiaryThatAssessmentIsCreated,
  ],
  ConventionTemplateDeleted: [],
  ConventionTemplateCreatedOrUpdated: [],
  EmailWithLinkToCreateAssessmentSent: [],
  BeneficiaryAssessmentEmailSent: [],
  AssessmentReminderManuallySent: [],
  AssessmentSignatureReminderManuallySent: [],

  UserAuthenticationByEmailRequested: [useCases.initiateLoginByEmail],
  UserAuthenticatedSuccessfully: [
    useCases.linkFranceTravailUsersToTheirAgencies,
  ],
  ConnectedUserAgencyRightChanged: [
    useCases.notifyUserAgencyRightChanged,
    useCases.updateAgencyReferringToUpdatedAgency,
  ],
  ConnectedUserAgencyRightRejected: [useCases.notifyUserAgencyRightRejected],

  //Api Consumer related:
  ApiConsumerSaved: [],
  ApiConsumerRevoked: [],
  ApiConsumerKeyRenewed: [],

  //partnersConvention related
  PartnerErroredConventionMarkedAsHandled: [],
  ConventionWithAssessmentBroadcastRequested: [
    useCases.broadcastToFranceTravailOnConventionUpdates,
    useCases.broadcastToPartnersOnConventionUpdates,
  ],
  ConventionBroadcastRequested: [
    useCases.broadcastToFranceTravailOnConventionUpdates,
    useCases.broadcastToPartnersOnConventionUpdates,
  ],

  // Phone related
  InvalidPhoneUpdateRequested: [useCases.updateInvalidPhone],
});

export const subscribeToEvents = (deps: AppDependencies) => {
  const useCasesByTopic = getUseCasesByTopics(deps.useCases);
  keys(useCasesByTopic).forEach((topic) => {
    const useCases = useCasesByTopic[topic];

    useCases.forEach((useCase) => {
      // the provided key for each use case is needed in order to follow the acknowledgments
      const subscriptionId = useCase.useCaseName; // careful this is fragile, because the subscription id is stored in DB when failing
      deps.eventBus.subscribe(topic, subscriptionId, async (event) => {
        await useCase.execute(event.payload as any);
      });
    });
  });
};

const extractSiretFromArg = <
  UC extends InstantiatedUseCase<WithSiretDto, void, any>,
>(
  useCase: UC,
): InstantiatedUseCase<WithEstablishmentAggregate, void, any> => ({
  useCaseName: useCase.useCaseName,
  execute: (params) =>
    useCase.execute({
      siret: params.establishmentAggregate.establishment.siret,
    }),
});

const extractSiretFromConvention = <
  UC extends InstantiatedUseCase<WithSiretDto, void, any>,
>(
  useCase: UC,
): InstantiatedUseCase<WithConventionDto, void, any> => ({
  useCaseName: useCase.useCaseName,
  execute: (params) =>
    useCase.execute({
      siret: params.convention.siret,
    }),
});

const extractConventionIdFromConvention = <
  UC extends InstantiatedUseCase<WithConventionId, void, any>,
>(
  useCase: UC,
): InstantiatedUseCase<WithConventionDto, void, any> => ({
  useCaseName: useCase.useCaseName,
  execute: (params) =>
    useCase.execute({
      conventionId: params.convention.id,
    }),
});

const extractConventionIdAndPreviousAgencyFromTransfer = <
  UC extends InstantiatedUseCase<
    WithConventionIdAndPreviousAgencyId,
    void,
    any
  >,
>(
  useCase: UC,
): InstantiatedUseCase<
  TransferConventionToAgencyPayload & { triggeredBy: unknown },
  void,
  any
> => ({
  useCaseName: useCase.useCaseName,
  execute: (params) =>
    useCase.execute({
      conventionId: params.convention.id,
      previousAgencyId: params.previousAgencyId,
    }),
});

const extractWithConventionDraftIdFromAddConventionInput = <
  UC extends InstantiatedUseCase<Partial<WithConventionDraftId>, void, any>,
>(
  useCase: UC,
): InstantiatedUseCase<Partial<WithConventionDraftId>, void, any> => ({
  useCaseName: useCase.useCaseName,
  execute: ({ conventionDraftId }) =>
    useCase.execute({
      conventionDraftId: conventionDraftId,
    }),
});
