import { errors, type GroupInfo, withGroupSlugSchema } from "shared";
import { useCaseBuilder } from "../../core/useCaseBuilder";

export type GetOffersByGroupSlug = ReturnType<typeof makeGetGroupInfoBySlug>;

export const makeGetGroupInfoBySlug = useCaseBuilder("GetGroupInfoBySlug")
  .withInput(withGroupSlugSchema)
  .withOutput<GroupInfo>()
  .build(async ({ inputParams: { groupSlug }, uow }) => {
    const groupInfo = await uow.groupRepository.getGroupInfoBySlug(groupSlug);

    if (!groupInfo)
      throw errors.establishmentGroup.missingBySlug({ groupSlug });

    return groupInfo;
  });
