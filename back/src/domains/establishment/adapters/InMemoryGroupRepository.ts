import { values } from "ramda";
import type { GroupInfo, GroupSlug, InternalOfferDto, SiretDto } from "shared";
import type { GroupEntity } from "../entities/GroupEntity";
import type { GroupRepository } from "../ports/GroupRepository";

export const stubSearchResult: InternalOfferDto = {
  rome: "D1101",
  siret: "11112222111122",
  distance_m: 0,
  name: "Company inside repository",
  website: "https://www.jobs.fr",
  additionalInformation: "",
  voluntaryToImmersion: true,
  position: { lon: 50, lat: 35 },
  romeLabel: "Boucherie",
  establishmentScore: 0,
  appellations: [
    {
      appellationLabel: "Boucher / Bouchère",
      appellationCode: "11564",
    },
  ],
  naf: "7820Z",
  nafLabel: "Activités des agences de travail temporaire",
  address: {
    streetNumberAndAddress: "30 avenue des champs Elysées",
    postcode: "75017",
    city: "Paris",
    departmentCode: "75",
  },
  contactMode: "EMAIL",
  numberOfEmployeeRange: "10-19",
  locationId: "123",
  updatedAt: new Date().toISOString(),
  createdAt: new Date().toISOString(),
  fitForDisabledWorkers: null,
  remoteWorkMode: "ON_SITE",
  isAvailable: true,
};

export class InMemoryGroupRepository implements GroupRepository {
  // for test purpose
  #groupsBySlug: Record<GroupSlug, GroupEntity> = {};

  public async getGroupInfoBySlug(
    slug: GroupSlug,
  ): Promise<GroupInfo | undefined> {
    const groupEntity = this.#groupsBySlug[slug];
    if (!groupEntity) return;
    const { sirets: _, ...group } = groupEntity;
    return group;
  }

  public async groupsWithSiret(siret: SiretDto): Promise<GroupEntity[]> {
    return values(this.#groupsBySlug).reduce<GroupEntity[]>(
      (acc, group) => [
        ...acc,
        ...(group.sirets.includes(siret) ? [group] : []),
      ],
      [],
    );
  }

  public async save(group: GroupEntity) {
    this.#groupsBySlug[group.slug] = group;
  }

  public get groupEntities(): GroupEntity[] {
    return Object.values(this.#groupsBySlug);
  }

  public set groupEntities(groups: GroupEntity[]) {
    this.#groupsBySlug = groups.reduce(
      (acc, group) => ({ ...acc, [group.slug]: group }),
      {} satisfies Record<GroupSlug, GroupEntity>,
    );
  }
}
