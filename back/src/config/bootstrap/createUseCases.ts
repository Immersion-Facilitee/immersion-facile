import { addDays, subDays } from "date-fns";
import {
  type ConnectedUser,
  type ConventionId,
  findSimilarConventionsParamsSchema,
  NotFoundError,
  siretSchema,
} from "shared";
import z from "zod";
import { makeAddAgenciesAndUsers } from "../../domains/agency/use-cases/AddAgenciesAndUsers";
import { makeAddAgency } from "../../domains/agency/use-cases/AddAgency";
import { makeCloseAgencyAndTransferConventions } from "../../domains/agency/use-cases/CloseAgencyAndTransferConventions";
import { makeGetAgencyById } from "../../domains/agency/use-cases/GetAgencyById";
import { makeListAgencyOptionsByFilter } from "../../domains/agency/use-cases/ListAgenciesByFilter";
import { makeNotifyAgencyHasBeenPutOnHold } from "../../domains/agency/use-cases/NotifyAgencyHasBeenPutOnHold";
import { makeNotifyDelegationConventionReminder } from "../../domains/agency/use-cases/notifications/NotifyDelegationConventionReminder";
import { makeRegisterAgencyToConnectedUser } from "../../domains/agency/use-cases/RegisterAgencyToConnectedUser";
import { makeRemoveUserFromAgency } from "../../domains/agency/use-cases/RemoveUserFromAgency";
import { makeUpdateAgency } from "../../domains/agency/use-cases/UpdateAgency";
import { makeUpdateAgencyReferringToUpdatedAgency } from "../../domains/agency/use-cases/UpdateAgencyReferringToUpdatedAgency";
import { throwIfNotAdmin } from "../../domains/connected-users/helpers/authorization.helper";
import { makeCreateUserForAgency } from "../../domains/connected-users/use-cases/CreateUserForAgency";
import { makeDeleteUser } from "../../domains/connected-users/use-cases/DeleteUser";
import { makeGetConnectedUser } from "../../domains/connected-users/use-cases/GetConnectedUser";
import { makeGetConnectedUsers } from "../../domains/connected-users/use-cases/GetConnectedUsers";
import { makeGetUsers } from "../../domains/connected-users/use-cases/GetUsers";
import { makeLinkFranceTravailUsersToTheirAgencies } from "../../domains/connected-users/use-cases/LinkFranceTravailUsersToTheirAgencies";
import { makeRejectUserForAgency } from "../../domains/connected-users/use-cases/RejectUserForAgency";
import { makeUpdateUserForAgency } from "../../domains/connected-users/use-cases/UpdateUserForAgency";
import { makeAddConvention } from "../../domains/convention/use-cases/AddConvention";
import { makeAddValidatedConventionNps } from "../../domains/convention/use-cases/AddValidatedConventionNps";
import { makeBroadcastConventionAgain } from "../../domains/convention/use-cases/broadcast/BroadcastConventionAgain";
import { makeBroadcastToFranceTravailOnConventionUpdates } from "../../domains/convention/use-cases/broadcast/BroadcastToFranceTravailOnConventionUpdates";
import { makeBroadcastToFranceTravailOrchestrator } from "../../domains/convention/use-cases/broadcast/BroadcastToFranceTravailOrchestrator";
import { makeGetConventionsWithErroredBroadcastFeedback } from "../../domains/convention/use-cases/broadcast/GetConventionsWithErroredBroadcastFeedback";
import { makeCreateArchivedConventionRequest } from "../../domains/convention/use-cases/CreateArchivedConventionRequest";
import { makeCreateAssessment } from "../../domains/convention/use-cases/CreateAssessment";
import { makeCreateOrUpdateConventionTemplate } from "../../domains/convention/use-cases/CreateOrUpdateConventionTemplate";
import { makeDeleteAssessment } from "../../domains/convention/use-cases/DeleteAssessment";
import { makeDeleteConventionDraft } from "../../domains/convention/use-cases/DeleteConventionDraft";
import { makeDeleteConventionTemplate } from "../../domains/convention/use-cases/DeleteConventionTemplate";
import { makeEditConventionCounsellorName } from "../../domains/convention/use-cases/EditConventionCounsellorName";
import { makeEditConventionWithFinalStatus } from "../../domains/convention/use-cases/EditConventionWithFinalStatus";
import { makeFetchArchivedConventionRequestToReviewList } from "../../domains/convention/use-cases/FetchArchivedConventionRequestToReviewList";
import { makeGetAgencyPublicInfoById } from "../../domains/convention/use-cases/GetAgencyPublicInfoById";
import { makeGetApiConsumersByConvention } from "../../domains/convention/use-cases/GetApiConsumersByConvention";
import { makeGetAssessmentByConventionId } from "../../domains/convention/use-cases/GetAssessmentByConventionId";
import { makeGetBeneficiaryConventionList } from "../../domains/convention/use-cases/GetBeneficiaryConventionList";
import { makeGetConvention } from "../../domains/convention/use-cases/GetConvention";
import { makeGetConventionDraftById } from "../../domains/convention/use-cases/GetConventionDraftById";
import { makeGetConventionsForAgencyUser } from "../../domains/convention/use-cases/GetConventionsForAgencyUser";
import { makeGetConventionsForApiConsumer } from "../../domains/convention/use-cases/GetConventionsForApiConsumer";
import { makeGetConventionsWithUnfinalizedAssessment } from "../../domains/convention/use-cases/GetConventionsWithUnfinalizedAssessment";
import { makeGetConventionTemplatesForCurrentUser } from "../../domains/convention/use-cases/GetConventionTemplatesForCurrentUser";
import { makeGetLastBroadcastFeedback } from "../../domains/convention/use-cases/GetLastBroadcastFeedback";
import { makeNotifyActorsThatAssessmentDeleted } from "../../domains/convention/use-cases/notifications/NotifyActorsThatAssessmentDeleted";
import { makeNotifyAgencyDelegationContact } from "../../domains/convention/use-cases/notifications/NotifyAgencyDelegationContact";
import { makeNotifyAgencyThatAssessmentIsCreatedWithStatusCompletedOrPartiallyCompleted } from "../../domains/convention/use-cases/notifications/NotifyAgencyThatAssessmentIsCreatedWithStatusCompletedOrPartiallyCompleted";
import { makeNotifyAgencyThatAssessmentIsCreatedWithStatusDidNotShow } from "../../domains/convention/use-cases/notifications/NotifyAgencyThatAssessmentIsCreatedWithStatusDidNotShow";
import { makeNotifyAllActorsOfFinalConventionValidation } from "../../domains/convention/use-cases/notifications/NotifyAllActorsOfFinalConventionValidation";
import { makeNotifyAllActorsThatConventionIsCancelled } from "../../domains/convention/use-cases/notifications/NotifyAllActorsThatConventionIsCancelled";
import { makeNotifyAllActorsThatConventionIsDeprecated } from "../../domains/convention/use-cases/notifications/NotifyAllActorsThatConventionIsDeprecated";
import { makeNotifyAllActorsThatConventionIsRejected } from "../../domains/convention/use-cases/notifications/NotifyAllActorsThatConventionIsRejected";
import { makeNotifyAllActorsThatConventionTransferred } from "../../domains/convention/use-cases/notifications/NotifyAllActorsThatConventionTransferred";
import { makeNotifyBeneficiaryThatAssessmentIsCreated } from "../../domains/convention/use-cases/notifications/NotifyBeneficiaryThatAssessmentIsCreated";
import { makeNotifyBeneficiaryThatAssessmentNeedsSignature } from "../../domains/convention/use-cases/notifications/NotifyBeneficiaryThatAssessmentNeedsSignature";
import { makeNotifyConventionDraftSaved } from "../../domains/convention/use-cases/notifications/NotifyConventionDraftSaved";
import { makeNotifyConventionReminder } from "../../domains/convention/use-cases/notifications/NotifyConventionReminder";
import { makeNotifyEstablishmentThatAssessmentWasCreated } from "../../domains/convention/use-cases/notifications/NotifyEstablishmentThatAssessmentWasCreated";
import { makeNotifyLastSigneeThatConventionHasBeenSigned } from "../../domains/convention/use-cases/notifications/NotifyLastSigneeThatConventionHasBeenSigned";
import { makeNotifyNewConventionNeedsReview } from "../../domains/convention/use-cases/notifications/NotifyNewConventionNeedsReview";
import { makeNotifySignatoriesThatConventionSubmittedNeedsSignature } from "../../domains/convention/use-cases/notifications/NotifySignatoriesThatConventionSubmittedNeedsSignature";
import { makeNotifySignatoriesThatConventionSubmittedNeedsSignatureAfterModification } from "../../domains/convention/use-cases/notifications/NotifySignatoriesThatConventionSubmittedNeedsSignatureAfterModification";
import { makeNotifyToAgencyConventionSubmitted } from "../../domains/convention/use-cases/notifications/NotifyToAgencyConventionSubmitted";
import { makeNotifyUserAgencyRightChanged } from "../../domains/convention/use-cases/notifications/NotifyUserAgencyRightChanged";
import { makeNotifyUserAgencyRightRejected } from "../../domains/convention/use-cases/notifications/NotifyUserAgencyRightRejected";
import { makeNotifyUserThatAgencyRegistrationRequestWasReceived } from "../../domains/convention/use-cases/notifications/NotifyUserThatAgencyRegistrationRequestWasReceived";
import { makeNotifyUserThatArchivedConventionRequestWasReceived } from "../../domains/convention/use-cases/notifications/NotifyUserThatArchivedConventionRequestWasReceived";
import { makeMarkPartnersErroredConventionAsHandled } from "../../domains/convention/use-cases/partners-errored-convention/MarkPartnersErroredConventionAsHandled";
import { makeRemoveConventionFTAdvisorIfAgencyIsNotFranceTravail } from "../../domains/convention/use-cases/RemoveConventionFTAdvisorIfAgencyIsNotFranceTravail";
import { makeRenewConvention } from "../../domains/convention/use-cases/RenewConvention";
import { makeRequestOldConventionDraftsDeletion } from "../../domains/convention/use-cases/RequestOldConventionDraftsDeletion";
import { makeSaveConventionDraft } from "../../domains/convention/use-cases/SaveConventionDraft";
import { makeSendAssessmentLink } from "../../domains/convention/use-cases/SendAssessmentLink";
import { makeSendAssessmentSignatureReminder } from "../../domains/convention/use-cases/SendAssessmentSignatureReminder";
import { makeSendEmailsWhenAgencyIsActivated } from "../../domains/convention/use-cases/SendEmailsWhenAgencyIsActivated";
import { makeSendEmailWhenAgencyIsRejected } from "../../domains/convention/use-cases/SendEmailWhenAgencyIsRejected";
import { makeSendEmailWhenNewAgencyOfTypeOtherAdded } from "../../domains/convention/use-cases/SendEmailWhenNewAgencyOfTypeOtherAdded";
import { makeSendSignatureLink } from "../../domains/convention/use-cases/SendSignatureLink";
import { makeSignAssessment } from "../../domains/convention/use-cases/SignAssessment";
import { makeSignConvention } from "../../domains/convention/use-cases/SignConvention";
import { makeTransferConventionToAgency } from "../../domains/convention/use-cases/TransferConventionToAgency";
import { makeUpdateConvention } from "../../domains/convention/use-cases/UpdateConvention";
import { makeUpdateConventionStatus } from "../../domains/convention/use-cases/UpdateConventionStatus";
import { makeLookupLocation } from "../../domains/core/address/use-cases/LookupLocation";
import { makeLookupStreetAddress } from "../../domains/core/address/use-cases/LookupStreetAddress";
import { makeBroadcastToPartnersOnConventionUpdates } from "../../domains/core/api-consumer/use-cases/BroadcastToPartnersOnConventionUpdates";
import { makeDeleteSubscription } from "../../domains/core/api-consumer/use-cases/DeleteSubscription";
import { makeListActiveSubscriptions } from "../../domains/core/api-consumer/use-cases/ListActiveSubscriptions";
import { makeRenewApiConsumerKey } from "../../domains/core/api-consumer/use-cases/RenewApiConsumerKey";
import { makeRevokeApiConsumer } from "../../domains/core/api-consumer/use-cases/RevokeApiConsumer";
import { makeSaveApiConsumer } from "../../domains/core/api-consumer/use-cases/SaveApiConsumer";
import { makeSubscribeToWebhook } from "../../domains/core/api-consumer/use-cases/SubscribeToWebhook";
import { makeAfterOAuthSuccess } from "../../domains/core/authentication/connected-user/use-cases/AfterOAuthSuccess";
import { makeGetOAuthLogoutUrl } from "../../domains/core/authentication/connected-user/use-cases/GetOAuthLogoutUrl";
import { makeInitiateLoginByEmail } from "../../domains/core/authentication/connected-user/use-cases/InitiateLoginByEmail";
import { makeInitiateLoginByOAuth } from "../../domains/core/authentication/connected-user/use-cases/InitiateLoginByOAuth";
import { makeRenewExpiredJwt } from "../../domains/core/authentication/connected-user/use-cases/RenewExpiredJwt";
import { makeBindConventionToFederatedIdentity } from "../../domains/core/authentication/ft-connect/use-cases/BindConventionToFederatedIdentity";
import { makeNotifyFranceTravailUserAdvisorOnConventionFullySigned } from "../../domains/core/authentication/ft-connect/use-cases/NotifyFranceTravailUserAdvisorOnConventionFullySigned";
import type { DashboardGateway } from "../../domains/core/dashboard/port/DashboardGateway";
import { makeGetDashboardUrl } from "../../domains/core/dashboard/useCases/GetDashboardUrl";
import { makeValidateEmail } from "../../domains/core/email-validation/use-cases/ValidateEmail";
import { makeCreateNewEvent } from "../../domains/core/events/ports/EventBus";
import { makeSetFeatureFlag } from "../../domains/core/feature-flags/use-cases/SetFeatureFlag";
import { makeUploadFile } from "../../domains/core/file-storage/useCases/UploadFile";
import type {
  GenerateApiConsumerJwt,
  GenerateConnectedUserJwt,
  GenerateConventionJwt,
  GenerateEmailAuthCodeJwt,
  VerifyJwtFn,
} from "../../domains/core/jwt";
import { makeGetAllNafSections } from "../../domains/core/naf/use-cases/GetAllNafSections";
import {
  makeSaveNotificationAndRelatedEvent,
  makeSaveNotificationsBatchAndRelatedEvent,
} from "../../domains/core/notifications/helpers/Notification";
import { makeSendNotification } from "../../domains/core/notifications/useCases/SendNotification";
import { makeHtmlToPdf } from "../../domains/core/pdf-generation/use-cases/HtmlToPdf";
import { makeUpdateInvalidPhone } from "../../domains/core/phone-number/use-cases/UpdateInvalidPhone";
import { makeAppellationSearch } from "../../domains/core/rome/use-cases/AppellationSearch";
import { makeRomeSearch } from "../../domains/core/rome/use-cases/RomeSearch";
import { makeGetLink } from "../../domains/core/short-link/use-cases/GetLink";
import { makeGetSiretEstablishmentDto } from "../../domains/core/sirene/use-cases/GetSiretEstablishmentDto";
import { makeGetEstablishmentStats } from "../../domains/core/statistics/use-cases/GetEstablishmentStats";
import { makeSendSupportTicketToCrisp } from "../../domains/core/support/use-cases/SendSupportTicketToCrisp";
import type { TimeGateway } from "../../domains/core/time-gateway/ports/TimeGateway";
import type { OutOfTransactionQueries } from "../../domains/core/unit-of-work/ports/UnitOfWork";
import type { UnitOfWorkPerformer } from "../../domains/core/unit-of-work/ports/UnitOfWorkPerformer";
import { useCaseBuilder } from "../../domains/core/useCaseBuilder";
import type { UuidGenerator } from "../../domains/core/uuid-generator/ports/UuidGenerator";
import { makeAddEstablishmentLead } from "../../domains/establishment/use-cases/AddEstablishmentLead";
import { makeAddFormEstablishmentBatch } from "../../domains/establishment/use-cases/AddFormEstablismentsBatch";
import { makeBanEstablishment } from "../../domains/establishment/use-cases/BanEstablishment";
import { makeContactEstablishment } from "../../domains/establishment/use-cases/ContactEstablishment";
import { makeContactRequestReminder } from "../../domains/establishment/use-cases/ContactRequestReminder";
import { makeDeleteEstablishment } from "../../domains/establishment/use-cases/DeleteEstablishment";
import { makeAddExchangeToDiscussion } from "../../domains/establishment/use-cases/discussions/AddExchangeToDiscussion";
import { makeGetDiscussionById } from "../../domains/establishment/use-cases/discussions/GetDiscussionById";
import { makeGetDiscussionEstablishmentContactInfo } from "../../domains/establishment/use-cases/discussions/GetDiscussionEstablishmentContactInfo";
import { makeGetDiscussionsForUser } from "../../domains/establishment/use-cases/discussions/GetDiscussionsForUser";
import { makeMarkDiscussionDeprecatedAndNotify } from "../../domains/establishment/use-cases/discussions/MarkDiscussionDeprecatedAndNotify";
import { makeMarkDiscussionLinkedToConvention } from "../../domains/establishment/use-cases/discussions/MarkDiscussionLinkedToConvention";
import { makeNotifyBeneficiaryToFollowUpContactRequest } from "../../domains/establishment/use-cases/discussions/NotifyBeneficiaryToFollowUpContactRequest";
import { makeSendExchangeToRecipient } from "../../domains/establishment/use-cases/discussions/SendExchangeToRecipient";
import { makeUpdateDiscussionStatus } from "../../domains/establishment/use-cases/discussions/UpdateDiscussionStatus";
import { makeWarnSenderThatMessageCouldNotBeDelivered } from "../../domains/establishment/use-cases/discussions/WarnSenderThatMessageCouldNotBeDelivered";
import { makeGetEstablishmentNameAndAdmins } from "../../domains/establishment/use-cases/GetEstablishmentNameAndAdmins";
import { makeGetEstablishmentPublicOptionsByFilters } from "../../domains/establishment/use-cases/GetEstablishmentPublicOptionsByFilters";
import { makeGetExternalOffers } from "../../domains/establishment/use-cases/GetExternalOffers";
import { makeGetExternalSearchResult } from "../../domains/establishment/use-cases/GetExternalSearchResult";
import { makeGetOffersByGroupSlug } from "../../domains/establishment/use-cases/GetGroupBySlug";
import { makeGetOffers } from "../../domains/establishment/use-cases/GetOffers";
import { makeGetSearchResultBySearchQuery } from "../../domains/establishment/use-cases/GetSearchResultBySearchQuery";
import { makeInsertEstablishmentAggregateFromForm } from "../../domains/establishment/use-cases/InsertEstablishmentAggregateFromFormEstablishement";
import { makeMarkEstablishmentLeadAsRegistrationAccepted } from "../../domains/establishment/use-cases/MarkEstablishmentLeadAsRegistrationAccepted";
import { makeMarkEstablishmentLeadAsRegistrationRejected } from "../../domains/establishment/use-cases/MarkEstablishmentLeadAsRegistrationRejected";
import { makeNotifyCandidateThatContactRequestHasBeenSent } from "../../domains/establishment/use-cases/notifications/NotifyCandidateThatContactRequestHasBeenSent";
import { makeNotifyConfirmationEstablishmentCreated } from "../../domains/establishment/use-cases/notifications/NotifyConfirmationEstablishmentCreated";
import { makeNotifyContactRequest } from "../../domains/establishment/use-cases/notifications/NotifyContactRequest";
import { makeNotifyEstablishmentAdminsThatUserRightIsPending } from "../../domains/establishment/use-cases/notifications/NotifyEstablishmentAdminsThatUserRightIsPending";
import { makeNotifyPassEmploiOnNewEstablishmentAggregateInsertedFromForm } from "../../domains/establishment/use-cases/notifications/NotifyPassEmploiOnNewEstablishmentAggregateInsertedFromForm";
import { makeNotifyThatEstablishmentIsBanned } from "../../domains/establishment/use-cases/notifications/NotifyThatEstablishmentIsBanned";
import { makeRegisterUserOnEstablishment } from "../../domains/establishment/use-cases/RegisterUserOnEstablishment";
import { makeRetrieveFormEstablishmentFromAggregates } from "../../domains/establishment/use-cases/RetrieveFormEstablishmentFromAggregates";
import { makeUpdateEstablishmentAggregateFromForm } from "../../domains/establishment/use-cases/UpdateEstablishmentAggregateFromFormEstablishement";
import { makeUpdateMarketingEstablishmentContactList } from "../../domains/marketing/use-cases/UpdateMarketingEstablishmentContactsList";
import type { AppConfig } from "./appConfig";
import type { Gateways } from "./createGateways";
import {
  makeGenerateConnectedUserLoginUrl,
  makeGenerateConventionMagicLinkUrl,
  makeGenerateEmailAuthCodeUrl,
} from "./magicLinkUrl";

