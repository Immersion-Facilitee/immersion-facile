import {
  type GroupInfo,
  type GroupSlug,
  groupInfoSchema,
  type SiretDto,
} from "shared";
import {
  jsonBuildObject,
  jsonStripNulls,
  type KyselyDb,
} from "../../../config/pg/kysely/kyselyUtils";
import type { GroupEntity } from "../entities/GroupEntity";
import type { GroupRepository } from "../ports/GroupRepository";

export class PgGroupRepository implements GroupRepository {
  constructor(private transaction: KyselyDb) {}

  public async getGroupInfoBySlug(
    slug: GroupSlug,
  ): Promise<GroupInfo | undefined> {
    const rawGroup = await this.transaction
      .selectFrom("groups")
      .where("slug", "=", slug)
      .selectAll()
      .executeTakeFirst();

    if (!rawGroup) return;

    return groupInfoSchema.parse({
      name: rawGroup.name,
      slug: rawGroup.slug,
      options: {
        heroHeader: {
          title: rawGroup.hero_header_title,
          description: rawGroup.hero_header_description,
          logoUrl: rawGroup.hero_header_logo_url ?? undefined,
          backgroundColor: rawGroup.hero_header_background_color ?? undefined,
        },
      },
    });
  }

  public async groupsWithSiret(siret: SiretDto): Promise<GroupEntity[]> {
    return this.transaction
      .with("uniq_groups", (qb) =>
        qb
          .selectFrom("groups__sirets")
          .select("groups__sirets.group_slug")
          .distinct()
          .where("siret", "=", siret),
      )
      .selectFrom("groups as g")
      .leftJoin("groups__sirets", "slug", "groups__sirets.group_slug")
      .innerJoin("uniq_groups", "g.slug", "uniq_groups.group_slug")
      .groupBy(["g.slug", "g.name"])
      .orderBy("g.slug")
      .select(({ fn, ref }) => [
        "g.slug",
        "g.name",
        fn.agg<string[]>("ARRAY_AGG", ["groups__sirets.siret"]).as("sirets"),
        jsonStripNulls(
          jsonBuildObject({
            heroHeader: jsonBuildObject({
              title: ref("hero_header_title"),
              description: ref("hero_header_description"),
              logoUrl: ref("hero_header_logo_url"),
              backgroundColor: ref("hero_header_background_color"),
            }),
          }),
        ).as("options"),
      ])
      .execute();
  }

  public async save(group: GroupEntity): Promise<void> {
    const pgGroups = await this.transaction
      .selectFrom("groups")
      .select("groups.slug")
      .where("slug", "=", group.slug)
      .execute();

    const groupAlreadyExists = !!pgGroups.length;

    return groupAlreadyExists
      ? this.#onExistingGroup(group)
      : this.#onMissingGroup(group);
  }

  async #onMissingGroup(group: GroupEntity): Promise<void> {
    await this.transaction
      .insertInto("groups")
      .values({
        name: group.name,
        slug: group.slug,
        hero_header_title: group.options.heroHeader.title,
        hero_header_description: group.options.heroHeader.description,
        hero_header_background_color: group.options.heroHeader.backgroundColor,
        hero_header_logo_url: group.options.heroHeader.logoUrl,
      })
      .execute();
    await this.#insertGroupSirets(group);
  }

  async #onExistingGroup(group: GroupEntity): Promise<void> {
    await this.#clearExistingSiretsForGroup(group.slug);
    await this.#insertGroupSirets(group);
  }

  async #insertGroupSirets(group: GroupEntity) {
    if (!group.sirets.length) return;

    const groupAndSiretPairs = group.sirets.map((siret) => ({
      group_slug: group.slug,
      siret,
    }));

    await this.transaction
      .insertInto("groups__sirets")
      .values(groupAndSiretPairs)
      .execute();
  }

  async #clearExistingSiretsForGroup(groupSlug: GroupSlug) {
    await this.transaction
      .deleteFrom("groups__sirets")
      .where("group_slug", "=", groupSlug)
      .execute();
  }
}
