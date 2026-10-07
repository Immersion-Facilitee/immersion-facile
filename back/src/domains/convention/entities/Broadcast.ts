import { uniq } from "ramda";
import type {
  AgencyDto,
  AgencyId,
  AgencyKind,
  ApiConsumerName,
  BroadcastFeedback,
  FeatureFlags,
} from "shared";
import {
  broadcastToFtConsumerName,
  broadcastToPartnersServiceName,
} from "../../core/saved-errors/ports/BroadcastFeedbacksRepository";
import type { UnitOfWork } from "../../core/unit-of-work/ports/UnitOfWork";
import { getLinkedAgenciesFromAgencyId } from "./Convention";

export const shouldBroadcastToFranceTravail = ({
  agency,
  featureFlags,
  refersToAgency,
}: {
  agency: AgencyDto;
  refersToAgency: AgencyDto | null;
  featureFlags: FeatureFlags;
}): boolean => {
  const isBroadcastToFranceTravailAllowedForKind = (agencyKind: AgencyKind) => {
    if (agency.kind === agencyKind) return true;
    if (refersToAgency && refersToAgency.kind === "france-travail") return true;
    return false;
  };

  if (isBroadcastToFranceTravailAllowedForKind("france-travail")) return true;

  if (
    featureFlags.enableBroadcastOfMissionLocaleToFT.isActive &&
    isBroadcastToFranceTravailAllowedForKind("mission-locale")
  )
    return true;

  if (
    featureFlags.enableBroadcastOfConseilDepartementalToFT.isActive &&
    isBroadcastToFranceTravailAllowedForKind("conseil-departemental")
  )
    return true;

  if (
    featureFlags.enableBroadcastOfCapEmploiToFT.isActive &&
    isBroadcastToFranceTravailAllowedForKind("cap-emploi")
  )
    return true;

  return false;
};

export const isBroadcastFeedbackRelevant = (
  feedback: BroadcastFeedback,
  relevantConsumerNames: ApiConsumerName[],
): boolean => relevantConsumerNames.includes(feedback.consumerName);

export const hasPriorSuccessfulBroadcast = (
  broadcastFeedbacks: BroadcastFeedback[],
): boolean =>
  broadcastFeedbacks.some(
    (broadcastFeedback) =>
      (broadcastFeedback.consumerName === broadcastToFtConsumerName &&
        broadcastFeedback.response?.httpStatus === 201) ||
      (broadcastFeedback.serviceName === broadcastToPartnersServiceName &&
        !broadcastFeedback.subscriberErrorFeedback),
  );

export const getRelevantBroadcastConsumerNames = async (
  uow: UnitOfWork,
  agencyId: AgencyId,
): Promise<ApiConsumerName[]> => {
  const { agency, refersToAgency } = await getLinkedAgenciesFromAgencyId(
    uow,
    agencyId,
  );

  const agencyIds = refersToAgency
    ? [agency.id, refersToAgency.id]
    : [agency.id];
  const agencyKinds = refersToAgency
    ? [agency.kind, refersToAgency.kind]
    : [agency.kind];

  const partnerConsumerNames = (
    await uow.apiConsumerRepository.getByFilters({
      agencyIds,
      agencyKinds,
    })
  )
    .filter(
      (apiConsumer) => apiConsumer.rights.convention.subscriptions.length !== 0,
    )
    .map(({ name }) => name);

  return uniq([
    ...(shouldBroadcastToFranceTravail({
      agency,
      refersToAgency,
      featureFlags: await uow.featureFlagQueries.getAll(),
    })
      ? [broadcastToFtConsumerName]
      : []),
    ...partnerConsumerNames,
  ]);
};