type CreateUsecasesParams = {
  config: AppConfig;
  gateways: Gateways;
  deps: {
    uowPerformer: UnitOfWorkPerformer;
    uuidGenerator: UuidGenerator;
    queries: OutOfTransactionQueries;
  };
  jwt: {
    generateConventionJwt: GenerateConventionJwt;
    generateConnectedUserJwt: GenerateConnectedUserJwt;
    generateApiConsumerJwt: GenerateApiConsumerJwt;
    generateEmailAuthCodeJwt: GenerateEmailAuthCodeJwt;
    verifyEmailAuthCodeJwt: VerifyJwtFn<"emailAuthCode">;
  };
};

export const createUseCases = ({
  config,
  deps: { uowPerformer, uuidGenerator, queries },
  gateways,
  jwt: {
    generateApiConsumerJwt,
    generateConnectedUserJwt,
    generateConventionJwt,
    generateEmailAuthCodeJwt,
    verifyEmailAuthCodeJwt,
  },
}: CreateUsecasesParams) => {
  const timeGateway = gateways.timeGateway;

  const createNewEvent = makeCreateNewEvent({
    timeGateway,
    uuidGenerator,
    quarantinedTopics: config.quarantinedTopics,
  });
  const saveNotificationAndRelatedEvent = makeSaveNotificationAndRelatedEvent(
    uuidGenerator,
    gateways.timeGateway,
    createNewEvent,
  );

  const saveNotificationsBatchAndRelatedEvent =
    makeSaveNotificationsBatchAndRelatedEvent(
      uuidGenerator,
      gateways.timeGateway,
      createNewEvent,
    );

  const insertEstablishmentAggregateFromForm =
    makeInsertEstablishmentAggregateFromForm({
      uowPerformer,
      deps: {
        addressGateway: gateways.addressApi,
        createNewEvent,
        siretGateway: gateways.siret,
        timeGateway,
        uuidGenerator,
      },
    });

  const generateConventionMagicLinkUrl = makeGenerateConventionMagicLinkUrl(
    config,
    generateConventionJwt,
  );
  const generateConnectedUserLoginUrl = makeGenerateConnectedUserLoginUrl(
    config,
    generateConnectedUserJwt,
  );
  const generateEmailAuthCodeUrl = makeGenerateEmailAuthCodeUrl(
    config,
    generateEmailAuthCodeJwt,
  );

  const addConvention = makeAddConvention({
    deps: { createNewEvent, siretGateway: gateways.siret },
    uowPerformer,
  });

  const broadcastToFranceTravailOnConventionUpdates =
    makeBroadcastToFranceTravailOnConventionUpdates({
      uowPerformer,
      deps: {
        franceTravailGateway: gateways.franceTravailGateway,
        timeGateway,
        options: { resyncMode: false },
      },
    });

  return {
    setFeatureFlag: makeSetFeatureFlag({ uowPerformer }),
    sendNotification: makeSendNotification({
      uowPerformer,
      deps: {
        createNewEvent,
        notificationGateway: gateways.notification,
        timeGateway,
      },
    }),

    markPartnersErroredConventionAsHandled:
      makeMarkPartnersErroredConventionAsHandled({
        uowPerformer,
        deps: {
          createNewEvent,
          timeGateway,
        },
      }),
    deleteSubscription: makeDeleteSubscription({ uowPerformer }),

    addValidatedConventionNPS: makeAddValidatedConventionNps({
      uowPerformer,
    }),

    //Convention
    addConvention,
    getConvention: makeGetConvention({ uowPerformer }),
    getBeneficiaryConventionList: makeGetBeneficiaryConventionList({
      uowPerformer,
      deps: { timeGateway },
    }),

    saveConventionDraft: makeSaveConventionDraft({
      uowPerformer,
      deps: {
        createNewEvent,
        timeGateway,
      },
    }),
    createArchivedConventionRequest: makeCreateArchivedConventionRequest({
      uowPerformer,
      deps: {
        createNewEvent,
        timeGateway,
      },
    }),
    fetchArchivedConventionRequestToReviewList:
      makeFetchArchivedConventionRequestToReviewList({
        uowPerformer,
        deps: {
          archivedConventionRequestQueries: queries.archivedConventionRequest,
        },
      }),
    bindConventionToFederatedIdentity: makeBindConventionToFederatedIdentity({
      uowPerformer,
      deps: {
        createNewEvent,
      },
    }),
    signConvention: makeSignConvention({
      uowPerformer,
      deps: {
        createNewEvent,
        timeGateway,
      },
    }),

    renewConvention: makeRenewConvention({
      uowPerformer,
      deps: { addConvention },
    }),
    updateConvention: makeUpdateConvention({
      uowPerformer,
      deps: {
        createNewEvent,
        timeGateway,
      },
    }),
    updateConventionStatus: makeUpdateConventionStatus({
      uowPerformer,
      deps: {
        createNewEvent,
        timeGateway,
      },
    }),

    getConventionsForApiConsumer: makeGetConventionsForApiConsumer({
      uowPerformer,
    }),

    // agencies
    sendEmailsWhenAgencyIsActivated: makeSendEmailsWhenAgencyIsActivated({
      uowPerformer,
      deps: {
        immersionFacileBaseUrl: config.immersionFacileBaseUrl,
        saveNotificationAndRelatedEvent,
      },
    }),

    sendEmailWhenAgencyIsRejected: makeSendEmailWhenAgencyIsRejected({
      uowPerformer,
      deps: {
        saveNotificationAndRelatedEvent,
      },
    }),

    sendEmailWhenNewAgencyOfTypeOtherAdded:
      makeSendEmailWhenNewAgencyOfTypeOtherAdded({
        uowPerformer,
        deps: {
          saveNotificationAndRelatedEvent,
        },
      }),

    // siret
    getSiretEstablishmentDto: makeGetSiretEstablishmentDto({
      deps: { siretGateway: gateways.siret },
      uowPerformer,
    }),
    getOffersByGroupSlug: makeGetOffersByGroupSlug({ uowPerformer }),
    romeSearch: makeRomeSearch({ uowPerformer }),

    // Address
    lookupLocation: makeLookupLocation({
      deps: { addressGateway: gateways.addressApi },
    }),

    lookupStreetAddress: makeLookupStreetAddress({
      deps: { addressGateway: gateways.addressApi },
    }),

    uploadFile: makeUploadFile({
      deps: { documentGateway: gateways.documentGateway, uuidGenerator },
    }),

    // METABASE
    ...dashboardUseCases(gateways.dashboardGateway, gateways.timeGateway),

    // email validation
    validateEmail: makeValidateEmail({
      deps: { emailValidationGateway: gateways.emailValidationGateway },
    }),

    htmlToPdf: makeHtmlToPdf({
      deps: {
        pdfGeneratorGateway: gateways.pdfGeneratorGateway,
        immersionFacileDomain: config.immersionFacileDomain,
      },
    }),
    insertEstablishmentAggregateFromForm,
    updateEstablishmentAggregateFromForm:
      makeUpdateEstablishmentAggregateFromForm({
        deps: {
          addressGateway: gateways.addressApi,
          uuidGenerator,
          timeGateway,
          createNewEvent,
          immersionBaseUrl: config.immersionFacileBaseUrl,
          saveNotificationAndRelatedEvent,
        },
        uowPerformer,
      }),
    addEstablishmentLead: makeAddEstablishmentLead({
      uowPerformer,
      deps: { timeGateway },
    }),

    // notifications
    notifyFranceTravailUserAdvisorOnConventionFullySigned:
      makeNotifyFranceTravailUserAdvisorOnConventionFullySigned({
        uowPerformer,
        deps: {
          saveNotificationAndRelatedEvent,
          config,
        },
      }),

    notifyConfirmationEstablishmentCreated:
      makeNotifyConfirmationEstablishmentCreated({
        deps: { saveNotificationAndRelatedEvent },
        uowPerformer,
      }),

    notifyPassEmploiOnNewEstablishmentAggregateInsertedFromForm:
      makeNotifyPassEmploiOnNewEstablishmentAggregateInsertedFromForm({
        deps: {
          passEmploiGateway: gateways.passEmploiGateway,
        },
        uowPerformer,
      }),

    notifyEstablishmentAdminsThatUserRightIsPending:
      makeNotifyEstablishmentAdminsThatUserRightIsPending({
        uowPerformer,
        deps: {
          saveNotificationAndRelatedEvent,
          config,
        },
      }),
    notifyThatEstablishmentIsBanned: makeNotifyThatEstablishmentIsBanned({
      uowPerformer,
      deps: {
        saveNotificationAndRelatedEvent,
        immersionBaseUrl: config.immersionFacileBaseUrl,
        timeGateway,
      },
    }),
    addExchangeToDiscussion: makeAddExchangeToDiscussion({
      deps: {
        createNewEvent,
        saveNotificationAndRelatedEvent,
        timeGateway,
        immersionFacileBaseUrl: config.immersionFacileBaseUrl,
      },
      uowPerformer,
    }),

    markEstablishmentLeadAsRegistrationAccepted:
      makeMarkEstablishmentLeadAsRegistrationAccepted({
        uowPerformer,
        deps: {
          timeGateway,
        },
      }),
    markEstablishmentLeadAsRegistrationRejected:
      makeMarkEstablishmentLeadAsRegistrationRejected({
        uowPerformer,
        deps: {
          timeGateway,
        },
      }),

    deleteEstablishment: makeDeleteEstablishment({
      uowPerformer,
      deps: {
        timeGateway,
        saveNotificationAndRelatedEvent,
        createNewEvent,
      },
    }),

    getEstablishmentPublicOptionsByFilters:
      makeGetEstablishmentPublicOptionsByFilters({
        uowPerformer,
      }),

    registerUserOnEstablishment: makeRegisterUserOnEstablishment({
      uowPerformer,
      deps: {
        timeGateway,
        createNewEvent,
      },
    }),

    getDiscussionById: makeGetDiscussionById({
      uowPerformer,
    }),

    getDiscussionEstablishmentContactInfo:
      makeGetDiscussionEstablishmentContactInfo({
        uowPerformer,
      }),

    sendExchangeToRecipient: makeSendExchangeToRecipient({
      deps: {
        domain: config.immersionFacileDomain,
        notificationGateway: gateways.notification,
        saveNotificationAndRelatedEvent,
        config,
      },
      uowPerformer,
    }),

    revokeApiConsumer: makeRevokeApiConsumer({
      uowPerformer,
      deps: {
        createNewEvent,
        timeGateway,
      },
    }),

    renewApiConsumerKey: makeRenewApiConsumerKey({
      uowPerformer,
      deps: {
        createNewEvent,
        generateApiConsumerJwt,
        timeGateway,
      },
    }),

    notifyContactRequest: makeNotifyContactRequest({
      deps: {
        domain: config.immersionFacileDomain,
        immersionFacileBaseUrl: config.immersionFacileBaseUrl,
        saveNotificationAndRelatedEvent,
      },
      uowPerformer,
    }),

    notifyAgencyHasBeenPutOnHold: makeNotifyAgencyHasBeenPutOnHold({
      uowPerformer,
      deps: { saveNotificationAndRelatedEvent },
    }),

    notifyDelegationConventionReminder: makeNotifyDelegationConventionReminder({
      uowPerformer,
      deps: { saveNotificationAndRelatedEvent },
    }),

    getFeatureFlags: useCaseBuilder("GetFeatureFlags")
      .notTransactional()
      .build(() => queries.featureFlag.getAll())({}),

    getLink: makeGetLink({
      uowPerformer,
      deps: {
        timeGateway,
      },
    }),

    getApiConsumerById: useCaseBuilder("GetApiConsumerById")
      .withInput(z.string())
      .build(({ inputParams, uow }) =>
        uow.apiConsumerRepository.getById(inputParams),
      )({ uowPerformer }),

    getAllApiConsumers: useCaseBuilder("GetAllApiConsumers")
      .withCurrentUser<ConnectedUser>()
      .build(({ currentUser, uow }) => {
        throwIfNotAdmin(currentUser);
        return uow.apiConsumerRepository.getAll();
      })({ uowPerformer }),

    isFormEstablishmentWithSiretAlreadySaved: useCaseBuilder(
      "IsFormEstablishmentWithSiretAlreadySaved",
    )
      .withInput(siretSchema)
      .build(({ inputParams: siret, uow }) =>
        uow.establishmentAggregateRepository.hasEstablishmentAggregateWithSiret(
          siret,
        ),
      )({ uowPerformer }),
    retrieveFormEstablishmentFromAggregates:
      makeRetrieveFormEstablishmentFromAggregates({ uowPerformer }),

    getImmersionFacileAgencyIdByKind: useCaseBuilder(
      "GetImmersionFacileAgencyIdByKind",
    ).build(async ({ uow }) => {
      const agencyId = await uow.agencyRepository.getImmersionFacileAgencyId();
      if (!agencyId)
        throw new NotFoundError(
          "No agency found with kind immersion-facilitee",
        );
      return agencyId;
    })({ uowPerformer }),

    getLastNotifications: useCaseBuilder("GetLastNotifications")
      .withCurrentUser<ConnectedUser>()
      .build(({ currentUser, uow }) => {
        throwIfNotAdmin(currentUser);
        return uow.notificationRepository.getLastNotifications();
      })({ uowPerformer }),

    findSimilarConventions: useCaseBuilder("FindSimilarConventions")
      .withInput(findSimilarConventionsParamsSchema)
      .withOutput<{ similarConventionIds: ConventionId[] }>()
      .notTransactional()
      .build(
        ({
          inputParams: {
            beneficiaryBirthdate,
            beneficiaryLastName,
            codeAppellation,
            dateStart,
            siret,
          },
        }) => {
          const dateStartToMatch = new Date(dateStart);
          const numberOfDaysTolerance = 7;

          return queries.convention
            .getConventionIdsByFilters({
              filters: {
                withSirets: [siret],
                withBeneficiary: {
                  birthdate: beneficiaryBirthdate,
                  lastName: beneficiaryLastName,
                },
                withAppelationCodes: [codeAppellation],
                withDateStart: {
                  to: addDays(dateStartToMatch, numberOfDaysTolerance),
                  from: subDays(dateStartToMatch, numberOfDaysTolerance),
                },
                withStatuses: [
                  "ACCEPTED_BY_COUNSELLOR",
                  "ACCEPTED_BY_VALIDATOR",
                  "IN_REVIEW",
                  "PARTIALLY_SIGNED",
                  "READY_TO_SIGN",
                ],
              },
              limit: 20,
            })
            .then((similarConventionIds) => ({ similarConventionIds }));
        },
      )({}),

    // romes
    appellationSearch: makeAppellationSearch({
      uowPerformer,
      deps: {
        appellationsGateway: gateways.appellationsGateway,
      },
    }),
    getOffers: makeGetOffers({
      uowPerformer,
      deps: {
        uuidGenerator,
      },
    }),

    getExternalOffers: makeGetExternalOffers({
      uowPerformer,
      deps: {
        uuidGenerator,
        laBonneBoiteGateway: gateways.laBonneBoiteGateway,
      },
    }),
    addAgenciesAndUsers: makeAddAgenciesAndUsers({
      uowPerformer,
      deps: {
        uuidGenerator,
        timeGateway,
        addressGateway: gateways.addressApi,
      },
    }),

    updateUserForAgency: makeUpdateUserForAgency({
      uowPerformer,
      deps: {
        createNewEvent,
        timeGateway,
      },
    }),

    linkFranceTravailUsersToTheirAgencies:
      makeLinkFranceTravailUsersToTheirAgencies({
        uowPerformer,
        deps: {
          timeGateway,
          createNewEvent,
        },
      }),

    getConnectedUser: makeGetConnectedUser({
      uowPerformer,
      deps: {
        dashboardGateway: gateways.dashboardGateway,
        timeGateway,
      },
    }),

    getConnectedUsers: makeGetConnectedUsers({
      uowPerformer,
    }),

    deleteUser: makeDeleteUser({
      uowPerformer,
      deps: { timeGateway, createNewEvent },
    }),

    getLastBroadcastFeedback: makeGetLastBroadcastFeedback({
      uowPerformer,
    }),

    getConventionsWithErroredBroadcastFeedback:
      makeGetConventionsWithErroredBroadcastFeedback({
        uowPerformer,
      }),

    rejectUserForAgency: makeRejectUserForAgency({
      uowPerformer,
      deps: {
        createNewEvent,
        timeGateway,
      },
    }),

    closeAgencyAndTransfertConventions: makeCloseAgencyAndTransferConventions({
      uowPerformer,
      deps: { createNewEvent, timeGateway },
    }),

    updateAgencyReferringToUpdatedAgency:
      makeUpdateAgencyReferringToUpdatedAgency({
        uowPerformer,
        deps: {
          timeGateway,
          createNewEvent,
        },
      }),

    updateAgency: makeUpdateAgency({
      uowPerformer,
      deps: {
        createNewEvent,
        timeGateway,
      },
    }),

    getAgencyPublicInfoById: makeGetAgencyPublicInfoById({ uowPerformer }),

    listAgencyOptionsByFilter: makeListAgencyOptionsByFilter({
      uowPerformer,
    }),

    addAgency: makeAddAgency({
      uowPerformer,
      deps: {
        createNewEvent,
        siretGateway: gateways.siret,
        timeGateway,
        uuidGenerator,
      },
    }),

    registerAgencyToConnectedUser: makeRegisterAgencyToConnectedUser({
      uowPerformer,
      deps: {
        createNewEvent,
        timeGateway,
      },
    }),

    broadcastToFranceTravailOnConventionUpdates:
      makeBroadcastToFranceTravailOrchestrator({
        uowPerformer,
        broadcastToFranceTravailOnConventionUpdates,
        eventType: "CONVENTION_UPDATED",
      }),

    broadcastToFranceTravailOnAssessmentCreated:
      makeBroadcastToFranceTravailOrchestrator({
        uowPerformer,
        broadcastToFranceTravailOnConventionUpdates,
        eventType: "ASSESSMENT_CREATED",
      }),

    broadcastToPartnersOnConventionUpdates:
      makeBroadcastToPartnersOnConventionUpdates({
        uowPerformer,
        deps: {
          subscribersGateway: gateways.subscribersGateway,
          timeGateway,
          consumerNamesUsingRomeV3: config.apiConsumerNamesUsingRomeV3,
        },
      }),
    notifyEstablishmentThatAssessmentWasCreated:
      makeNotifyEstablishmentThatAssessmentWasCreated({
        uowPerformer,
        deps: {
          saveNotificationAndRelatedEvent,
          generateLink: generateConventionMagicLinkUrl,
          timeGateway,
        },
      }),
    getAgencyById: makeGetAgencyById({
      uowPerformer,
    }),
    renewExpiredJwt: makeRenewExpiredJwt({
      uowPerformer,
      deps: {
        config,
        timeGateway,
        shortLinkIdGeneratorGateway: gateways.shortLinkGenerator,
        generateConnectedUserLoginUrl,
        generateConventionMagicLinkUrl,
        generateEmailAuthCodeUrl,
        saveNotificationAndRelatedEvent,
        createNewEvent,
      },
    }),
    initiateLoginByOAuth: makeInitiateLoginByOAuth({
      uowPerformer,
      deps: {
        oAuthGateways: {
          proConnect: gateways.proConnectOAuthGateway,
          ftConnect: gateways.ftConnectGateway,
        },
        uuidGenerator,
      },
    }),
    afterOAuthSuccessRedirection: makeAfterOAuthSuccess({
      uowPerformer,
      deps: {
        createNewEvent,
        proConnectOAuthGateway: gateways.proConnectOAuthGateway,
        ftConnectGateway: gateways.ftConnectGateway,
        uuidGenerator,
        generateConnectedUserLoginUrl,
        verifyEmailAuthCodeJwt,
        immersionFacileBaseUrl: config.immersionFacileBaseUrl,
        timeGateway,
      },
    }),
    getOAuthLogoutUrl: makeGetOAuthLogoutUrl({
      uowPerformer,
      deps: {
        proConnectOAuthGateway: gateways.proConnectOAuthGateway,
      },
    }),
    createAssessment: makeCreateAssessment({
      uowPerformer,
      deps: { createNewEvent },
    }),
    deleteAssessment: makeDeleteAssessment({
      uowPerformer,
      deps: {
        createNewEvent,
      },
    }),
    signAssessment: makeSignAssessment({
      uowPerformer,
      deps: {
        createNewEvent,
        timeGateway,
      },
    }),
    getAssessmentByConventionId: makeGetAssessmentByConventionId({
      uowPerformer,
    }),
    notifyBeneficiaryThatAssessmentIsCreated:
      makeNotifyBeneficiaryThatAssessmentIsCreated({
        uowPerformer,
        deps: {
          saveNotificationAndRelatedEvent,
          generateConventionMagicLinkUrl,
          timeGateway,
        },
      }),
    notifyBeneficiaryThatAssessmentNeedsSignature:
      makeNotifyBeneficiaryThatAssessmentNeedsSignature({
        uowPerformer,
        deps: {
          saveNotificationAndRelatedEvent,
          generateConventionMagicLinkUrl,
          timeGateway,
          shortLinkIdGeneratorGateway: gateways.shortLinkGenerator,
          config,
        },
      }),
    notifyActorsThatAssessmentDeleted: makeNotifyActorsThatAssessmentDeleted({
      uowPerformer,
      deps: {
        saveNotificationAndRelatedEvent,
        generateConventionMagicLinkUrl,
        timeGateway,
        shortLinkIdGeneratorGateway: gateways.shortLinkGenerator,
        config,
      },
    }),
    notifyAllActorsThatConventionHasBeenTransferred:
      makeNotifyAllActorsThatConventionTransferred({
        uowPerformer,
        deps: {
          saveNotificationAndRelatedEvent,
          generateConventionMagicLinkUrl,
          timeGateway,
          shortLinkIdGeneratorGateway: gateways.shortLinkGenerator,
          config,
        },
      }),
    listActiveSubscriptions: makeListActiveSubscriptions({
      uowPerformer,
    }),
    createUserForAgency: makeCreateUserForAgency({
      uowPerformer,
      deps: {
        timeGateway,
        createNewEvent,
        dashboardGateway: gateways.dashboardGateway,
      },
    }),
    removeUserFromAgency: makeRemoveUserFromAgency({
      uowPerformer,
      deps: { createNewEvent, timeGateway },
    }),
    broadcastConventionAgain: makeBroadcastConventionAgain({
      uowPerformer,
      deps: { createNewEvent, timeGateway },
    }),
    getApiConsumersByConvention: makeGetApiConsumersByConvention({
      uowPerformer,
    }),
    markDiscussionLinkedToConvention: makeMarkDiscussionLinkedToConvention({
      uowPerformer,
      deps: {
        timeGateway,
      },
    }),
    contactRequestReminder: makeContactRequestReminder({
      deps: {
        domain: config.immersionFacileDomain,
        saveNotificationAndRelatedEvent,
        timeGateway,
      },
      uowPerformer,
    }),
    addFormEstablishmentBatch: makeAddFormEstablishmentBatch({
      deps: {
        insertEstablishmentAggregateFromForm,
        uowPerformer,
      },
    }),
    getEstablishmentStats: makeGetEstablishmentStats({
      uowPerformer,
    }),
    getEstablishmentNameAndAdmins: makeGetEstablishmentNameAndAdmins({
      uowPerformer,
    }),
    updateDiscussionStatus: makeUpdateDiscussionStatus({
      uowPerformer,
      deps: {
        timeGateway,
        createNewEvent,
      },
    }),
    updateMarketingEstablishmentContactList:
      makeUpdateMarketingEstablishmentContactList({
        deps: {
          establishmentMarketingGateway: gateways.establishmentMarketingGateway,
          timeGateway,
          siretGateway: gateways.siret,
        },
        uowPerformer,
      }),

    banEstablishment: makeBanEstablishment({
      uowPerformer,
      deps: { createNewEvent },
    }),
    getUsers: makeGetUsers({
      uowPerformer,
    }),
    getExternalSearchResult: makeGetExternalSearchResult({
      deps: {
        laBonneBoiteGateway: gateways.laBonneBoiteGateway,
      },
      uowPerformer,
    }),
    getSearchResultBySearchQuery: makeGetSearchResultBySearchQuery({
      deps: { establishmentAggregateQueries: queries.establishmentAggregate },
    }),
    contactEstablishment: makeContactEstablishment({
      uowPerformer,
      deps: {
        createNewEvent,
        uuidGenerator,
        immersionFacileBaseUrl: config.immersionFacileBaseUrl,
        timeGateway,
        minimumNumberOfDaysBetweenSimilarContactRequests:
          config.minimumNumberOfDaysBetweenSimilarContactRequests,
      },
    }),
    getAllNafSections: makeGetAllNafSections({
      deps: {
        withCache: gateways.withCache,
        uowPerformer,
      },
    }),
    sendTicketToCrisp: makeSendSupportTicketToCrisp({
      uowPerformer,
      deps: { crispApi: gateways.crispGateway },
    }),
    notifyCandidateThatContactRequestHasBeenSent:
      makeNotifyCandidateThatContactRequestHasBeenSent({
        uowPerformer,
        deps: { saveNotificationAndRelatedEvent, config },
      }),
    sendSignatureLink: makeSendSignatureLink({
      uowPerformer,
      deps: {
        timeGateway,
        config,
        saveNotificationAndRelatedEvent,
        generateConventionMagicLinkUrl,
        shortLinkIdGeneratorGateway: gateways.shortLinkGenerator,
        createNewEvent,
      },
    }),
    sendAssessmentLink: makeSendAssessmentLink({
      uowPerformer,
      deps: {
        timeGateway,
        config,
        saveNotificationAndRelatedEvent,
        generateConventionMagicLinkUrl,
        shortLinkIdGeneratorGateway: gateways.shortLinkGenerator,
        createNewEvent,
      },
    }),
    sendAssessmentSignatureReminder: makeSendAssessmentSignatureReminder({
      uowPerformer,
      deps: {
        timeGateway,
        config,
        saveNotificationAndRelatedEvent,
        generateConventionMagicLinkUrl,
        shortLinkIdGeneratorGateway: gateways.shortLinkGenerator,
        createNewEvent,
      },
    }),
    getConventionsForAgencyUser: makeGetConventionsForAgencyUser({
      uowPerformer,
      deps: { timeGateway },
    }),
    getConventionsWithUnfinalizedAssessment:
      makeGetConventionsWithUnfinalizedAssessment({
        uowPerformer,
        deps: { timeGateway },
      }),
    transferConventionToAgency: makeTransferConventionToAgency({
      uowPerformer,
      deps: { createNewEvent },
    }),
    removeConventionFTAdvisorIfAgencyIsNotFranceTravail:
      makeRemoveConventionFTAdvisorIfAgencyIsNotFranceTravail({
        uowPerformer,
      }),
    editConventionCounsellorName: makeEditConventionCounsellorName({
      uowPerformer,
      deps: { createNewEvent },
    }),
    editConventionWithFinalStatus: makeEditConventionWithFinalStatus({
      uowPerformer,
      deps: { createNewEvent },
    }),
    createOrUpdateConventionTemplate: makeCreateOrUpdateConventionTemplate({
      uowPerformer,
      deps: { timeGateway, createNewEvent },
    }),
    deleteConventionTemplate: makeDeleteConventionTemplate({
      uowPerformer,
      deps: { createNewEvent },
    }),
    getConventionTemplatesForCurrentUser:
      makeGetConventionTemplatesForCurrentUser({ uowPerformer }),
    warnSenderThatMessageCouldNotBeDelivered:
      makeWarnSenderThatMessageCouldNotBeDelivered({
        uowPerformer,
        deps: { saveNotificationAndRelatedEvent },
      }),
    initiateLoginByEmail: makeInitiateLoginByEmail({
      uowPerformer,
      deps: {
        config,
        timeGateway,
        uuidGenerator,
        saveNotificationAndRelatedEvent,
        generateEmailAuthCodeUrl,
      },
    }),
    getDiscussions: makeGetDiscussionsForUser({
      uowPerformer,
    }),
    markDiscussionDeprecatedAndNotify: makeMarkDiscussionDeprecatedAndNotify({
      uowPerformer,
      deps: {
        saveNotificationsBatchAndRelatedEvent,
        config,
        timeGateway,
      },
    }),
    notifyBeneficiaryToFollowUpContactRequest:
      makeNotifyBeneficiaryToFollowUpContactRequest({
        uowPerformer,
        deps: { saveNotificationsBatchAndRelatedEvent, config },
      }),
    getConventionDraftById: makeGetConventionDraftById({ uowPerformer }),
    deleteConventionDraft: makeDeleteConventionDraft({ uowPerformer }),
    makeRequestOldConventionDraftsDeletion:
      makeRequestOldConventionDraftsDeletion({
        uowPerformer,
        deps: { createNewEvent, timeGateway },
      }),
    updateInvalidPhone: makeUpdateInvalidPhone({
      uowPerformer,
    }),
    notifyAgencyDelegationContact: makeNotifyAgencyDelegationContact({
      uowPerformer,
      deps: { saveNotificationAndRelatedEvent },
    }),
    notifyAgencyThatAssessmentIsCreatedWithStatusCompletedOrPartiallyCompleted:
      makeNotifyAgencyThatAssessmentIsCreatedWithStatusCompletedOrPartiallyCompleted(
        {
          uowPerformer,
          deps: {
            saveNotificationAndRelatedEvent,
            config,
          },
        },
      ),
    notifyAgencyThatAssessmentIsCreatedWithStatusDidNotShow:
      makeNotifyAgencyThatAssessmentIsCreatedWithStatusDidNotShow({
        uowPerformer,
        deps: {
          saveNotificationAndRelatedEvent,
        },
      }),
    notifyAllActorsOfFinalConventionValidation:
      makeNotifyAllActorsOfFinalConventionValidation({
        uowPerformer,
        deps: {
          saveNotificationAndRelatedEvent,
          generateConventionMagicLinkUrl,
          timeGateway,
          config,
          shortLinkIdGeneratorGateway: gateways.shortLinkGenerator,
        },
      }),

    notifyAllActorsThatConventionIsCancelled:
      makeNotifyAllActorsThatConventionIsCancelled({
        uowPerformer,
        deps: {
          saveNotificationAndRelatedEvent,
        },
      }),
    notifyAllActorsThatConventionIsDeprecated:
      makeNotifyAllActorsThatConventionIsDeprecated({
        uowPerformer,
        deps: {
          saveNotificationAndRelatedEvent,
        },
      }),
    notifyAllActorsThatConventionIsRejected:
      makeNotifyAllActorsThatConventionIsRejected({
        uowPerformer,
        deps: {
          saveNotificationAndRelatedEvent,
        },
      }),
    notifyConventionDraftSaved: makeNotifyConventionDraftSaved({
      uowPerformer,
      deps: {
        config,
        saveNotificationAndRelatedEvent,
        shortLinkIdGeneratorGateway: gateways.shortLinkGenerator,
      },
    }),
    notifyConventionReminder: makeNotifyConventionReminder({
      uowPerformer,
      deps: {
        config,
        generateConventionMagicLinkUrl,
        saveNotificationsBatchAndRelatedEvent,
        shortLinkIdGeneratorGateway: gateways.shortLinkGenerator,
        timeGateway,
      },
    }),
    notifyLastSigneeThatConventionHasBeenSigned:
      makeNotifyLastSigneeThatConventionHasBeenSigned({
        uowPerformer,
        deps: {
          saveNotificationAndRelatedEvent,
          generateConventionMagicLinkUrl,
          timeGateway,
        },
      }),
    notifyNewConventionNeedsReview: makeNotifyNewConventionNeedsReview({
      uowPerformer,
      deps: {
        saveNotificationAndRelatedEvent,
        config,
      },
    }),
    notifySignatoriesThatConventionSubmittedNeedsSignature:
      makeNotifySignatoriesThatConventionSubmittedNeedsSignature({
        uowPerformer,
        deps: {
          config,
          generateConventionMagicLinkUrl,
          saveNotificationAndRelatedEvent,
          shortLinkIdGeneratorGateway: gateways.shortLinkGenerator,
          timeGateway,
        },
      }),
    notifySignatoriesThatConventionSubmittedNeedsSignatureAfterNotification:
      makeNotifySignatoriesThatConventionSubmittedNeedsSignatureAfterModification(
        {
          uowPerformer,
          deps: {
            timeGateway,
            shortLinkIdGeneratorGateway: gateways.shortLinkGenerator,
            config,
            saveNotificationAndRelatedEvent,
            generateConventionMagicLinkUrl,
          },
        },
      ),
    notifyUserThatArchivedConventionRequestWasReceived:
      makeNotifyUserThatArchivedConventionRequestWasReceived({
        uowPerformer,
        deps: {
          saveNotificationAndRelatedEvent,
        },
      }),
    notifyToAgencyConventionSubmitted: makeNotifyToAgencyConventionSubmitted({
      uowPerformer,
      deps: {
        saveNotificationAndRelatedEvent,
        config,
      },
    }),
    notifyUserAgencyRightChanged: makeNotifyUserAgencyRightChanged({
      uowPerformer,
      deps: {
        saveNotificationAndRelatedEvent,
      },
    }),
    notifyUserAgencyRightRejected: makeNotifyUserAgencyRightRejected({
      uowPerformer,
      deps: {
        saveNotificationAndRelatedEvent,
      },
    }),
    notifyUserThatAgencyRegistrationRequestWasReceived:
      makeNotifyUserThatAgencyRegistrationRequestWasReceived({
        uowPerformer,
        deps: {
          saveNotificationAndRelatedEvent,
          immersionBaseUrl: config.immersionFacileBaseUrl,
        },
      }),
    subscribeToWebhook: makeSubscribeToWebhook({
      uowPerformer,
      deps: {
        uuidGenerator,
        timeGateway,
      },
    }),
    saveApiConsumer: makeSaveApiConsumer({
      uowPerformer,
      deps: {
        createNewEvent,
        generateApiConsumerJwt,
        timeGateway,
      },
    }),
  } satisfies Record<string, InstantiatedUseCase<any, any, any>>;
};

const dashboardUseCases = (
  dashboardGateway: DashboardGateway,
  timeGateway: TimeGateway,
) => ({
  getDashboard: makeGetDashboardUrl({
    deps: { dashboardGateway, timeGateway },
  }),
});

export type UseCases = ReturnType<typeof createUseCases>;

export type InstantiatedUseCase<
  Input = void,
  Output = void,
  JwtPayload = void,
> = {
  useCaseName: string;
  execute: (param: Input, jwtPayload?: JwtPayload) => Promise<Output>;
};
