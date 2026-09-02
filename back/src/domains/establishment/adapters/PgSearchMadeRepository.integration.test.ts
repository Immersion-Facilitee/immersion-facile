import type { Pool } from "pg";
import {
  type AppellationCode,
  type EstablishmentSearchableByValue,
  expectToEqual,
  type FitForDisableWorkerOption,
  type LocationId,
  type NafCode,
  optional,
  type RemoteWorkMode,
  type SiretDto,
} from "shared";
import {
  type KyselyDb,
  makeKyselyDb,
} from "../../../config/pg/kysely/kyselyUtils";
import { makeTestPgPool } from "../../../config/pg/pgPool";
import type { GeoParams, SearchMadeEntity } from "../entities/SearchMadeEntity";
import { PgSearchMadeRepository } from "./PgSearchMadeRepository";

describe("PgSearchesMadeRepository", () => {
  const searchMadeWithoutLocation: SearchMadeEntity = {
    id: "9f6dad2c-6f02-11ec-90d6-0242ac120003",
    needsToBeSearched: true,
    sortedBy: "distance",
    place: "Nantes",
    voluntaryToImmersion: true,
    numberOfResults: 1,
    nafCodes: [],
  };

  let pool: Pool;
  let db: KyselyDb;
  let pgSearchesMadeRepository: PgSearchMadeRepository;

  beforeAll(async () => {
    pool = makeTestPgPool();
    db = makeKyselyDb(pool);
  });

  beforeEach(async () => {
    await db.deleteFrom("searches_made__appellation_code").execute();
    await db.deleteFrom("searches_made__naf_code").execute();
    await db.deleteFrom("searches_made").execute();
    pgSearchesMadeRepository = new PgSearchMadeRepository(makeKyselyDb(pool));
  });

  afterAll(async () => {
    await pool.end();
  });

  describe("with geo params", () => {
    it.each<GeoParams & { expectedDepartmentCode: string }>([
      {
        distanceKm: 30,
        lat: 48.85909,
        lon: 2.350196,
        expectedDepartmentCode: "75",
      },
      {
        distanceKm: 2,
        lat: 47.22221,
        lon: -1.54212,
        expectedDepartmentCode: "44",
      },
      {
        distanceKm: 3.2,
        lat: 46.159457943708254,
        lon: 0.15399270230344264,
        expectedDepartmentCode: "86",
      },
      {
        distanceKm: 9,
        lat: 46.15944708515133,
        lon: 0.15392947992255213,
        expectedDepartmentCode: "79",
      },
      {
        distanceKm: 9,
        lat: -21.154576445369,
        lon: 55.40104947929245,
        expectedDepartmentCode: "974",
      },
    ])(
      "insert a search made with geo params (lat '$lat' , lon '$lon' , '$distanceKm' km) and save departement code with value '$expectedDepartmentCode'",
      async ({ distanceKm, lat, lon, expectedDepartmentCode }) => {
        const searchMadeWithLocation: SearchMadeEntity = {
          ...searchMadeWithoutLocation,
          distanceKm,
          lat,
          lon,
        };

        await pgSearchesMadeRepository.insertSearchMade(searchMadeWithLocation);

        expectToEqual(
          await getSearchMadeById(db, searchMadeWithLocation.id),
          searchMadeWithLocation,
        );
        expectToEqual(
          await db
            .selectFrom("searches_made")
            .select("department_code")
            .where("id", "=", searchMadeWithLocation.id)
            .executeTakeFirst(),
          { department_code: expectedDepartmentCode },
        );
      },
    );
  });

  it("with nafCodes", async () => {
    const searchMadeWithLocation: SearchMadeEntity = {
      ...searchMadeWithoutLocation,
      nafCodes: ["7211Z", "7219Z"],
    };

    await pgSearchesMadeRepository.insertSearchMade(searchMadeWithLocation);

    expectToEqual(
      await getSearchMadeById(db, searchMadeWithLocation.id),
      searchMadeWithLocation,
    );
  });

  it("insert a search made without location and have departement code null", async () => {
    await pgSearchesMadeRepository.insertSearchMade(searchMadeWithoutLocation);

    expectToEqual(
      await getSearchMadeById(db, searchMadeWithoutLocation.id),
      searchMadeWithoutLocation,
    );
    expectToEqual(
      await db
        .selectFrom("searches_made")
        .select("department_code")
        .where("id", "=", searchMadeWithoutLocation.id)
        .executeTakeFirst(),
      { department_code: null },
    );
  });

  it("insert a search made and keeps acquisition params", async () => {
    const searchMade: SearchMadeEntity = {
      ...searchMadeWithoutLocation,
      acquisitionKeyword: "acquisition-keyword",
      acquisitionCampaign: "acquisition-campaign",
    };

    await pgSearchesMadeRepository.insertSearchMade(searchMade);

    expectToEqual(await getSearchMadeById(db, searchMade.id), searchMade);
  });

  it("Remove duplicated appellationCodes then insert search", async () => {
    const appellationCode: AppellationCode = "19365";

    const searchMade: SearchMadeEntity = {
      ...searchMadeWithoutLocation,
      appellationCodes: [appellationCode, appellationCode],
    };

    await pgSearchesMadeRepository.insertSearchMade(searchMade);

    expectToEqual(await getSearchMadeById(db, searchMade.id), {
      ...searchMade,
      appellationCodes: [appellationCode],
    });
  });

  it("with searchableBy", async () => {
    const searchableBy: EstablishmentSearchableByValue = "students";
    const searchMade: SearchMadeEntity = {
      ...searchMadeWithoutLocation,
      searchableBy,
    };

    await pgSearchesMadeRepository.insertSearchMade(searchMade);

    expectToEqual(await getSearchMadeById(db, searchMade.id), searchMade);
  });

  it("with fitForDisabledWorkers", async () => {
    const fitForDisabledWorkers: FitForDisableWorkerOption[] = [
      "yes-ft-certified",
      "yes-declared-only",
    ];
    const searchMade: SearchMadeEntity = {
      ...searchMadeWithoutLocation,
      fitForDisabledWorkers,
    };

    await pgSearchesMadeRepository.insertSearchMade(searchMade);

    expectToEqual(await getSearchMadeById(db, searchMade.id), searchMade);
  });

  it("with locationIds", async () => {
    const locationIds: LocationId[] = [
      "11111111-1111-4111-b111-111111111111" as LocationId,
      "22222222-2222-4222-b222-222222222222" as LocationId,
    ];
    const searchMade: SearchMadeEntity = {
      ...searchMadeWithoutLocation,
      locationIds,
    };

    await pgSearchesMadeRepository.insertSearchMade(searchMade);

    expectToEqual(await getSearchMadeById(db, searchMade.id), searchMade);
  });

  it("with remoteWorkModes", async () => {
    const remoteWorkModes: RemoteWorkMode[] = ["FULL_REMOTE", "HYBRID"];
    const searchMade: SearchMadeEntity = {
      ...searchMadeWithoutLocation,
      remoteWorkModes,
    };

    await pgSearchesMadeRepository.insertSearchMade(searchMade);

    expectToEqual(await getSearchMadeById(db, searchMade.id), searchMade);
  });

  it("with showOnlyAvailableOffers", async () => {
    const searchMade: SearchMadeEntity = {
      ...searchMadeWithoutLocation,
      showOnlyAvailableOffers: true,
    };

    await pgSearchesMadeRepository.insertSearchMade(searchMade);

    expectToEqual(await getSearchMadeById(db, searchMade.id), searchMade);
  });

  it("with sirets", async () => {
    const sirets: SiretDto[] = ["12345678901234", "56789012345678"];
    const searchMade: SearchMadeEntity = {
      ...searchMadeWithoutLocation,
      sirets,
    };

    await pgSearchesMadeRepository.insertSearchMade(searchMade);

    expectToEqual(await getSearchMadeById(db, searchMade.id), searchMade);
  });

  it("with all SearchMadeFilters", async () => {
    const { romeCodes: _, ...searchMade }: SearchMadeEntity = {
      ...searchMadeWithoutLocation,
      appellationCodes: ["19365"],
      romeCodes: ["D1102"],
      searchableBy: "jobSeekers",
      fitForDisabledWorkers: ["yes-ft-certified", "no"],
      locationIds: ["11111111-1111-4111-b111-111111111111"],
      nafCodes: ["7211Z", "7219Z"],
      remoteWorkModes: ["FULL_REMOTE", "ON_SITE"],
      showOnlyAvailableOffers: true,
      sirets: ["12345678901234"],
    };

    await pgSearchesMadeRepository.insertSearchMade(searchMade);

    expectToEqual(await getSearchMadeById(db, searchMade.id), searchMade);
  });
});

