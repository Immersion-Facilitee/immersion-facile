import {
  errors,
  expectPromiseToFailWithError,
  expectToEqual,
  type InternalOfferDto,
  type Location,
} from "shared";
import { InMemoryEstablishmentAggregateQueries } from "../adapters/InMemoryEstablishmentAggregateQueries";
import {
  InMemoryEstablishmentAggregateRepository,
  TEST_ROME_LABEL,
} from "../adapters/InMemoryEstablishmentAggregateRepository";
import {
  defaultNafCode,
  EstablishmentAggregateBuilder,
  EstablishmentEntityBuilder,
  OfferEntityBuilder,
  TEST_LOCATION,
} from "../helpers/EstablishmentBuilders";
import {
  type GetSearchResultBySearchQuery,
  makeGetSearchResultBySearchQuery,
} from "./GetSearchResultBySearchQuery";

describe("GetSearchResultBySearchQuery", () => {
  let getSearchResultBySearchQuery: GetSearchResultBySearchQuery;
  let establishmentAggregateRepository: InMemoryEstablishmentAggregateRepository;

  const siret = "78000403200019";
  const appellationCode = "19540";
  const lastAddedLocation: Location = {
    ...TEST_LOCATION,
    id: "22222222-2222-4444-2222-222222222222",
  };

  const establishmentAggregate = new EstablishmentAggregateBuilder()
    .withEstablishment(
      new EstablishmentEntityBuilder()
        .withSiret(siret)
        .withScore(15)
        .withLocations([TEST_LOCATION, lastAddedLocation])
        .withContactMode("EMAIL")
        .build(),
    )
    .withOffers([
      new OfferEntityBuilder()
        .withRomeCode("B1805")
        .withAppellationCode(appellationCode)
        .withAppellationLabel("Crêpier")
        .build(),
    ])
    .build();

  beforeEach(() => {
    establishmentAggregateRepository =
      new InMemoryEstablishmentAggregateRepository();
    getSearchResultBySearchQuery = makeGetSearchResultBySearchQuery({
      deps: {
        establishmentAggregateQueries:
          new InMemoryEstablishmentAggregateQueries(
            establishmentAggregateRepository,
          ),
      },
    });
  });

  it("returns the search result when the query is valid", async () => {
    establishmentAggregateRepository.establishmentAggregates = [
      establishmentAggregate,
    ];

    const result = await getSearchResultBySearchQuery.execute({
      siret,
      appellationCode,
      locationId: TEST_LOCATION.id,
    });

    expectToEqual(result, {
      address: TEST_LOCATION.address,
      naf: defaultNafCode,
      nafLabel: "FAKE",
      name: establishmentAggregate.establishment.name,
      customizedName: establishmentAggregate.establishment.customizedName,
      rome: "B1805",
      romeLabel: TEST_ROME_LABEL,
      establishmentScore: 15,
      appellations: [
        {
          appellationLabel: "Crêpier",
          appellationCode,
        },
      ],
      siret,
      voluntaryToImmersion:
        establishmentAggregate.establishment.voluntaryToImmersion,
      contactMode: "EMAIL",
      numberOfEmployeeRange:
        establishmentAggregate.establishment.numberEmployeesRange,
      website: establishmentAggregate.establishment.website,
      additionalInformation:
        establishmentAggregate.establishment.additionalInformation,
      position: TEST_LOCATION.position,
      locationId: TEST_LOCATION.id,
      updatedAt: establishmentAggregate.establishment.updatedAt?.toISOString(),
      createdAt: establishmentAggregate.establishment.createdAt.toISOString(),
      fitForDisabledWorkers: "no",
      remoteWorkMode: "ON_SITE",
      isAvailable: true,
    } satisfies InternalOfferDto);
  });

  it("falls back to the establishment's last added location when the given locationId doesn't exist in aggregate", async () => {
    establishmentAggregateRepository.establishmentAggregates = [
      establishmentAggregate,
    ];

    const result = await getSearchResultBySearchQuery.execute({
      siret,
      appellationCode,
      locationId: "33333333-3333-4444-3333-000000000000",
    });

    expectToEqual(result?.locationId, lastAddedLocation.id);
  });

  it("falls back to the establishment's last added location when no locationId is given", async () => {
    establishmentAggregateRepository.establishmentAggregates = [
      establishmentAggregate,
    ];

    const result = await getSearchResultBySearchQuery.execute({
      siret,
      appellationCode,
    });

    expectToEqual(result?.locationId, lastAddedLocation.id);
  });

  it("throws when no establishment matches the siret", async () => {
    await expectPromiseToFailWithError(
      getSearchResultBySearchQuery.execute({
        siret,
        appellationCode,
      }),
      errors.establishment.offerMissing({
        siret,
        appellationCode,
        mode: "not found",
      }),
    );
  });

  it("throws when the establishment has no offer with the given appellation code", async () => {
    establishmentAggregateRepository.establishmentAggregates = [
      establishmentAggregate,
    ];
    const unknownAppellationCode = "00000";

    await expectPromiseToFailWithError(
      getSearchResultBySearchQuery.execute({
        siret,
        appellationCode: unknownAppellationCode,
      }),
      errors.establishment.offerMissing({
        siret,
        appellationCode: unknownAppellationCode,
        mode: "not found",
      }),
    );
  });
});
