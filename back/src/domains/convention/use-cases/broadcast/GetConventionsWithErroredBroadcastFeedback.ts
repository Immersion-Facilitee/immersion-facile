import {
  type AgencyId,
  type ApiConsumerName,
  type ConnectedUser,
  type ConventionWithBroadcastFeedbackReadDto,
  type DataWithPagination,
  errors,
  type GetConventionsWithErroredBroadcastFeedbackParams,
  getConventionsWithErroredBroadcastFeedbackParamsSchema,
  getPaginationParamsForWeb,
} from "shared";
import { useCaseBuilder } from "../../../core/useCaseBuilder";
import { getRelevantBroadcastConsumerNames } from "../../entities/Broadcast";

export type GetConventionsWithErroredBroadcastFeedback = ReturnType<
  typeof makeGetConventionsWithErroredBroadcastFeedback
>;

export const makeGetConventionsWithErroredBroadcastFeedback = useCaseBuilder(
  "GetConventionsWithErroredBroadcastFeedback",
)
  .withInput<GetConventionsWithErroredBroadcastFeedbackParams>(
    getConventionsWithErroredBroadcastFeedbackParamsSchema,
  )
  .withOutput<DataWithPagination<ConventionWithBroadcastFeedbackReadDto>>()
  .withCurrentUser<ConnectedUser>()
  .build(async ({ inputParams, uow, currentUser }) => {
    const { filters } = inputParams;

    const pagination = getPaginationParamsForWeb(inputParams.pagination);

    const userAgencyIds = currentUser.agencyRights
      .filter((agencyRight) => agencyRight.roles.length > 0)
      .map((agencyRight) => agencyRight.agency.id);

    const relevantConsumerNamesByAgencyId: Record<AgencyId, ApiConsumerName[]> =
      Object.fromEntries(
        await Promise.all(
          userAgencyIds.map(
            async (agencyId): Promise<[AgencyId, ApiConsumerName[]]> => [
              agencyId,
              await getRelevantBroadcastConsumerNames(uow, agencyId),
            ],
          ),
        ),
      );

    const result =
      await uow.conventionQueries.getConventionsWithErroredBroadcastFeedbackForAgencyUser(
        {
          userAgencyIds,
          pagination,
          filters,
          relevantConsumerNamesByAgencyId,
        },
      );

    return {
      ...result,
      data: result.data.map((conventionWithBroadcastFeedback) => {
        const agencyName = currentUser.agencyRights.find(
          (agencyRight) =>
            agencyRight.agency.id === conventionWithBroadcastFeedback.agencyId,
        )?.agency.name;

        if (!agencyName) {
          throw errors.user.noRightsOnAgency({
            userId: currentUser.id,
            agencyId: conventionWithBroadcastFeedback.agencyId,
          });
        }

        return {
          ...conventionWithBroadcastFeedback,
          agencyName,
        };
      }),
    };
  });