const getSearchMadeById = async (
  db: KyselyDb,
  id: string,
): Promise<SearchMadeEntity | undefined> => {
  const searchMadeResult = await db
    .selectFrom("searches_made")
    .selectAll()
    .where("id", "=", id)
    .executeTakeFirst();

  const appellationCodes: AppellationCode[] = await db
    .selectFrom("searches_made__appellation_code")
    .select("appellation_code")
    .where("search_made_id", "=", id)
    .execute()
    .then((rows) =>
      rows
        .map(({ appellation_code }) => appellation_code)
        .filter(
          (appellationCode): appellationCode is AppellationCode =>
            appellationCode !== null,
        ),
    );

  const nafCodes: NafCode[] = await db
    .selectFrom("searches_made__naf_code")
    .select("naf_code")
    .where("search_made_id", "=", id)
    .execute()
    .then((rows) =>
      rows
        .map(({ naf_code }) => naf_code)
        .filter((nafCode): nafCode is NafCode => nafCode !== null),
    );

  return (
    searchMadeResult && {
      id: searchMadeResult.id,
      distanceKm: optional(searchMadeResult.distance),
      lat: optional(searchMadeResult.lat),
      lon: optional(searchMadeResult.lon),
      sortedBy: optional(searchMadeResult.sorted_by),
      voluntaryToImmersion: optional(searchMadeResult.voluntary_to_immersion),
      place: optional(searchMadeResult.address),
      needsToBeSearched: searchMadeResult.needstobesearched ?? false,
      appellationCodes: appellationCodes.length ? appellationCodes : undefined,
      apiConsumerName: optional(searchMadeResult.api_consumer_name),
      numberOfResults: optional(searchMadeResult.number_of_results) ?? 0,
      acquisitionCampaign: optional(searchMadeResult.acquisition_campaign),
      acquisitionKeyword: optional(searchMadeResult.acquisition_keyword),
      searchableBy: optional(searchMadeResult.searchable_by),
      fitForDisabledWorkers: optional(
        searchMadeResult.fit_for_disabled_workers,
      ) as FitForDisableWorkerOption[] | undefined,
      locationIds: optional(searchMadeResult.location_ids) as
        | LocationId[]
        | undefined,
      remoteWorkModes: optional(searchMadeResult.remote_work_modes) as
        | RemoteWorkMode[]
        | undefined,
      showOnlyAvailableOffers: optional(
        searchMadeResult.show_only_available_offers,
      ),
      sirets: optional(searchMadeResult.sirets) as SiretDto[] | undefined,
      nafCodes,
    }
  );
};
