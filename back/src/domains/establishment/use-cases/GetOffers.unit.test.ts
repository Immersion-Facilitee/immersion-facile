import {
  BadRequestError,
  type BanEstablishmentPayload,
  type DataWithPagination,
  executeInSequence,
  expectObjectInArrayToMatch,
  expectPromiseToFailWithError,
  expectToEqual,
  type GetOffersFlatQueryParams,
  type GetOffersPerPageOption,
  type InternalOfferDto,
  LocationBuilder,
} from "shared";
import { ApiConsumerBuilder } from "../../core/api-consumer/adapters/InMemoryApiConsumerRepository";
import {
  createInMemoryUow,
  type InMemoryUnitOfWork,
} from "../../core/unit-of-work/adapters/createInMemoryUow";
import { InMemoryUowPerformer } from "../../core/unit-of-work/adapters/InMemoryUowPerformer";
import { TestUuidGenerator } from "../../core/uuid-generator/adapters/UuidGeneratorImplementations";
import type { EstablishmentUserRight } from "../entities/EstablishmentAggregate";
import {
  boulangerOffer,
  EstablishmentAggregateBuilder,
  EstablishmentEntityBuilder,
  OfferEntityBuilder,
  secretariatOffer,
} from "../helpers/EstablishmentBuilders";
import { makeGetOffers } from "./GetOffers";

