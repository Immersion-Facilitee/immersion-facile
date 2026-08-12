import type { KyselyDb } from "../../../../config/pg/kysely/kyselyUtils";
import { PgAgencyGroupRepository } from "../../../agency/adapters/PgAgencyGroupRepository";
import { PgAgencyRepository } from "../../../agency/adapters/PgAgencyRepository";
import { PgDelegationContactRepository } from "../../../agency/adapters/PgDelegationContactRepository";
import { PgArchivedConventionRequestRepository } from "../../../convention/adapters/archived-convention-request/PgArchivedConventionRequestRepository";
import { PgAssessmentRepository } from "../../../convention/adapters/PgAssessmentRepository";
import { PgConventionDraftRepository } from "../../../convention/adapters/PgConventionDraftRepository";
import { PgConventionExternalIdRepository } from "../../../convention/adapters/PgConventionExternalIdRepository";
import { PgConventionQueries } from "../../../convention/adapters/PgConventionQueries";
import { PgConventionRepository } from "../../../convention/adapters/PgConventionRepository";
import { PgConventionsToSyncRepository } from "../../../convention/adapters/PgConventionsToSyncRepository";
import { PgConventionTemplateQueries } from "../../../convention/adapters/PgConventionTemplateQueries";
import { PgNpsRepository } from "../../../convention/adapters/PgNpsRepository";
import { PgBannedEstablishmentRepository } from "../../../establishment/adapters/PgBannedEstablishmentRepository";
import { PgDeletedEstablishmentRepository } from "../../../establishment/adapters/PgDeletedEstablishmentRepository";
import { PgDiscussionRepository } from "../../../establishment/adapters/PgDiscussionRepository";
import { PgEstablishmentAggregateRepository } from "../../../establishment/adapters/PgEstablishmentAggregateRepository";
import { PgEstablishmentLeadQueries } from "../../../establishment/adapters/PgEstablishmentLeadQueries";
import { PgEstablishmentLeadRepository } from "../../../establishment/adapters/PgEstablishmentLeadRepository";
import { PgGroupRepository } from "../../../establishment/adapters/PgGroupRepository";
import { PgSearchMadeRepository } from "../../../establishment/adapters/PgSearchMadeRepository";
import { PgEstablishmentMarketingRepository } from "../../../marketing/adapters/PgEstablishmentMarketingRepository";
import { PgApiConsumerRepository } from "../../api-consumer/adapters/PgApiConsumerRepository";
import { PgOngoingOAuthRepository } from "../../authentication/connected-user/adapters/PgOngoingOAuthRepository";
import { PgUserRepository } from "../../authentication/connected-user/adapters/PgUserRepository";
import { PgConventionFranceTravailAdvisorRepository } from "../../authentication/ft-connect/adapters/PgConventionFranceTravailAdvisorRepository";
import { PgOutboxQueries } from "../../events/adapters/PgOutboxQueries";
import { PgOutboxRepository } from "../../events/adapters/PgOutboxRepository";
import { PgFeatureFlagQueries } from "../../feature-flags/adapters/PgFeatureFlagQueries";
import { PgFeatureFlagRepository } from "../../feature-flags/adapters/PgFeatureFlagRepository";
import { PgNafRepository } from "../../naf/adapters/PgNafRepository";
import { PgNotificationRepository } from "../../notifications/adapters/PgNotificationRepository";
import { PgPhoneRepository } from "../../phone-number/adapters/PgPhoneRepository";
import { PgRomeRepository } from "../../rome/adapters/PgRomeRepository";
import { PgBroadcastFeedbacksRepository } from "../../saved-errors/adapters/PgBroadcastFeedbacksRepository";
import { PgShortLinkRepository } from "../../short-link/adapters/short-link-repository/PgShortLinkRepository";
import { PgStatisticQueries } from "../../statistics/adapters/PgStatisticQueries";
import type { OutOfTransactionQueries, UnitOfWork } from "../ports/UnitOfWork";

export const createPgUow = (transaction: KyselyDb): UnitOfWork => {
  const shortLinkRepository = new PgShortLinkRepository(transaction);
  return {
    agencyRepository: new PgAgencyRepository(transaction),
    agencyGroupRepository: new PgAgencyGroupRepository(transaction),
    apiConsumerRepository: new PgApiConsumerRepository(transaction),
    archivedConventionRequestRepository:
      new PgArchivedConventionRequestRepository(transaction),
    bannedEstablishmentRepository: new PgBannedEstablishmentRepository(
      transaction,
    ),
    userRepository: new PgUserRepository(transaction),
    conventionFranceTravailAdvisorRepository:
      new PgConventionFranceTravailAdvisorRepository(transaction),
    conventionExternalIdRepository: new PgConventionExternalIdRepository(
      transaction,
    ),
    conventionQueries: new PgConventionQueries(transaction),
    conventionRepository: new PgConventionRepository(transaction),
    conventionTemplateQueries: new PgConventionTemplateQueries(transaction),
    conventionsToSyncRepository: new PgConventionsToSyncRepository(transaction),
    delegationContactRepository: new PgDelegationContactRepository(transaction),
    deletedEstablishmentRepository: new PgDeletedEstablishmentRepository(
      transaction,
    ),
    discussionRepository: new PgDiscussionRepository(transaction),
    broadcastFeedbacksRepository: new PgBroadcastFeedbacksRepository(
      transaction,
    ),
    establishmentAggregateRepository: new PgEstablishmentAggregateRepository(
      transaction,
    ),
    establishmentLeadRepository: new PgEstablishmentLeadRepository(transaction),
    establishmentLeadQueries: new PgEstablishmentLeadQueries(transaction),
    groupRepository: new PgGroupRepository(transaction),
    featureFlagQueries: new PgFeatureFlagQueries(transaction),
    featureFlagRepository: new PgFeatureFlagRepository(transaction),
    assessmentRepository: new PgAssessmentRepository(transaction),
    conventionDraftRepository: new PgConventionDraftRepository(transaction),
    npsRepository: new PgNpsRepository(transaction),
    notificationRepository: new PgNotificationRepository(transaction),
    ongoingOAuthRepository: new PgOngoingOAuthRepository(transaction),
    outboxQueries: new PgOutboxQueries(transaction),
    outboxRepository: new PgOutboxRepository(transaction),
    phoneRepository: new PgPhoneRepository(transaction),
    romeRepository: new PgRomeRepository(transaction),
    searchMadeRepository: new PgSearchMadeRepository(transaction),
    establishmentMarketingRepository: new PgEstablishmentMarketingRepository(
      transaction,
    ),
    shortLinkQuery: shortLinkRepository,
    shortLinkRepository,
    statisticQueries: new PgStatisticQueries(transaction),
    nafRepository: new PgNafRepository(transaction),
  };
};

export const createPgQueries = (kysely: KyselyDb): OutOfTransactionQueries => ({
  convention: new PgConventionQueries(kysely),
  establishmentLead: new PgEstablishmentLeadQueries(kysely),
  shortLink: new PgShortLinkRepository(kysely),
  statistic: new PgStatisticQueries(kysely),
  featureFlag: new PgFeatureFlagQueries(kysely),
});
