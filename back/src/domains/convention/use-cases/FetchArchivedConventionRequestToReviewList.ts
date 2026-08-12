import { fromPairs } from "ramda";
import {
  type ArchivedConventionRequestToReviewListDto,
  type ConnectedUser,
  errors,
} from "shared";
import type { UnitOfWork } from "../../core/unit-of-work/ports/UnitOfWork";
import { useCaseBuilder } from "../../core/useCaseBuilder";
import type { ArchivedConventionRequestQueries } from "../ports/ArchivedConventionRequestQueries";

export type FetchArchivedConventionRequestToReviewList = ReturnType<
  typeof makeFetchArchivedConventionRequestToReviewList
>;

export const makeFetchArchivedConventionRequestToReviewList = useCaseBuilder(
  "FetchArchivedConventionRequestToReviewList",
)
  .withCurrentUser<ConnectedUser>()
  .withOutput<ArchivedConventionRequestToReviewListDto>()
  .withDeps<{
    archivedConventionRequestQueries: ArchivedConventionRequestQueries;
  }>()
  .build(
    async ({
      currentUser,
      deps: { archivedConventionRequestQueries },
      uow,
    }) => {
      if (currentUser.isBackofficeAdmin)
        return onBackOfficeAdminRights({
          archivedConventionRequestQueries,
          uow,
        });
      throw errors.user.forbidden({ userId: currentUser.id });
    },
  );

const onBackOfficeAdminRights = ({
  archivedConventionRequestQueries,
  uow,
}: {
  archivedConventionRequestQueries: ArchivedConventionRequestQueries;
  uow: UnitOfWork;
}): Promise<ArchivedConventionRequestToReviewListDto> =>
  archivedConventionRequestQueries
    .getFirstOldestArchivedConventionRequestToReviewList()
    .then(async (list) => ({
      list,
      requesterUsersByUserId: fromPairs(
        await uow.userRepository
          .getByIds(list.map(({ userId }) => userId))
          .then((users) => users.map((user) => [user.id, user])),
      ),
    }))
    .then(({ list, requesterUsersByUserId }) =>
      list.map(({ id, createdAt, reason, userId }) => ({
        id,
        reason,
        createdAt,
        requester: {
          firstname: requesterUsersByUserId[userId].firstName,
          lastname: requesterUsersByUserId[userId].lastName,
          email: requesterUsersByUserId[userId].email,
        },
      })),
    );
