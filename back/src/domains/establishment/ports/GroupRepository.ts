import type { GroupInfo, GroupSlug, SiretDto } from "shared";
import type { GroupEntity } from "../entities/GroupEntity";

export interface GroupRepository {
  groupsWithSiret(siret: SiretDto): Promise<GroupEntity[]>;
  getGroupInfoBySlug(slug: GroupSlug): Promise<GroupInfo | undefined>;
  save(group: GroupEntity): Promise<void>;
}
