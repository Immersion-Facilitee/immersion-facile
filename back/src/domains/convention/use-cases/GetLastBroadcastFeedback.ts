import {
  allAgencyRoles,
  type BroadcastFeedback,
  type ConnectedUser,
  type ConventionDto,
  type ConventionId,
  type ConventionLastBroadcastFeedbackResponse,
  conventionIdSchema,
  errors,
  isUnvalidatedConventionStatus,
  userHasEnoughRightsOnConvention,
} from "shared";
import { getUserWithRights } from "../../connected-users/helpers/userRights.helper";
import {
  broadcastToFtConsumerName,
  broadcastToPartnersServiceName,
} from "../../core/saved-errors/ports/BroadcastFeedbacksRepository";
import { useCaseBuilder } from "../../core/useCaseBuilder";

export type GetLastBroadcastFeedback = ReturnType<
  typeof makeGetLastBroadcastFeedback
>;
export const makeGetLastBroadcastFeedback = useCaseBuilder(
  "GetLastBroadcastFeedback",
)
  .withInput<ConventionId>(conventionIdSchema)
  .withOutput<ConventionLastBroadcastFeedbackResponse>()
  .withCurrentUser<ConnectedUser>()
  .build(async ({ uow, currentUser, inputParams }) => {
    const convention = await uow.conventionRepository.getById(inputParams);
    if (!convention)
      throw errors.convention.notFound({
        conventionId: inputParams,
      });

    const userWithRights = await getUserWithRights(uow, currentUser.id);

    if (
      userHasEnoughRightsOnConvention(userWithRights, convention, [
        ...allAgencyRoles,
      ])
    ) {
      const broadcastFeedbacks =
        await uow.broadcastFeedbacksRepository.getBroadcastFeedbacksByConventionId(
          inputParams,
        );
      const broadcastFeedback = broadcastFeedbacks.at(-1);

      if (!broadcastFeedback) return { broadcastFeedback: null };

      return {
        broadcastFeedback,
        shouldBeHandled: shouldBroadcastFeedbackBeHandled(
          convention,
          broadcastFeedback,
          broadcastFeedbacks,
        ),
      };
    }
    throw errors.user.forbidden({
      userId: currentUser.id,
    });
  });

const shouldBroadcastFeedbackBeHandled = (
  convention: ConventionDto,
  broadcastFeedback: BroadcastFeedback,
  allBroadcastFeedbacks: BroadcastFeedback[],
): boolean => {
  if (
    !broadcastFeedback.subscriberErrorFeedback ||
    broadcastFeedback.handledByAgency
  )
    return false;

  if (new Date(convention.dateSubmission) < new Date("2025-01-01"))
    return false;

  if (isUnvalidatedConventionStatus(convention.status))
    return hasPriorSuccessfulBroadcast(allBroadcastFeedbacks);

  return true;
};

const hasPriorSuccessfulBroadcast = (
  broadcastFeedbacks: BroadcastFeedback[],
): boolean =>
  broadcastFeedbacks.some(
    (broadcastFeedback) =>
      (broadcastFeedback.consumerName === broadcastToFtConsumerName &&
        broadcastFeedback.response?.httpStatus === 201) ||
      (broadcastFeedback.serviceName === broadcastToPartnersServiceName &&
        !broadcastFeedback.subscriberErrorFeedback),
  );
