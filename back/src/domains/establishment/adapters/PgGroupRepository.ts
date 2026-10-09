import { sql } from "kysely";
import {
  type DateTimeIsoString,
  type Group,
  type GroupSlug,
  type GroupWithResults,
  groupWithResultsSchema,
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

  public async getGroupWithSearchResultsBySlug(
    slug: GroupSlug,
  ): Promise<GroupWithResults | undefined> {
    const rawGroup = await this.transaction
      .selectFrom("groups")
      .where("slug", "=", slug)
      .selectAll()
      .executeTakeFirst();

    if (!rawGroup) return;

    const group: Group = {
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
    };

    const results = await this.transaction
      .selectFrom("groups__sirets as gs")
      .leftJoin("groups as g", "g.slug", "gs.group_slug")
      .leftJoin("establishments as e", "e.siret", "gs.siret")
      .leftJoin("immersion_offers as io", "io.siret", "e.siret")
      .leftJoin(
        "public_appellations_data as ap",
        "ap.ogr_appellation",
        "io.appellation_code",
      )
      .leftJoin("public_romes_data as r", "r.code_rome", "ap.code_rome")
      .leftJoin(
        "public_naf_rev2_sous_classes as naf",
        "naf.naf_code",
        "e.naf_code",
      )
      .leftJoin(
        "establishments_location_infos as loc",
        "e.siret",
        "loc.establishment_siret",
      )
      .where("gs.group_slug", "=", slug)
      .where("e.is_open", "=", true)
      .where("e.is_max_discussions_for_period_reached", "=", false)
      .groupBy([
        "e.siret",
        "r.code_rome",
        "r.libelle_rome",
        "naf.libelle",
        "e.contact_mode",
        "loc.id",
      ])
      .select(({ ref }) =>
        jsonStripNulls(
          jsonBuildObject({
            rome: ref("r.code_rome"),
            siret: ref("e.siret"),
            establishmentScore: ref("e.score"),
            distance_m: sql`0`,
            name: ref("e.name"),
            website: ref("e.website"),
            additionalInformation: ref("e.additional_information"),
            customizedName: ref("e.customized_name"),
            voluntaryToImmersion: sql`TRUE`,
            fitForDisabledWorkers: ref("e.fit_for_disabled_workers"),
            position: jsonBuildObject({
              lon: ref("loc.lon"),
              lat: ref("loc.lat"),
            }),
            romeLabel: ref("r.libelle_rome"),
            appellations: sql`JSON_AGG(JSON_BUILD_OBJECT(
              'appellationCode', ap.ogr_appellation::text,
              'appellationLabel', ap.libelle_appellation_long
            ) ORDER BY ap.ogr_appellation)`,
            naf: ref("e.naf_code"),
            nafLabel: ref("naf.libelle"),
            address: jsonBuildObject({
              streetNumberAndAddress: ref("loc.street_number_and_address"),
              postcode: ref("loc.post_code"),
              city: ref("loc.city"),
              departmentCode: ref("loc.department_code"),
            }),
            contactMode: ref("e.contact_mode"),
            numberOfEmployeeRange: ref("e.number_employees"),
            locationId: ref("loc.id"),
            createdAt: sql<DateTimeIsoString>`date_to_iso(e.created_at)`,
            updatedAt: sql<DateTimeIsoString>`date_to_iso(e.update_date)`,
            remoteWorkMode: sql`MIN(io.remote_work_mode)`,
            isAvailable: sql`NOT(e.is_max_discussions_for_period_reached)`,
          }),
        ).as("search_result_dto"),
      )
      .execute();

    return groupWithResultsSchema.parse({
      group,
      results: results.map(({ search_result_dto }) => search_result_dto),
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
