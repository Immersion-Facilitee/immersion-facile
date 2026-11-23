import {
  type AdminEstablishmentListItemDto,
  adminEstablishmentListDefaultPerPage,
  adminEstablishmentListMaxPerPage,
  ConnectedUserBuilder,
  ConventionDtoBuilder,
  DiscussionBuilder,
  errors,
  expectPromiseToFailWithError,
  expectToEqual,
  type Location,
  UserBuilder,
} from "shared";
import {
  createInMemoryOutOfTransactionQueries,
  createInMemoryUow,
  type InMemoryUnitOfWork,
} from "../../core/unit-of-work/adapters/createInMemoryUow";
import type { EstablishmentContactRight } from "../entities/EstablishmentAggregate";
import {
  EstablishmentAggregateBuilder,
  EstablishmentEntityBuilder,
} from "../helpers/EstablishmentBuilders";
import {
  type GetEstablishmentsForAdmin,
  makeGetEstablishmentsForAdmin,
} from "./GetEstablishmentsForAdmin";

describe("GetEstablishmentsForAdmin", () => {
  const admin = new ConnectedUserBuilder()
    .withId("admin-id")
    .withIsAdmin(true)
    .build();
  const notAdmin = new ConnectedUserBuilder()
    .withId("not-admin-id")
    .withIsAdmin(false)
    .build();

  const contact = new UserBuilder()
    .withId("contact-id")
    .withEmail("jean.dupont@boulangerie.fr")
    .withFirstName("Jean")
    .withLastName("Dupont")
    .build();

  const contactRight: EstablishmentContactRight = {
    role: "establishment-contact",
    status: "ACCEPTED",
    userId: contact.id,
    shouldReceiveDiscussionNotifications: true,
  };

  const lyonLocation: Location = {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    address: {
      streetNumberAndAddress: "1 rue de la République",
      postcode: "69001",
      departmentCode: "69",
      city: "Lyon",
    },
    position: { lat: 45.764, lon: 4.8357 },
  };

  const villeurbanneLocation: Location = {
    id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    address: {
      streetNumberAndAddress: "2 avenue Henri Barbusse",
      postcode: "69100",
      departmentCode: "69",
      city: "Villeurbanne",
    },
    position: { lat: 45.7667, lon: 4.8833 },
  };

  const bakery = new EstablishmentAggregateBuilder()
    .withEstablishment(
      new EstablishmentEntityBuilder()
        .withSiret("11111111111111")
        .withName("BOULANGERIE DU CENTRE")
        .withCustomizedName("Le Fournil")
        .withLocations([villeurbanneLocation, lyonLocation])
        .withCreatedAt(new Date("2024-01-10T10:00:00.000Z"))
        .withUpdatedAt(new Date("2026-10-20T10:00:00.000Z"))
        .build(),
    )
    .withUserRights([contactRight])
    .build();

  const garage = new EstablishmentAggregateBuilder()
    .withEstablishment(
      new EstablishmentEntityBuilder()
        .withSiret("22222222222222")
        .withName("GARAGE MARTIN")
        .withCustomizedName(undefined)
        .withLocations([lyonLocation])
        .withCreatedAt(new Date("2025-03-01T10:00:00.000Z"))
        .withUpdatedAt(new Date("2025-06-15T10:00:00.000Z"))
        .build(),
    )
    .build();

  const bakeryListItem: AdminEstablishmentListItemDto = {
    siret: "11111111111111",
    name: "BOULANGERIE DU CENTRE",
    customizedName: "Le Fournil",
    city: "Lyon",
    postcode: "69001",
    otherLocationsCount: 1,
    createdAt: "2024-01-10T10:00:00.000Z",
    updatedAt: "2026-10-20T10:00:00.000Z",
    discussionsCount: 2,
    validatedConventionsCount: 1,
  };

  const garageListItem: AdminEstablishmentListItemDto = {
    siret: "22222222222222",
    name: "GARAGE MARTIN",
    customizedName: null,
    city: "Lyon",
    postcode: "69001",
    otherLocationsCount: 0,
    createdAt: "2025-03-01T10:00:00.000Z",
    updatedAt: "2025-06-15T10:00:00.000Z",
    discussionsCount: 0,
    validatedConventionsCount: 0,
  };

  let getEstablishmentsForAdmin: GetEstablishmentsForAdmin;
  let uow: InMemoryUnitOfWork;

  beforeEach(() => {
    uow = createInMemoryUow();
    getEstablishmentsForAdmin = makeGetEstablishmentsForAdmin({
      deps: {
        establishmentAggregateQueries:
          createInMemoryOutOfTransactionQueries(uow).establishmentAggregate,
      },
    });
    uow.establishmentAggregateRepository.establishmentAggregates = [
      garage,
      bakery,
    ];
    uow.userRepository.users = [contact];
    uow.discussionRepository.discussions = [
      new DiscussionBuilder()
        .withId("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1")
        .withSiret(bakery.establishment.siret)
        .build(),
      new DiscussionBuilder()
        .withId("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2")
        .withSiret(bakery.establishment.siret)
        .build(),
    ];
    uow.conventionRepository.setConventions([
      new ConventionDtoBuilder()
        .withId("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1")
        .withSiret(bakery.establishment.siret)
        .withStatus("ACCEPTED_BY_VALIDATOR")
        .build(),
      new ConventionDtoBuilder()
        .withId("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2")
        .withSiret(bakery.establishment.siret)
        .withStatus("READY_TO_SIGN")
        .build(),
    ]);
  });

  it("throws forbidden when current user is not backoffice admin", async () => {
    await expectPromiseToFailWithError(
      getEstablishmentsForAdmin.execute({}, notAdmin),
      errors.user.forbidden({ userId: notAdmin.id }),
    );
  });

  it("returns all establishments, most recently updated first, with their first location and counts", async () => {
    expectToEqual(await getEstablishmentsForAdmin.execute({}, admin), {
      data: [bakeryListItem, garageListItem],
      pagination: {
        currentPage: 1,
        numberPerPage: adminEstablishmentListDefaultPerPage,
        totalPages: 1,
        totalRecords: 2,
      },
    });
  });

  it("paginates establishments", async () => {
    expectToEqual(
      await getEstablishmentsForAdmin.execute({ page: 2, perPage: 1 }, admin),
      {
        data: [garageListItem],
        pagination: {
          currentPage: 2,
          numberPerPage: 1,
          totalPages: 2,
          totalRecords: 2,
        },
      },
    );
  });

  it("caps the number of establishments per page", async () => {
    expectToEqual(
      (
        await getEstablishmentsForAdmin.execute(
          { perPage: adminEstablishmentListMaxPerPage + 1 },
          admin,
        )
      ).pagination.numberPerPage,
      adminEstablishmentListMaxPerPage,
    );
  });

  describe("search", () => {
    it.each([
      ["complete siret", "22222222222222", [garageListItem]],
      ["complete siret with spaces", "222 222 222 22222", [garageListItem]],
      ["partial name, case insensitive", "garage mar", [garageListItem]],
      ["partial customized name", "fournil", [bakeryListItem]],
      [
        "complete contact email",
        "Jean.Dupont@Boulangerie.fr",
        [bakeryListItem],
      ],
      ["contact first name then last name", "jean dupont", [bakeryListItem]],
      ["contact last name then first name", "dupont jean", [bakeryListItem]],
    ])("finds establishments by %s", async (_, search, expectedData) => {
      expectToEqual(
        (await getEstablishmentsForAdmin.execute({ search }, admin)).data,
        expectedData,
      );
    });

    it.each([
      ["partial siret", "2222222"],
      ["partial contact email", "@boulangerie.fr"],
      ["unknown name", "pharmacie"],
    ])("does not find establishments by %s", async (_, search) => {
      expectToEqual(
        await getEstablishmentsForAdmin.execute({ search }, admin),
        {
          data: [],
          pagination: {
            currentPage: 1,
            numberPerPage: adminEstablishmentListDefaultPerPage,
            totalPages: 1,
            totalRecords: 0,
          },
        },
      );
    });

    it("rejects a search shorter than 3 characters", async () => {
      await expectPromiseToFailWithError(
        getEstablishmentsForAdmin.execute({ search: "bo" }, admin),
        errors.inputs.badSchema({
          useCaseName: "GetEstablishmentsForAdmin",
          flattenErrors: ["search : Le minimum est de 3 caractères"],
        }),
      );
    });
  });
});
