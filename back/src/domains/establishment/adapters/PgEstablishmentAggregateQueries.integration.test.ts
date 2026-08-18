import type { Pool } from "pg";
import { expectToEqual } from "shared";
import {
  type KyselyDb,
  makeKyselyDb,
} from "../../../config/pg/kysely/kyselyUtils";
import { makeTestPgPool } from "../../../config/pg/pgPool";
import { PgUserRepository } from "../../core/authentication/connected-user/adapters/PgUserRepository";
import { PgEstablishmentAggregateQueries } from "./PgEstablishmentAggregateQueries";
import { PgEstablishmentAggregateRepository } from "./PgEstablishmentAggregateRepository";
import {
  artisteCirqueOffer,
  establishmentWithOfferA1101_AtPositionWithTwoLocations,
  osefUser,
} from "./PgEstablishmentAggregateRepository.test.helpers";

describe("PgEstablishmentAggregateQueries", () => {
  let pool: Pool;
  let kyselyDb: KyselyDb;
  let pgEstablishmentAggregateRepository: PgEstablishmentAggregateRepository;
  let pgEstablishmentAggregateQueries: PgEstablishmentAggregateQueries;
  let pgUserRepository: PgUserRepository;

  beforeAll(() => {
    pool = makeTestPgPool();
    kyselyDb = makeKyselyDb(pool);
  });

  beforeEach(async () => {
    await kyselyDb.deleteFrom("convention_templates").execute();
    await kyselyDb.deleteFrom("establishments__users").execute();
    await kyselyDb.deleteFrom("immersion_offers").execute();
    await kyselyDb.deleteFrom("discussions").execute();
    await kyselyDb.deleteFrom("establishments_location_infos").execute();
    await kyselyDb.deleteFrom("establishments_location_positions").execute();
    await kyselyDb.deleteFrom("establishments").execute();
    await kyselyDb.deleteFrom("convention_templates").execute();
    await kyselyDb.deleteFrom("users").execute();
    await kyselyDb.deleteFrom("banned_establishments").execute();

    pgEstablishmentAggregateRepository = new PgEstablishmentAggregateRepository(
      kyselyDb,
    );
    pgEstablishmentAggregateQueries = new PgEstablishmentAggregateQueries(
      kyselyDb,
    );
    pgUserRepository = new PgUserRepository(kyselyDb);

    await pgUserRepository.save(osefUser);
  });

  afterAll(async () => {
    await pool.end();
  });

  describe("getSearchResultBySearchQuery", () => {
    beforeEach(async () => {
      await pgEstablishmentAggregateRepository.insertEstablishmentAggregate(
        establishmentWithOfferA1101_AtPositionWithTwoLocations,
      );
    });

    it("undefined when missing offer by siret", async () => {
      const missingSiret = "11111111111111";

      expectToEqual(
        await pgEstablishmentAggregateQueries.getSearchResultBySearchQuery(
          missingSiret,
          establishmentWithOfferA1101_AtPositionWithTwoLocations.offers[0]
            .appellationCode,
          establishmentWithOfferA1101_AtPositionWithTwoLocations.establishment
            .locations[0].id,
        ),
        undefined,
      );
    });

    it("ignores location id when location does not exist anymore", async () => {
      const deletedLocationId =
        establishmentWithOfferA1101_AtPositionWithTwoLocations.establishment
          .locations[0].id;

      await kyselyDb
        .deleteFrom("establishments_location_infos")
        .where("id", "=", deletedLocationId)
        .execute();

      const searchResultWithoutLocationId =
        await pgEstablishmentAggregateQueries.getSearchResultBySearchQuery(
          establishmentWithOfferA1101_AtPositionWithTwoLocations.establishment
            .siret,
          establishmentWithOfferA1101_AtPositionWithTwoLocations.offers[0]
            .appellationCode,
        );

      expectToEqual(
        await pgEstablishmentAggregateQueries.getSearchResultBySearchQuery(
          establishmentWithOfferA1101_AtPositionWithTwoLocations.establishment
            .siret,
          establishmentWithOfferA1101_AtPositionWithTwoLocations.offers[0]
            .appellationCode,
          deletedLocationId,
        ),
        searchResultWithoutLocationId,
      );
    });

    it("undefined when missing offer appellation code", async () => {
      const missingAppellationCode = artisteCirqueOffer.appellationCode;

      expectToEqual(
        await pgEstablishmentAggregateQueries.getSearchResultBySearchQuery(
          establishmentWithOfferA1101_AtPositionWithTwoLocations.establishment
            .siret,
          missingAppellationCode,
          establishmentWithOfferA1101_AtPositionWithTwoLocations.establishment
            .locations[0].id,
        ),
        undefined,
      );
    });

    it("Returns reconstructed SearchImmersionResultDto for given siret, appellationCode and given location id", async () => {
      expectToEqual(
        await pgEstablishmentAggregateQueries.getSearchResultBySearchQuery(
          establishmentWithOfferA1101_AtPositionWithTwoLocations.establishment
            .siret,
          establishmentWithOfferA1101_AtPositionWithTwoLocations.offers[0]
            .appellationCode,
          establishmentWithOfferA1101_AtPositionWithTwoLocations.establishment
            .locations[0].id,
        ),
        {
          rome: establishmentWithOfferA1101_AtPositionWithTwoLocations.offers[0]
            .romeCode,
          romeLabel:
            establishmentWithOfferA1101_AtPositionWithTwoLocations.offers[0]
              .romeLabel,
          establishmentScore:
            establishmentWithOfferA1101_AtPositionWithTwoLocations.establishment
              .score,
          appellations: [
            {
              appellationLabel:
                establishmentWithOfferA1101_AtPositionWithTwoLocations.offers[0]
                  .appellationLabel,
              appellationCode:
                establishmentWithOfferA1101_AtPositionWithTwoLocations.offers[0]
                  .appellationCode,
            },
          ],
          naf: establishmentWithOfferA1101_AtPositionWithTwoLocations
            .establishment.nafDto.code,
          nafLabel: "Activités des agences de travail temporaire",
          siret:
            establishmentWithOfferA1101_AtPositionWithTwoLocations.establishment
              .siret,
          name: establishmentWithOfferA1101_AtPositionWithTwoLocations
            .establishment.name,
          customizedName:
            establishmentWithOfferA1101_AtPositionWithTwoLocations.establishment
              .customizedName,
          website:
            establishmentWithOfferA1101_AtPositionWithTwoLocations.establishment
              .website,
          additionalInformation:
            establishmentWithOfferA1101_AtPositionWithTwoLocations.establishment
              .additionalInformation,
          voluntaryToImmersion:
            establishmentWithOfferA1101_AtPositionWithTwoLocations.establishment
              .voluntaryToImmersion,
          fitForDisabledWorkers:
            establishmentWithOfferA1101_AtPositionWithTwoLocations.establishment
              .fitForDisabledWorkers,
          numberOfEmployeeRange:
            establishmentWithOfferA1101_AtPositionWithTwoLocations.establishment
              .numberEmployeesRange,
          contactMode:
            establishmentWithOfferA1101_AtPositionWithTwoLocations.establishment
              .contactMode,
          distance_m: undefined,
          address:
            establishmentWithOfferA1101_AtPositionWithTwoLocations.establishment
              .locations[0].address,
          position:
            establishmentWithOfferA1101_AtPositionWithTwoLocations.establishment
              .locations[0].position,
          locationId:
            establishmentWithOfferA1101_AtPositionWithTwoLocations.establishment
              .locations[0].id,
          createdAt:
            establishmentWithOfferA1101_AtPositionWithTwoLocations.establishment.createdAt.toISOString(),
          updatedAt:
            establishmentWithOfferA1101_AtPositionWithTwoLocations.establishment.updatedAt.toISOString(),
          remoteWorkMode:
            establishmentWithOfferA1101_AtPositionWithTwoLocations.offers[0]
              .remoteWorkMode,
          isAvailable: true,
        },
      );
    });
    it("Returns first reconstructed SearchImmersionResultDto for given siret, appellationCode but no location id", async () => {
      expectToEqual(
        await pgEstablishmentAggregateQueries.getSearchResultBySearchQuery(
          establishmentWithOfferA1101_AtPositionWithTwoLocations.establishment
            .siret,
          establishmentWithOfferA1101_AtPositionWithTwoLocations.offers[0]
            .appellationCode,
        ),
        {
          rome: establishmentWithOfferA1101_AtPositionWithTwoLocations.offers[0]
            .romeCode,
          romeLabel:
            establishmentWithOfferA1101_AtPositionWithTwoLocations.offers[0]
              .romeLabel,
          establishmentScore:
            establishmentWithOfferA1101_AtPositionWithTwoLocations.establishment
              .score,
          appellations: [
            {
              appellationLabel:
                establishmentWithOfferA1101_AtPositionWithTwoLocations.offers[0]
                  .appellationLabel,
              appellationCode:
                establishmentWithOfferA1101_AtPositionWithTwoLocations.offers[0]
                  .appellationCode,
            },
          ],
          naf: establishmentWithOfferA1101_AtPositionWithTwoLocations
            .establishment.nafDto.code,
          nafLabel: "Activités des agences de travail temporaire",
          siret:
            establishmentWithOfferA1101_AtPositionWithTwoLocations.establishment
              .siret,
          name: establishmentWithOfferA1101_AtPositionWithTwoLocations
            .establishment.name,
          customizedName:
            establishmentWithOfferA1101_AtPositionWithTwoLocations.establishment
              .customizedName,
          website:
            establishmentWithOfferA1101_AtPositionWithTwoLocations.establishment
              .website,
          additionalInformation:
            establishmentWithOfferA1101_AtPositionWithTwoLocations.establishment
              .additionalInformation,
          voluntaryToImmersion:
            establishmentWithOfferA1101_AtPositionWithTwoLocations.establishment
              .voluntaryToImmersion,
          fitForDisabledWorkers:
            establishmentWithOfferA1101_AtPositionWithTwoLocations.establishment
              .fitForDisabledWorkers,
          numberOfEmployeeRange:
            establishmentWithOfferA1101_AtPositionWithTwoLocations.establishment
              .numberEmployeesRange,
          contactMode:
            establishmentWithOfferA1101_AtPositionWithTwoLocations.establishment
              .contactMode,
          distance_m: undefined,
          address:
            establishmentWithOfferA1101_AtPositionWithTwoLocations.establishment
              .locations[1].address, // is the last location added
          position:
            establishmentWithOfferA1101_AtPositionWithTwoLocations.establishment
              .locations[1].position, // is the last location added
          locationId:
            establishmentWithOfferA1101_AtPositionWithTwoLocations.establishment
              .locations[1].id, // is the last location added
          createdAt:
            establishmentWithOfferA1101_AtPositionWithTwoLocations.establishment.createdAt.toISOString(),
          updatedAt:
            establishmentWithOfferA1101_AtPositionWithTwoLocations.establishment.updatedAt.toISOString(),
          remoteWorkMode:
            establishmentWithOfferA1101_AtPositionWithTwoLocations.offers[0]
              .remoteWorkMode,
          isAvailable: true,
        },
      );
    });
  });
});
