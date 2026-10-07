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
import { useCaseBuilder } from "../../core/useCaseBuilder";
import {
  getRelevantBroadcastConsumerNames,
  hasPriorSuccessfulBroadcast,
  isBroadcastFeedbackRelevant,
} from "../entities/Broadcast";

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
      const relevantConsumerNames = await getRelevantBroadcastConsumerNames(
        uow,
        convention.agencyId,
      );
      const relevantBroadcastFeedbacks = (
        await uow.broadcastFeedbacksRepository.getBroadcastFeedbacksByConventionId(
          inputParams,
        )
      ).filter((feedback) =>
        isBroadcastFeedbackRelevant(feedback, relevantConsumerNames),
      );
      const broadcastFeedback = relevantBroadcastFeedbacks.at(-1);

      if (!broadcastFeedback) return { broadcastFeedback: null };

      return {
        broadcastFeedback,
        shouldBeHandled: shouldBroadcastFeedbackBeHandled(
          convention,
          broadcastFeedback,
          relevantBroadcastFeedbacks,
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