describe("GetOffers", () => {
  const userRights: EstablishmentUserRight[] = [
    {
      userId: "test-user-id",
      role: "establishment-admin",
      status: "ACCEPTED",
      job: "Chef",
      phone: "+33600000000",
      shouldReceiveDiscussionNotifications: true,
      isMainContactByPhone: false,
    },
  ];

  const establishment1 = new EstablishmentAggregateBuilder()
    .withEstablishmentSiret("78000403200019")
    .withEstablishmentNaf({ code: "8560C", nomenclature: "naf nomenclature" })
    .withFitForDisabledWorkers("no")
    .withScore(100)
    .withLocations([
      new LocationBuilder()
        .withId("11111111-1111-4444-1111-111111111111")
        .build(),
    ])
    .withOffers([secretariatOffer, boulangerOffer])
    .withUserRights(userRights)
    .build();

  const establishment2 = new EstablishmentAggregateBuilder()
    .withEstablishmentSiret("12345678901234")
    .withEstablishmentNaf({ code: "7510A", nomenclature: "naf nomenclature" })
    .withFitForDisabledWorkers("yes-ft-certified")
    .withScore(80)
    .withLocations([
      new LocationBuilder({
        ...new LocationBuilder().build(),
        id: "22222222-2222-4444-2222-222222222222",
        address: {
          ...new LocationBuilder().build().address,
          departmentCode: "75",
        },
      }).build(),
    ])
    .withOffers([secretariatOffer])
    .withUserRights(userRights)
    .build();

  const establishment3 = new EstablishmentAggregateBuilder()
    .withEstablishmentSiret("98765432109876")
    .withEstablishmentNaf({ code: "6201Z", nomenclature: "naf nomenclature" })
    .withFitForDisabledWorkers("yes-declared-only")
    .withScore(120)
    .withLocations([
      new LocationBuilder({
        ...new LocationBuilder().build(),
        id: "33333333-3333-4444-3333-333333333333",
        address: {
          ...new LocationBuilder().build().address,
          departmentCode: "77",
        },
      }).build(),
    ])
    .withOffers([boulangerOffer])
    .withUserRights(userRights)
    .build();

  const unavailableEstablishment = new EstablishmentAggregateBuilder()
    .withEstablishmentSiret("98765432109877")
    .withEstablishmentNaf({ code: "6201Z", nomenclature: "naf nomenclature" })
    .withFitForDisabledWorkers("yes-declared-only")
    .withScore(120)
    .withOffers([boulangerOffer])
    .withUserRights(userRights)
    .withIsMaxDiscussionsForPeriodReached(true)
    .build();

  let uow: InMemoryUnitOfWork;
  let uuidGenerator: TestUuidGenerator;
  let getOffers: ReturnType<typeof makeGetOffers>;

  beforeEach(() => {
    uow = createInMemoryUow();
    uuidGenerator = new TestUuidGenerator();
    getOffers = makeGetOffers({
      uowPerformer: new InMemoryUowPerformer(uow),
      deps: {
        uuidGenerator,
      },
    });
    uuidGenerator.setNextUuid("search-made-uuid");
    uow.establishmentAggregateRepository.establishmentAggregates = [
      establishment1,
      establishment2,
      establishment3,
    ];
  });

  it("should return some results given the input (with pretty much all filters)", async () => {
    const searchParams: GetOffersFlatQueryParams = {
      sortBy: "score",
      sortOrder: "desc",
      appellationCodes: [secretariatOffer.appellationCode],
      fitForDisabledWorkers: ["yes-ft-certified"],
      nafCodes: ["7510A"],
      searchableBy: "jobSeekers",
      sirets: [establishment2.establishment.siret],
    };

    const result: DataWithPagination<InternalOfferDto> =
      await getOffers.execute(searchParams, undefined);

    expect(result.data).toHaveLength(1);
    expect(result.data[0].siret).toBe(establishment2.establishment.siret);
    expect(result.data[0].appellations[0].appellationCode).toBe(
      secretariatOffer.appellationCode,
    );

    expect(uow.searchMadeRepository.searchesMade).toHaveLength(1);
    expect(uow.searchMadeRepository.searchesMade[0].numberOfResults).toBe(
      result.pagination.totalRecords,
    );
  });

  it("should filter offers on department codes", async () => {
    const searchParams: GetOffersFlatQueryParams = {
      sortBy: "score",
      sortOrder: "desc",
      departmentCodes: ["75"],
    };

    const result: DataWithPagination<InternalOfferDto> =
      await getOffers.execute(searchParams, undefined);

    expect(result.data).toHaveLength(1);
    expectToEqual(result.data, [
      {
        siret: establishment2.establishment.siret,
        appellations: [
          {
            appellationCode: secretariatOffer.appellationCode,
            appellationLabel: secretariatOffer.appellationLabel,
          },
        ],
        establishmentScore: establishment2.establishment.score,
        naf: establishment2.establishment.nafDto.code,
        nafLabel: "FAKE",
        name: establishment2.establishment.name,
        customizedName: establishment2.establishment.customizedName,
        numberOfEmployeeRange:
          establishment2.establishment.numberEmployeesRange,
        voluntaryToImmersion: establishment2.establishment.voluntaryToImmersion,
        additionalInformation:
          establishment2.establishment.additionalInformation,
        remoteWorkMode: "ON_SITE",
        fitForDisabledWorkers: "no",
        position: establishment2.establishment.locations[0].position,
        address: establishment2.establishment.locations[0].address,
        locationId: establishment2.establishment.locations[0].id,
        contactMode: establishment2.establishment.contactMode,
        romeLabel: "test_rome_label",
        rome: secretariatOffer.romeCode,
        website: establishment2.establishment.website,
        updatedAt: establishment2.establishment.updatedAt.toISOString(),
        createdAt: establishment2.establishment.createdAt.toISOString(),
        isAvailable: true,
      },
    ]);
  });

  it("should return no offer when departmentCodes has no matching department", async () => {
    const searchParams: GetOffersFlatQueryParams = {
      sortBy: "score",
      sortOrder: "desc",
      departmentCodes: ["99"],
    };

    const result: DataWithPagination<InternalOfferDto> =
      await getOffers.execute(searchParams, undefined);

    expectToEqual(result.data, []);
    expectToEqual(result.pagination.totalRecords, 0);
  });

  it("should filter offers on group", async () => {
    const groupSlug = "carrefour";
    uow.establishmentAggregateRepository.siretsByGroupSlug = {
      [groupSlug]: [establishment2.establishment.siret],
    };

    const result: DataWithPagination<InternalOfferDto> =
      await getOffers.execute(
        {
          sortBy: "score",
          sortOrder: "desc",
          group: groupSlug,
        },
        undefined,
      );

    expect(result.data).toHaveLength(1);
    expect(result.data[0].siret).toBe(establishment2.establishment.siret);
    expectToEqual(uow.searchMadeRepository.searchesMade[0].group, groupSlug);
  });

  it("should return no offer when group has no matching establishment", async () => {
    uow.establishmentAggregateRepository.siretsByGroupSlug = {
      carrefour: [establishment2.establishment.siret],
    };

    const result: DataWithPagination<InternalOfferDto> =
      await getOffers.execute(
        {
          sortBy: "score",
          sortOrder: "desc",
          group: "unknown-group",
        },
        undefined,
      );

    expectToEqual(result.data, []);
    expectToEqual(result.pagination.totalRecords, 0);
  });

  describe("showOnlyAvailableOffers", () => {
    it("should return offers from establishment that have reached max contact for period and showOnlyAvailableOffers is default (true)", async () => {
      uow.establishmentAggregateRepository.establishmentAggregates = [
        ...uow.establishmentAggregateRepository.establishmentAggregates,
        unavailableEstablishment,
      ];

      const resultWithoutFilters = await getOffers.execute(
        {
          sortBy: "date",
          sortOrder: "desc",
        },
        undefined,
      );

      expect(resultWithoutFilters.data).toHaveLength(4);
      expect(resultWithoutFilters.pagination.totalRecords).toBe(4);
      const defaultNumberPerPageForWeb: GetOffersPerPageOption = 12;
      expect(resultWithoutFilters.pagination.numberPerPage).toBe(
        defaultNumberPerPageForWeb,
      );
      expectObjectInArrayToMatch(resultWithoutFilters.data, [
        {
          isAvailable: true,
        },
        {
          isAvailable: true,
        },
        {
          isAvailable: true,
        },
        {
          isAvailable: true,
        },
      ]);
      expect(uow.searchMadeRepository.searchesMade).toHaveLength(1);
      expect(uow.searchMadeRepository.searchesMade[0].numberOfResults).toBe(4);
      expect(uow.searchMadeRepository.searchesMade[0].numberOfResults).toBe(
        resultWithoutFilters.pagination.totalRecords,
      );
    });
    it("should return offers from establishment that have reached max contact for period and showOnlyAvailableOffers is false", async () => {
      uow.establishmentAggregateRepository.establishmentAggregates = [
        ...uow.establishmentAggregateRepository.establishmentAggregates,
        unavailableEstablishment,
      ];

      const resultWithoutFilters = await getOffers.execute(
        {
          sortBy: "date",
          sortOrder: "desc",
          showOnlyAvailableOffers: false,
        },
        undefined,
      );

      expect(resultWithoutFilters.data).toHaveLength(5);
      expect(resultWithoutFilters.pagination.totalRecords).toBe(5);
      const defaultNumberPerPageForWeb: GetOffersPerPageOption = 12;
      expect(resultWithoutFilters.pagination.numberPerPage).toBe(
        defaultNumberPerPageForWeb,
      );
      expectObjectInArrayToMatch(resultWithoutFilters.data, [
        {
          isAvailable: true,
        },
        {
          isAvailable: true,
        },
        {
          isAvailable: true,
        },
        {
          isAvailable: true,
        },
        {
          isAvailable: false,
        },
      ]);
      expect(uow.searchMadeRepository.searchesMade).toHaveLength(1);
      expect(uow.searchMadeRepository.searchesMade[0].numberOfResults).toBe(5);
      expect(uow.searchMadeRepository.searchesMade[0].numberOfResults).toBe(
        resultWithoutFilters.pagination.totalRecords,
      );
    });
  });

  it("should return more results when no filters, and web user", async () => {
    const resultWithoutFilters = await getOffers.execute(
      {
        sortBy: "date",
        sortOrder: "desc",
      },
      undefined,
    );

    expect(resultWithoutFilters.data).toHaveLength(4);
    expect(resultWithoutFilters.pagination.totalRecords).toBe(4);
    const defaultNumberPerPageForWeb: GetOffersPerPageOption = 12;
    expect(resultWithoutFilters.pagination.numberPerPage).toBe(
      defaultNumberPerPageForWeb,
    );

    expect(uow.searchMadeRepository.searchesMade).toHaveLength(1);
    expect(uow.searchMadeRepository.searchesMade[0].numberOfResults).toBe(4);
    expect(uow.searchMadeRepository.searchesMade[0].numberOfResults).toBe(
      resultWithoutFilters.pagination.totalRecords,
    );
  });

  it("should return more results when no filters, and API consumer, default number of result is bigger for API", async () => {
    const apiConsumer = new ApiConsumerBuilder().build();
    const resultWithoutFilters = await getOffers.execute(
      {
        sortBy: "date",
        sortOrder: "desc",
      },
      apiConsumer,
    );

    expect(resultWithoutFilters.data).toHaveLength(4);
    expect(resultWithoutFilters.pagination.totalRecords).toBe(4);
    expect(resultWithoutFilters.pagination.numberPerPage).toBe(100);
  });

  describe("stores searches made", () => {
    it("stores geo params (lat, lon, distanceKm) when provided", async () => {
      const searchParams: GetOffersFlatQueryParams = {
        sortBy: "distance",
        sortOrder: "asc",
        latitude: 48.8566,
        longitude: 2.3522,
        distanceKm: 100,
      };

      await getOffers.execute(searchParams, undefined);

      expect(uow.searchMadeRepository.searchesMade).toHaveLength(1);
      const searchMade = uow.searchMadeRepository.searchesMade[0] as {
        lat: number;
        lon: number;
        distanceKm: number;
      };
      expect(searchMade.lat).toBe(48.8566);
      expect(searchMade.lon).toBe(2.3522);
      expect(searchMade.distanceKm).toBe(100);
    });

    it("stores place (address) when provided", async () => {
      const searchParams: GetOffersFlatQueryParams = {
        sortBy: "score",
        sortOrder: "desc",
        place: "Paris, France",
      };

      await getOffers.execute(searchParams, undefined);

      expect(uow.searchMadeRepository.searchesMade).toHaveLength(1);
      expect(uow.searchMadeRepository.searchesMade[0].place).toBe(
        "Paris, France",
      );
    });

    it("stores apiConsumerName when API consumer makes request", async () => {
      const apiConsumer = new ApiConsumerBuilder().build();
      const searchParams: GetOffersFlatQueryParams = {
        sortBy: "date",
        sortOrder: "desc",
      };

      await getOffers.execute(searchParams, apiConsumer);

      expect(uow.searchMadeRepository.searchesMade).toHaveLength(1);
      expect(uow.searchMadeRepository.searchesMade[0].apiConsumerName).toBe(
        apiConsumer.name,
      );
    });
  });

  it("should filter by remoteWorkModes when provided", async () => {
    const remoteOffer = new OfferEntityBuilder()
      .withRomeCode("M1607")
      .withAppellationLabel("Développeur / Développeuse")
      .withAppellationCode("19999")
      .withRomeLabel("Développement")
      .withRemoteWorkMode("FULL_REMOTE")
      .build();

    const hybridOffer = new OfferEntityBuilder()
      .withRomeCode("M1607")
      .withAppellationLabel("Chef de projet")
      .withAppellationCode("19998")
      .withRomeLabel("Gestion de projet")
      .withRemoteWorkMode("HYBRID")
      .build();

    const establishment4 = new EstablishmentAggregateBuilder()
      .withEstablishmentSiret("11111111111111")
      .withOffers([remoteOffer, hybridOffer])
      .withUserRights(userRights)
      .build();

    uow.establishmentAggregateRepository.establishmentAggregates.push(
      establishment4,
    );

    const searchParams: GetOffersFlatQueryParams = {
      sortBy: "score",
      sortOrder: "desc",
      remoteWorkModes: ["FULL_REMOTE"],
    };

    const result: DataWithPagination<InternalOfferDto> =
      await getOffers.execute(searchParams, undefined);

    expect(result.data).toHaveLength(1);
    expectToEqual(result.data, [
      {
        siret: establishment4.establishment.siret,
        appellations: [
          {
            appellationCode: remoteOffer.appellationCode,
            appellationLabel: remoteOffer.appellationLabel,
          },
        ],
        remoteWorkMode: "FULL_REMOTE",
        establishmentScore: establishment4.establishment.score,
        naf: establishment4.establishment.nafDto.code,
        nafLabel: "FAKE",
        name: establishment4.establishment.name,
        customizedName: establishment4.establishment.customizedName,
        numberOfEmployeeRange:
          establishment4.establishment.numberEmployeesRange,
        voluntaryToImmersion: establishment4.establishment.voluntaryToImmersion,
        additionalInformation:
          establishment4.establishment.additionalInformation,
        fitForDisabledWorkers: "no",
        position: establishment4.establishment.locations[0].position,
        address: establishment4.establishment.locations[0].address,
        locationId: establishment4.establishment.locations[0].id,
        contactMode: establishment4.establishment.contactMode,
        romeLabel: "test_rome_label",
        rome: remoteOffer.romeCode,
        website: establishment4.establishment.website,
        updatedAt: establishment4.establishment.updatedAt.toISOString(),
        createdAt: establishment4.establishment.createdAt.toISOString(),
        isAvailable: true,
      },
    ]);
  });

  it("should filter by multiple remoteWorkModes when provided", async () => {
    const remoteOffer = new OfferEntityBuilder()
      .withRomeCode("M1607")
      .withAppellationLabel("Développeur / Développeuse")
      .withAppellationCode("19999")
      .withRomeLabel("Développement")
      .withRemoteWorkMode("FULL_REMOTE")
      .build();

    const hybridOffer = new OfferEntityBuilder()
      .withRomeCode("M1607")
      .withAppellationLabel("Chef de projet")
      .withAppellationCode("19998")
      .withRomeLabel("Gestion de projet")
      .withRemoteWorkMode("HYBRID")
      .build();

    const establishment4 = new EstablishmentAggregateBuilder()
      .withEstablishmentSiret("11111111111111")
      .withOffers([remoteOffer, hybridOffer])
      .withUserRights(userRights)
      .build();

    uow.establishmentAggregateRepository.establishmentAggregates.push(
      establishment4,
    );

    const searchParams: GetOffersFlatQueryParams = {
      sortBy: "score",
      sortOrder: "desc",
      remoteWorkModes: ["FULL_REMOTE", "HYBRID"],
    };

    const result: DataWithPagination<InternalOfferDto> =
      await getOffers.execute(searchParams, undefined);

    expect(result.data).toHaveLength(2);
    expectToEqual(result.data, [
      {
        siret: establishment4.establishment.siret,
        appellations: [
          {
            appellationCode: remoteOffer.appellationCode,
            appellationLabel: remoteOffer.appellationLabel,
          },
        ],
        remoteWorkMode: "FULL_REMOTE",
        establishmentScore: establishment4.establishment.score,
        naf: establishment4.establishment.nafDto.code,
        nafLabel: "FAKE",
        name: establishment4.establishment.name,
        customizedName: establishment4.establishment.customizedName,
        numberOfEmployeeRange:
          establishment4.establishment.numberEmployeesRange,
        voluntaryToImmersion: establishment4.establishment.voluntaryToImmersion,
        additionalInformation:
          establishment4.establishment.additionalInformation,
        fitForDisabledWorkers: "no",
        position: establishment4.establishment.locations[0].position,
        address: establishment4.establishment.locations[0].address,
        locationId: establishment4.establishment.locations[0].id,
        contactMode: establishment4.establishment.contactMode,
        romeLabel: "test_rome_label",
        rome: remoteOffer.romeCode,
        website: establishment4.establishment.website,
        updatedAt: establishment4.establishment.updatedAt.toISOString(),
        createdAt: establishment4.establishment.createdAt.toISOString(),
        isAvailable: true,
      },
      {
        siret: establishment4.establishment.siret,
        appellations: [
          {
            appellationCode: hybridOffer.appellationCode,
            appellationLabel: hybridOffer.appellationLabel,
          },
        ],
        remoteWorkMode: "HYBRID",
        establishmentScore: establishment4.establishment.score,
        naf: establishment4.establishment.nafDto.code,
        nafLabel: "FAKE",
        name: establishment4.establishment.name,
        customizedName: establishment4.establishment.customizedName,
        numberOfEmployeeRange:
          establishment4.establishment.numberEmployeesRange,
        voluntaryToImmersion: establishment4.establishment.voluntaryToImmersion,
        additionalInformation:
          establishment4.establishment.additionalInformation,
        fitForDisabledWorkers: "no",
        position: establishment4.establishment.locations[0].position,
        address: establishment4.establishment.locations[0].address,
        locationId: establishment4.establishment.locations[0].id,
        contactMode: establishment4.establishment.contactMode,
        romeLabel: "test_rome_label",
        rome: hybridOffer.romeCode,
        website: establishment4.establishment.website,
        updatedAt: establishment4.establishment.updatedAt.toISOString(),
        createdAt: establishment4.establishment.createdAt.toISOString(),
        isAvailable: true,
      },
    ]);
  });

  it("should not include offers from banned establishment", async () => {
    const banEstablishmentPayload: BanEstablishmentPayload = {
      siret: establishment1.establishment.siret,
      establishmentBannishmentJustification:
        "Des crêpes à la poêle ? Sérieusement ??",
    };
    const bannedEstablishment1 = new EstablishmentAggregateBuilder(
      establishment1,
    )
      .withBannishmentInformations({
        isEstablishmentBanned: true,
        establishmentBannishmentJustification:
          banEstablishmentPayload.establishmentBannishmentJustification,
      })
      .build();

    uow.establishmentAggregateRepository.establishmentAggregates = [
      bannedEstablishment1,
      establishment2,
      establishment3,
    ];
    uow.bannedEstablishmentRepository.bannedEstablishments = [
      {
        siret: bannedEstablishment1.establishment.siret,
        establishmentBannishmentJustification:
          banEstablishmentPayload.establishmentBannishmentJustification,
      },
    ];
    const result: DataWithPagination<InternalOfferDto> =
      await getOffers.execute(
        { sortBy: "score", sortOrder: "desc", perPage: 2 },
        undefined,
      );

    expectToEqual(result, {
      data: [
        {
          siret: establishment2.establishment.siret,
          appellations: [
            {
              appellationCode: secretariatOffer.appellationCode,
              appellationLabel: secretariatOffer.appellationLabel,
            },
          ],
          establishmentScore: establishment2.establishment.score,
          naf: establishment2.establishment.nafDto.code,
          nafLabel: "FAKE",
          name: establishment2.establishment.name,
          customizedName: establishment2.establishment.customizedName,
          numberOfEmployeeRange:
            establishment2.establishment.numberEmployeesRange,
          voluntaryToImmersion:
            establishment2.establishment.voluntaryToImmersion,
          additionalInformation:
            establishment2.establishment.additionalInformation,
          remoteWorkMode: "ON_SITE",
          fitForDisabledWorkers: "no",
          position: establishment2.establishment.locations[0].position,
          address: establishment2.establishment.locations[0].address,
          locationId: establishment2.establishment.locations[0].id,
          contactMode: establishment2.establishment.contactMode,
          romeLabel: "test_rome_label",
          rome: secretariatOffer.romeCode,
          website: establishment2.establishment.website,
          updatedAt: establishment2.establishment.updatedAt.toISOString(),
          createdAt: establishment2.establishment.createdAt.toISOString(),
          isAvailable: true,
        },
        {
          siret: establishment3.establishment.siret,
          appellations: [
            {
              appellationCode: boulangerOffer.appellationCode,
              appellationLabel: boulangerOffer.appellationLabel,
            },
          ],
          establishmentScore: establishment3.establishment.score,
          naf: establishment3.establishment.nafDto.code,
          nafLabel: "FAKE",
          name: establishment3.establishment.name,
          customizedName: establishment3.establishment.customizedName,
          numberOfEmployeeRange:
            establishment3.establishment.numberEmployeesRange,
          voluntaryToImmersion:
            establishment3.establishment.voluntaryToImmersion,
          additionalInformation:
            establishment3.establishment.additionalInformation,
          remoteWorkMode: "ON_SITE",
          fitForDisabledWorkers: "no",
          position: establishment3.establishment.locations[0].position,
          address: establishment3.establishment.locations[0].address,
          locationId: establishment3.establishment.locations[0].id,
          contactMode: establishment3.establishment.contactMode,
          romeLabel: "test_rome_label",
          rome: boulangerOffer.romeCode,
          website: establishment3.establishment.website,
          updatedAt: establishment3.establishment.updatedAt.toISOString(),
          createdAt: establishment3.establishment.createdAt.toISOString(),
          isAvailable: true,
        },
      ],
      pagination: {
        currentPage: 1,
        numberPerPage: 2,
        totalPages: 1,
        totalRecords: 2,
      },
    });
  });
  it("should calculate totalRecords and pagination properly", async () => {
    await executeInSequence(Array.from({ length: 100 }), async (index) => {
      const establishmentAggregate = new EstablishmentAggregateBuilder()
        .withEstablishment(
          new EstablishmentEntityBuilder()
            .withSiret(`1111222233334${index}`)
            .build(),
        )
        .withOffers([
          new OfferEntityBuilder()
            .withRomeCode("B1805")
            .withAppellationCode("19540")
            .withAppellationLabel("Styliste")
            .build(),
        ])
        .withUserRights([
          {
            role: "establishment-admin",
            status: "ACCEPTED",
            userId: "osef",
            job: "",
            phone: "",
            shouldReceiveDiscussionNotifications: true,
            isMainContactByPhone: false,
          },
        ])
        .build();
      return uow.establishmentAggregateRepository.insertEstablishmentAggregate(
        establishmentAggregate,
      );
    });

    const response = await getOffers.execute(
      {
        sortBy: "score",
        sortOrder: "asc",
        page: 1,
        perPage: 10,
      },
      undefined,
    );

    expectToEqual(response.pagination, {
      totalRecords: 104,
      totalPages: 11,
      currentPage: 1,
      numberPerPage: 10,
    });
  });

  describe("wrong path", () => {
    it("should throw when sort is distance but no location is provided", async () => {
      await expectPromiseToFailWithError(
        getOffers.execute(
          {
            sortBy: "distance",
          } as any,
          undefined,
        ),
        new BadRequestError(
          "Schema validation failed in usecase GetOffers. See issues for details.",
          [
            "latitude : Invalid input: expected number, received NaN",
            "longitude : Invalid input: expected number, received NaN",
            "distanceKm : Invalid input: expected number, received NaN",
          ],
        ),
      );
    });

    it("needs complete geoparams, not partial, throws otherwise", async () => {
      await expectPromiseToFailWithError(
        getOffers.execute(
          {
            sortBy: "date",
            latitude: 48.856614,
            // missing longitude
            distanceKm: 80,
          } as any,
          undefined,
        ),
        new BadRequestError(
          "Invalid geo params, needs latitude, longitude and distanceKm",
        ),
      );
    });
  });
});
