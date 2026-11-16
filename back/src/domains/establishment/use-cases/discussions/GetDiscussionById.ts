import {
  type ConnectedUserDomainJwtPayload,
  type DiscussionDto,
  type DiscussionId,
  type DiscussionReadDto,
  discussionIdSchema,
  discussionReadSchema,
  type EstablishmentWebSite,
  errors,
} from "shared";
import { validateAndParseZodSchema } from "../../../../config/helpers/validateAndParseZodSchema";
import { createLogger } from "../../../../utils/logger";
import type { UnitOfWork } from "../../../core/unit-of-work/ports/UnitOfWork";
import { useCaseBuilder } from "../../../core/useCaseBuilder";
import { hasUserRightToAccessDiscussion } from "../../helpers/discussion.utils";

export type GetDiscussionById = ReturnType<typeof makeGetDiscussionById>;

export const makeGetDiscussionById = useCaseBuilder("GetDiscussionById")
  .withInput<DiscussionId>(discussionIdSchema)
  .withOutput<DiscussionReadDto>()
  .withCurrentUser<ConnectedUserDomainJwtPayload>()
  .build(async ({ inputParams, uow, currentUser }) => {
    const user = await uow.userRepository.getById(currentUser.userId);

    if (!user) throw errors.user.notFound({ userId: currentUser.userId });

    const discussion = await uow.discussionRepository.getById(inputParams);

    if (!discussion)
      throw errors.discussion.notFound({ discussionId: inputParams });

    const establishmentAggregate =
      await uow.establishmentAggregateRepository.getEstablishmentAggregateBySiret(
        discussion.siret,
      );

    if (!establishmentAggregate)
      throw errors.establishment.notFound({ siret: discussion.siret });

    if (
      !(await hasUserRightToAccessDiscussion(
        user,
        discussion,
        establishmentAggregate.userRights,
      ))
    )
      throw errors.discussion.accessForbidden({
        discussionId: inputParams,
        userId: currentUser.userId,
      });
    return makeDiscussionRead({
      discussion,
      establishmentWebsite: establishmentAggregate.establishment.website,
      uow,
    });
  });

const makeDiscussionRead = async ({
  discussion,
  establishmentWebsite,
  uow,
}: {
  discussion: DiscussionDto;
  establishmentWebsite: EstablishmentWebSite | undefined;
  uow: UnitOfWork;
}): Promise<DiscussionReadDto> => {
  const { appellationCode, ...rest } = discussion;

  const appellation = (
    await uow.romeRepository.getAppellationAndRomeDtosFromAppellationCodesIfExist(
      [appellationCode],
    )
  ).at(0);

  if (!appellation) throw errors.rome.missingAppellation({ appellationCode });
  const discussionRead: DiscussionReadDto = {
    ...rest,
    appellation,
    ...(establishmentWebsite ? { establishmentWebsite } : {}),
  };

  return validateAndParseZodSchema({
    schemaName: "discussionReadSchema",
    inputSchema: discussionReadSchema,
    schemaParsingInput: discussionRead,
    logger: createLogger(__filename),
  });
};
