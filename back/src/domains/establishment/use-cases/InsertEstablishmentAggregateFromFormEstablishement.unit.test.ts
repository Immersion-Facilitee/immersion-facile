import {
  type AdminFormEstablishmentUserRight,
  type AppellationAndRomeDto,
  type BanEstablishmentPayload,
  ConnectedUserBuilder,
  type ContactFormEstablishmentUserRight,
  defaultAddress,
  defaultCountryCode,
  type EstablishmentFormOffer,
  errors,
  expectObjectInArrayToMatch,
  expectPromiseToFailWithError,
  expectToEqual,
  FormEstablishmentDtoBuilder,
  type NafDto,
  type NumberEmployeesRange,
  UserBuilder,
  type WithAcquisition,
} from "shared";
import {
  InMemoryAddressGateway,
  rueGuillaumeTellDto,
} from "../../core/address/adapters/InMemoryAddressGateway";
import { makeCreateNewEvent } from "../../core/events/ports/EventBus";
import {
  InMemorySiretGateway,
  SiretEstablishmentDtoBuilder,
  TEST_OPEN_ESTABLISHMENT_1,
} from "../../core/sirene/adapters/InMemorySiretGateway";
import { CustomTimeGateway } from "../../core/time-gateway/adapters/CustomTimeGateway";
import {
  createInMemoryUow,
  type InMemoryUnitOfWork,
} from "../../core/unit-of-work/adapters/createInMemoryUow";
import { InMemoryUowPerformer } from "../../core/unit-of-work/adapters/InMemoryUowPerformer";
import { TestUuidGenerator } from "../../core/uuid-generator/adapters/UuidGeneratorImplementations";
import {
  EstablishmentAggregateBuilder,
  EstablishmentEntityBuilder,
  OfferEntityBuilder,
} from "../helpers/EstablishmentBuilders";
import {
  type InsertEstablishmentAggregateFromForm,
  makeInsertEstablishmentAggregateFromForm,
} from "./InsertEstablishmentAggregateFromFormEstablishement";

describe("InsertEstablishmentAggregateFromForm", () => {
  const validFormEstablishmentWithSiret = FormEstablishmentDtoBuilder.valid()
    .withSiret("90040893100013")
    .build();

  const expectedNafDto: NafDto = { code: "8559A", nomenclature: "nomencl" };
  const numberEmployeesRanges: NumberEmployeesRange = "6-9";
  const userBuilder = new ConnectedUserBuilder().withId("ic-user");
  const connectedUser = userBuilder.build();
  const user = userBuilder.buildUser();

  const establishmentAdmin = new UserBuilder()
    .withFirstName("El patron")
    .withLastName("De la vega!")
    .withEmail("admin@estab.com")
    .withId("estab.admin")
    .build();
  const establishmentContact = new UserBuilder()
    .withFirstName("El contacto")
    .withLastName("De otro lugar")
    .withEmail("contact@estab.com")
    .withId("estab.contact")
    .build();

  const appellations: AppellationAndRomeDto[] = [
    {
      romeCode: "A1101",
      appellationCode: "11717",
      romeLabel: "métier A",
      appellationLabel: "métier A.1",
    },
    {
      romeCode: "A1102",
      appellationCode: "11716",
      romeLabel: "métier B",
      appellationLabel: "métier B.1",
    },
  ];

  const formAdminRight: AdminFormEstablishmentUserRight = {
    role: "establishment-admin",
    status: "ACCEPTED",
    email: establishmentAdmin.email,
    job: "osef",
    phone: "+33655445544",
    shouldReceiveDiscussionNotifications: true,
    isMainContactByPhone: false,
  };

  const formContactRight: ContactFormEstablishmentUserRight = {
    role: "establishment-contact",
    status: "ACCEPTED",
    email: establishmentContact.email,
    shouldReceiveDiscussionNotifications: true,
  };

  let siretGateway: InMemorySiretGateway;
  let addressGateway: InMemoryAddressGateway;
  let uuidGenerator: TestUuidGenerator;
  let timeGateway: CustomTimeGateway;
  let uow: InMemoryUnitOfWork;
  let insertEstablishmentAggregateFromForm: InsertEstablishmentAggregateFromForm;

  beforeEach(() => {
    siretGateway = new InMemorySiretGateway();
    addressGateway = new InMemoryAddressGateway();
    uuidGenerator = new TestUuidGenerator();
    timeGateway = new CustomTimeGateway();
    uow = createInMemoryUow();

    insertEstablishmentAggregateFromForm =
      makeInsertEstablishmentAggregateFromForm({
        uowPerformer: new InMemoryUowPerformer(uow),
        deps: {
          siretGateway,
          addressGateway,
          uuidGenerator,
          timeGateway,
          createNewEvent: makeCreateNewEvent({ timeGateway, uuidGenerator }),
        },
      });

    addressGateway.setNextLookupStreetAndAddresses([
      [
        {
          address: {
            ...defaultAddress.addressAndPosition.address,
            countryCode: defaultCountryCode,
          },
          position: defaultAddress.addressAndPosition.position,
          formattedAddress: "Fake address",
        },
      ],
    ]);

    siretGateway.setSirenEstablishment({
      ...TEST_OPEN_ESTABLISHMENT_1,
      siret: validFormEstablishmentWithSiret.siret,
      nafDto: expectedNafDto,
      numberEmployeesRange: numberEmployeesRanges,
    });

    uow.romeRepository.appellations = appellations;
    uow.userRepository.users = [user];

    uuidGenerator.setNextUuids([
      establishmentAdmin.id,
      establishmentContact.id,
    ]);
  });

  describe("Converts Form Establishment in Aggregate", () => {
    it("And create user that doesn't exist by email", async () => {
      const withAcquisition: WithAcquisition = {
        acquisitionKeyword: "yolo",
        acquisitionCampaign: "my campaign",
      };

      const nextAvailabilityDate = new Date();

      const formEstablishment = FormEstablishmentDtoBuilder.valid()
        .withFitForDisabledWorkers("yes-declared-only")
        .withSiret("90040893100013")
        .withOffers(
          appellations.map((appellation) => ({
            ...appellation,
            remoteWorkMode: "ON_SITE",
          })),
        )
        .withNextAvailabilityDate(nextAvailabilityDate)
        .withAcquisition(withAcquisition)
        .withBusinessAddresses([defaultAddress.formAddress])
        .withUserRights([formAdminRight, formContactRight])
        .build();

      await insertEstablishmentAggregateFromForm.execute(
        { formEstablishment },
        connectedUser,
      );

      expectToEqual(uow.userRepository.users, [
        user,
        {
          ...establishmentAdmin,
          firstName: "",
          lastName: "",
          createdAt: timeGateway.now().toISOString(),
        },
        {
          ...establishmentContact,
          firstName: "",
          lastName: "",
          createdAt: timeGateway.now().toISOString(),
        },
      ]);

      expectToEqual(
        uow.establishmentAggregateRepository.establishmentAggregates,
        [
          new EstablishmentAggregateBuilder()
            .withEstablishment(
              new EstablishmentEntityBuilder()
                .withSiret(formEstablishment.siret)
                .withCustomizedName(formEstablishment.businessNameCustomized)
                .withNafDto(expectedNafDto)
                .withCreatedAt(timeGateway.now())
                .withUpdatedAt(timeGateway.now())
                .withName(formEstablishment.businessName)
                .withNumberOfEmployeeRange(numberEmployeesRanges)
                .withLocations([
                  {
                    ...defaultAddress.addressAndPosition,
                    id: defaultAddress.formAddress.id,
                  },
                ])
                .withWebsite(formEstablishment.website)
                .withNextAvailabilityDate(nextAvailabilityDate)
                .withAcquisition(withAcquisition)
                .withScore(0)
                .build(),
            )
            .withFitForDisabledWorkers("yes-declared-only")
            .withUserRights([
              {
                role: "establishment-admin",
                status: "ACCEPTED",
                job: formAdminRight.job,
                phone: formAdminRight.phone,
                userId: establishmentAdmin.id,
                shouldReceiveDiscussionNotifications: true,
                isMainContactByPhone: false,
              },
              {
                role: "establishment-contact",
                status: "ACCEPTED",
                userId: establishmentContact.id,
                shouldReceiveDiscussionNotifications: true,
              },
            ])
            .withOffers(
              appellations.map((prof) =>
                new OfferEntityBuilder({
                  ...prof,
                  remoteWorkMode: "ON_SITE",
                  createdAt: timeGateway.now(),
                }).build(),
              ),
            )
            .build(),
        ],
      );
    });

    it("And doesn't modify user that aldready exist by email", async () => {
      const withAcquisition: WithAcquisition = {
        acquisitionKeyword: "yolo",
        acquisitionCampaign: "my campaign",
      };
      const professions: EstablishmentFormOffer[] = [
        {
          romeCode: "A1101",
          appellationCode: "11717",
          romeLabel: "métier A",
          appellationLabel: "métier A.1",
          remoteWorkMode: "ON_SITE",
        },
        {
          romeCode: "A1102",
          appellationCode: "11716",
          romeLabel: "métier B",
          appellationLabel: "métier B.1",
          remoteWorkMode: "ON_SITE",
        },
      ];
      const nextAvailabilityDate = new Date();
      const formEstablishment = FormEstablishmentDtoBuilder.valid()
        .withFitForDisabledWorkers("yes-declared-only")
        .withSiret("90040893100013")
        .withOffers(professions)
        .withNextAvailabilityDate(nextAvailabilityDate)
        .withAcquisition(withAcquisition)
        .withBusinessAddresses([defaultAddress.formAddress])
        .withUserRights([formAdminRight, formContactRight])
        .build();

      siretGateway.setSirenEstablishment({
        ...TEST_OPEN_ESTABLISHMENT_1,
        siret: formEstablishment.siret,
        nafDto: expectedNafDto,
        numberEmployeesRange: numberEmployeesRanges,
      });

      uow.userRepository.users = [establishmentAdmin, establishmentContact];
      uow.romeRepository.appellations = professions;

      await insertEstablishmentAggregateFromForm.execute(
        { formEstablishment },
        connectedUser,
      );

      expectToEqual(uow.userRepository.users, [
        establishmentAdmin,
        establishmentContact,
      ]);

      expectToEqual(
        uow.establishmentAggregateRepository.establishmentAggregates,
        [
          new EstablishmentAggregateBuilder()
            .withEstablishment(
              new EstablishmentEntityBuilder()
                .withSiret(formEstablishment.siret)
                .withCustomizedName(formEstablishment.businessNameCustomized)
                .withNafDto(expectedNafDto)
                .withCreatedAt(timeGateway.now())
                .withUpdatedAt(timeGateway.now())
                .withName(formEstablishment.businessName)
                .withNumberOfEmployeeRange(numberEmployeesRanges)
                .withLocations([
                  {
                    ...defaultAddress.addressAndPosition,
                    id: defaultAddress.formAddress.id,
                  },
                ])
                .withWebsite(formEstablishment.website)
                .withNextAvailabilityDate(nextAvailabilityDate)
                .withAcquisition(withAcquisition)
                .withScore(0)
                .build(),
            )
            .withFitForDisabledWorkers("yes-declared-only")
            .withUserRights([
              {
                role: "establishment-admin",
                status: "ACCEPTED",
                job: formAdminRight.job,
                phone: formAdminRight.phone,
                userId: establishmentAdmin.id,
                shouldReceiveDiscussionNotifications: true,
                isMainContactByPhone: false,
              },
              {
                role: "establishment-contact",
                status: "ACCEPTED",
                userId: establishmentContact.id,
                shouldReceiveDiscussionNotifications: true,
              },
            ])
            .withOffers(
              professions.map((prof) =>
                new OfferEntityBuilder({
                  ...prof,
                  createdAt: timeGateway.now(),
                }).build(),
              ),
            )
            .build(),
        ],
      );
    });

    it("Can create establishment with potentialBeneficiaryWelcomeAddress", async () => {
      const formEstablishment = FormEstablishmentDtoBuilder.valid()
        .withSiret("90040893100013")
        .withContactMode("IN_PERSON")
        .withPotentialBeneficiaryWelcomeAddress(
          defaultAddress.addressAndPosition,
        )
        .withUserRights([
          {
            ...formAdminRight,
            isMainContactInPerson: true,
          },
          formContactRight,
        ])
        .build();

      uow.romeRepository.appellations = formEstablishment.offers;

      await insertEstablishmentAggregateFromForm.execute(
        { formEstablishment },
        connectedUser,
      );

      expectToEqual(
        uow.establishmentAggregateRepository.establishmentAggregates,
        [
          new EstablishmentAggregateBuilder()
            .withEstablishment(
              new EstablishmentEntityBuilder()
                .withSiret(formEstablishment.siret)
                .withCustomizedName(formEstablishment.businessNameCustomized)
                .withName(formEstablishment.businessName)
                .withNumberOfEmployeeRange(numberEmployeesRanges)
                .withLocations([
                  {
                    ...defaultAddress.addressAndPosition,
                    id: defaultAddress.formAddress.id,
                  },
                ])
                .withWebsite(formEstablishment.website)
                .withNextAvailabilityDate(
                  formEstablishment.nextAvailabilityDate &&
                    new Date(formEstablishment.nextAvailabilityDate),
                )
                .withAcquisition({
                  acquisitionCampaign: formEstablishment.acquisitionCampaign,
                  acquisitionKeyword: formEstablishment.acquisitionKeyword,
                })
                .withScore(0)
                .withCreatedAt(timeGateway.now())
                .withUpdatedAt(timeGateway.now())
                .withContactMode(formEstablishment.contactMode)
                .withWelcomeAddress(defaultAddress.addressAndPosition)
                .withNafDto(expectedNafDto)
                .build(),
            )
            .withOffers(
              formEstablishment.offers.map((prof) =>
                new OfferEntityBuilder({
                  ...prof,
                  createdAt: timeGateway.now(),
                }).build(),
              ),
            )
            .withUserRights([
              {
                isMainContactByPhone: formAdminRight.isMainContactByPhone,
                isMainContactInPerson: true,
                job: formAdminRight.job,
                phone: formAdminRight.phone,
                role: "establishment-admin",
                status: "ACCEPTED",
                shouldReceiveDiscussionNotifications:
                  formAdminRight.shouldReceiveDiscussionNotifications,
                userId: establishmentAdmin.id,
              },
              {
                role: "establishment-contact",
                status: "ACCEPTED",
                shouldReceiveDiscussionNotifications:
                  formContactRight.shouldReceiveDiscussionNotifications,
                userId: establishmentContact.id,
              },
            ])
            .build(),
        ],
      );
    });

    it("Can't create establishment when same email is used in admin and copy contacts", async () => {
      const formEstablishment = FormEstablishmentDtoBuilder.valid()
        .withUserRights([
          formAdminRight,
          {
            role: "establishment-contact",
            status: "ACCEPTED",
            email: formAdminRight.email,
            shouldReceiveDiscussionNotifications: true,
          },
        ])
        .build();

      await expectPromiseToFailWithError(
        insertEstablishmentAggregateFromForm.execute(
          { formEstablishment },
          connectedUser,
        ),
        errors.inputs.badSchema({
          useCaseName: "InsertEstablishmentAggregateFromForm",
          id: formEstablishment.siret,
          flattenErrors: [
            "formEstablishment.userRights : La structure accueillante ne peut pas avoir plusieurs droits pour la même personne.",
          ],
        }),
      );
    });

    it("Can't create establishment when same email is used in copy contacts", async () => {
      const formEstablishment = FormEstablishmentDtoBuilder.valid()
        .withUserRights([formAdminRight, formContactRight, formContactRight])
        .build();

      await expectPromiseToFailWithError(
        insertEstablishmentAggregateFromForm.execute(
          { formEstablishment },
          connectedUser,
        ),
        errors.inputs.badSchema({
          useCaseName: "InsertEstablishmentAggregateFromForm",
          id: formEstablishment.siret,
          flattenErrors: [
            "formEstablishment.userRights : La structure accueillante ne peut pas avoir plusieurs droits pour la même personne.",
          ],
        }),
      );
    });

    it("Can't create establishment when no admin right provided", async () => {
      const formEstablishment = FormEstablishmentDtoBuilder.valid()
        .withUserRights([formContactRight])
        .build();

      await expectPromiseToFailWithError(
        insertEstablishmentAggregateFromForm.execute(
          { formEstablishment },
          connectedUser,
        ),
        errors.inputs.badSchema({
          useCaseName: "InsertEstablishmentAggregateFromForm",
          id: formEstablishment.siret,
          flattenErrors: [
            "formEstablishment.userRights : La structure accueillante nécessite au moins un administrateur pour être valide.",
          ],
        }),
      );
    });

    it("Can't create establishment when establishment siret is banned", async () => {
      const banEstablishment: BanEstablishmentPayload = {
        siret: "12345678912345",
        establishmentBannishmentJustification: "Justification valide",
      };

      const formEstablishment = FormEstablishmentDtoBuilder.valid()
        .withSiret(banEstablishment.siret)
        .withUserRights([formAdminRight])
        .build();

      uow.bannedEstablishmentRepository.bannedEstablishments = [
        banEstablishment,
      ];

      await expectPromiseToFailWithError(
        insertEstablishmentAggregateFromForm.execute(
          { formEstablishment },
          { ...connectedUser, isBackofficeAdmin: true },
        ),
        errors.establishment.bannedEstablishment({
          siret: banEstablishment.siret,
        }),
      );
    });
  });

  it("Correctly converts establishment with a 'tranche d'effectif salarié' of 00", async () => {
    const formEstablishment = FormEstablishmentDtoBuilder.valid()
      .withSiret("90040893100013")
      .build();

    siretGateway.setSirenEstablishment({
      ...TEST_OPEN_ESTABLISHMENT_1,
      siret: formEstablishment.siret,
      nafDto: expectedNafDto,
      numberEmployeesRange: "0",
    });
    uow.romeRepository.appellations = formEstablishment.offers;

    await insertEstablishmentAggregateFromForm.execute(
      { formEstablishment },
      connectedUser,
    );

    const establishmentAggregate =
      uow.establishmentAggregateRepository.establishmentAggregates[0];
    expect(establishmentAggregate).toBeDefined();
    expect(establishmentAggregate.establishment.siret).toEqual(
      formEstablishment.siret,
    );
    expect(establishmentAggregate.establishment.numberEmployeesRange).toBe("0");
  });

  it("Throws if establishment and offers with same siret already exists", async () => {
    const previousEstablishment = new EstablishmentEntityBuilder()
      .withSiret("12345678911234")
      .withName("Previous name")
      .build();

    const aggregateInRepo = new EstablishmentAggregateBuilder()
      .withEstablishment(previousEstablishment)
      .withOffers([
        new OfferEntityBuilder().build(),
        new OfferEntityBuilder().build(),
      ])
      .withUserRights([
        {
          role: "establishment-admin",
          status: "ACCEPTED",
          job: "",
          phone: "",
          userId: establishmentAdmin.id,
          shouldReceiveDiscussionNotifications: true,
          isMainContactByPhone: false,
        },
        {
          role: "establishment-contact",
          status: "ACCEPTED",
          userId: establishmentContact.id,
          shouldReceiveDiscussionNotifications: true,
        },
      ])
      .build();

    uow.establishmentAggregateRepository.establishmentAggregates = [
      aggregateInRepo,
    ];

    const newRomeCode = "A1101";
    const formEstablishment = FormEstablishmentDtoBuilder.valid()
      .withSiret(previousEstablishment.siret)
      .withBusinessAddresses([defaultAddress.formAddress])
      .withOffers([
        {
          romeCode: newRomeCode,
          appellationCode: "22222",
          romeLabel: "Boulangerie",
          appellationLabel: "Boulanger",
          remoteWorkMode: "ON_SITE",
        },
      ])
      .withUserRights([formAdminRight])
      .build();

    siretGateway.setSirenEstablishment({
      ...TEST_OPEN_ESTABLISHMENT_1,
      siret: formEstablishment.siret,
      nafDto: expectedNafDto,
      numberEmployeesRange: "6-9",
    });

    addressGateway.setNextLookupStreetAndAddresses([
      [
        {
          address: {
            ...rueGuillaumeTellDto,
            countryCode: defaultCountryCode,
          },
          position: { lat: 1, lon: 1 },
          formattedAddress: "Fake address",
        },
      ],
    ]);

    await expectPromiseToFailWithError(
      insertEstablishmentAggregateFromForm.execute(
        { formEstablishment },
        connectedUser,
      ),
      errors.establishment.conflictError({
        siret: previousEstablishment.siret,
      }),
    );
  });

  it("Publishes an event with the new establishment aggregate as payload", async () => {
    siretGateway.setSirenEstablishment({
      ...TEST_OPEN_ESTABLISHMENT_1,
      siret: validFormEstablishmentWithSiret.siret,
      nafDto: expectedNafDto,
      numberEmployeesRange: "0",
    });

    uow.romeRepository.appellations = validFormEstablishmentWithSiret.offers;

    await insertEstablishmentAggregateFromForm.execute(
      {
        formEstablishment: validFormEstablishmentWithSiret,
      },
      connectedUser,
    );

    const createdAggregate = new EstablishmentAggregateBuilder()
      .withEstablishment(
        new EstablishmentEntityBuilder()
          .withSiret(validFormEstablishmentWithSiret.siret)
          .withName(validFormEstablishmentWithSiret.businessName)
          .withSearchableBy(validFormEstablishmentWithSiret.searchableBy)
          .withContactMode(validFormEstablishmentWithSiret.contactMode)
          .withCustomizedName(
            validFormEstablishmentWithSiret.businessNameCustomized,
          )
          .withFitForDisabledWorkers(
            validFormEstablishmentWithSiret.fitForDisabledWorkers,
          )
          .withMaxContactsPerMonth(
            validFormEstablishmentWithSiret.maxContactsPerMonth,
          )
          .withNumberOfEmployeeRange("0")
          .withSourceProvider(validFormEstablishmentWithSiret.source)
          .withWebsite(validFormEstablishmentWithSiret.website)
          .withNafDto(expectedNafDto)
          .withAcquisition({
            acquisitionCampaign:
              validFormEstablishmentWithSiret.acquisitionCampaign,
            acquisitionKeyword:
              validFormEstablishmentWithSiret.acquisitionKeyword,
          })
          .withNextAvailabilityDate(
            validFormEstablishmentWithSiret.nextAvailabilityDate &&
              new Date(validFormEstablishmentWithSiret.nextAvailabilityDate),
          )
          .withCreatedAt(timeGateway.now())
          .withUpdatedAt(timeGateway.now())
          .withAdditionalInformation(
            validFormEstablishmentWithSiret.additionalInformation,
          )
          .withScore(0)
          .build(),
      )
      .withLocations([
        {
          ...defaultAddress.addressAndPosition,
          id: defaultAddress.formAddress.id,
        },
      ])
      .withOffers(
        validFormEstablishmentWithSiret.offers.map((offer) => ({
          ...offer,
          createdAt: timeGateway.now(),
        })),
      )
      .withUserRights([
        {
          role: "establishment-admin",
          status: "ACCEPTED",
          job: "a job",
          phone: "+33612345678",
          userId: "estab.admin",
          shouldReceiveDiscussionNotifications: true,
          isMainContactByPhone: false,
        },
        {
          role: "establishment-contact",
          status: "ACCEPTED",
          userId: "estab.contact",
          shouldReceiveDiscussionNotifications: false,
        },
        {
          role: "establishment-contact",
          status: "ACCEPTED",
          userId: "no-uuid-provided",
          shouldReceiveDiscussionNotifications: true,
        },
      ])
      .build();
    expectToEqual(
      uow.establishmentAggregateRepository.establishmentAggregates,
      [createdAggregate],
    );

    expectObjectInArrayToMatch(uow.outboxRepository.events, [
      {
        topic: "NewEstablishmentAggregateInsertedFromForm",
        payload: {
          establishmentAggregate: createdAggregate,
          triggeredBy: {
            kind: "connected-user",
            userId: user.id,
          },
        },
      },
    ]);
  });

  describe("Behaviors from old AddFromEstablishment", () => {
    it("saves an establishment in the repository and publish event", async () => {
      const formEstablishment = FormEstablishmentDtoBuilder.valid()
        .withFitForDisabledWorkers("yes-declared-only")
        .withBusinessAddresses([defaultAddress.formAddress])
        .withMaxContactsPerMonth(9)
        .withNextAvailabilityDate(new Date())
        .build();

      siretGateway.setSirenEstablishment({
        ...TEST_OPEN_ESTABLISHMENT_1,
        siret: formEstablishment.siret,
        nafDto: expectedNafDto,
        numberEmployeesRange: "0",
      });

      uow.romeRepository.appellations = formEstablishment.offers;

      await insertEstablishmentAggregateFromForm.execute(
        { formEstablishment },
        connectedUser,
      );

      const createdAggregate = new EstablishmentAggregateBuilder()
        .withEstablishment(
          new EstablishmentEntityBuilder()
            .withSiret(formEstablishment.siret)
            .withName(formEstablishment.businessName)
            .withSearchableBy(formEstablishment.searchableBy)
            .withContactMode(formEstablishment.contactMode)
            .withCustomizedName(formEstablishment.businessNameCustomized)
            .withFitForDisabledWorkers(formEstablishment.fitForDisabledWorkers)
            .withMaxContactsPerMonth(formEstablishment.maxContactsPerMonth)
            .withNumberOfEmployeeRange("0")
            .withSourceProvider(formEstablishment.source)
            .withWebsite(formEstablishment.website)
            .withNafDto(expectedNafDto)
            .withAcquisition({
              acquisitionCampaign: formEstablishment.acquisitionCampaign,
              acquisitionKeyword: formEstablishment.acquisitionKeyword,
            })
            .withNextAvailabilityDate(
              formEstablishment.nextAvailabilityDate &&
                new Date(formEstablishment.nextAvailabilityDate),
            )
            .withCreatedAt(timeGateway.now())
            .withUpdatedAt(timeGateway.now())
            .withAdditionalInformation(formEstablishment.additionalInformation)
            .withScore(0)
            .build(),
        )
        .withOffers(
          formEstablishment.offers.map((app) => ({
            ...app,
            createdAt: timeGateway.now(),
          })),
        )
        .withLocations([
          {
            ...defaultAddress.addressAndPosition,
            id: defaultAddress.formAddress.id,
          },
        ])
        .withUserRights([
          {
            role: "establishment-admin",
            status: "ACCEPTED",
            job: "a job",
            phone: "+33612345678",
            userId: "estab.admin",
            shouldReceiveDiscussionNotifications: true,
            isMainContactByPhone: false,
          },
          {
            role: "establishment-contact",
            status: "ACCEPTED",
            userId: "estab.contact",
            shouldReceiveDiscussionNotifications: false,
          },
          {
            role: "establishment-contact",
            status: "ACCEPTED",
            userId: "no-uuid-provided",
            shouldReceiveDiscussionNotifications: true,
          },
        ])
        .build();

      expectToEqual(
        uow.establishmentAggregateRepository.establishmentAggregates,
        [createdAggregate],
      );

      expectObjectInArrayToMatch(uow.outboxRepository.events, [
        {
          topic: "NewEstablishmentAggregateInsertedFromForm",
          payload: {
            establishmentAggregate: createdAggregate,
            triggeredBy: {
              kind: "connected-user",
              userId: user.id,
            },
          },
        },
      ]);
    });

    it("considers appellation_code as a reference, and ignores the labels, and rome (it fetches the one matching the appellation code anyways)", async () => {
      const weirdEstablishmentOffer: EstablishmentFormOffer = {
        appellationCode: "12694", // le bon code
        appellationLabel:
          "une boulette, ca devrait être 'Coiffeur / Coiffeuse mixte'",
        romeCode: "A0000", // devrait être D1202
        romeLabel: "une autre boulette, ca devrait être 'Coiffure'",
        remoteWorkMode: "ON_SITE",
      };

      const formEstablishmentWithWeirdAppellationDto =
        FormEstablishmentDtoBuilder.valid()
          .withBusinessAddresses([defaultAddress.formAddress])
          .withOffers([weirdEstablishmentOffer])
          .build();

      const correctEstablishmentOffer: EstablishmentFormOffer = {
        appellationCode: "12694",
        appellationLabel: "Coiffeur / Coiffeuse mixte",
        romeCode: "D1202",
        romeLabel: "Coiffure",
        remoteWorkMode: "ON_SITE",
      };
      uow.romeRepository.appellations = [correctEstablishmentOffer];

      const numberEmployees = "6-9";
      siretGateway.setSirenEstablishment({
        ...TEST_OPEN_ESTABLISHMENT_1,
        siret: formEstablishmentWithWeirdAppellationDto.siret,
        nafDto: expectedNafDto,
        numberEmployeesRange: numberEmployees,
      });

      await insertEstablishmentAggregateFromForm.execute(
        {
          formEstablishment: formEstablishmentWithWeirdAppellationDto,
        },
        connectedUser,
      );

      const form = FormEstablishmentDtoBuilder.valid()
        .withOffers([correctEstablishmentOffer])
        .withBusinessAddresses([defaultAddress.formAddress])
        .build();

      expectToEqual(
        uow.establishmentAggregateRepository.establishmentAggregates,
        [
          new EstablishmentAggregateBuilder()
            .withEstablishment(
              new EstablishmentEntityBuilder()
                .withSiret(form.siret)
                .withName(form.businessName)
                .withSearchableBy(form.searchableBy)
                .withContactMode(form.contactMode)
                .withCustomizedName(form.businessNameCustomized)
                .withFitForDisabledWorkers(form.fitForDisabledWorkers)
                .withMaxContactsPerMonth(form.maxContactsPerMonth)
                .withNumberOfEmployeeRange(numberEmployees)
                .withSourceProvider(form.source)
                .withWebsite(form.website)
                .withNafDto(expectedNafDto)
                .withAcquisition({
                  acquisitionCampaign: form.acquisitionCampaign,
                  acquisitionKeyword: form.acquisitionKeyword,
                })
                .withNextAvailabilityDate(
                  form.nextAvailabilityDate &&
                    new Date(form.nextAvailabilityDate),
                )
                .withCreatedAt(timeGateway.now())
                .withUpdatedAt(timeGateway.now())
                .withAdditionalInformation(form.additionalInformation)
                .withScore(0)
                .build(),
            )
            .withLocations([
              {
                ...defaultAddress.addressAndPosition,
                id: defaultAddress.formAddress.id,
              },
            ])
            .withOffers([
              {
                ...correctEstablishmentOffer,
                createdAt: timeGateway.now(),
              },
            ])
            .withUserRights([
              {
                role: "establishment-admin",
                status: "ACCEPTED",
                job: "a job",
                phone: "+33612345678",
                userId: "estab.admin",
                shouldReceiveDiscussionNotifications: true,
                isMainContactByPhone: false,
              },
              {
                role: "establishment-contact",
                status: "ACCEPTED",
                userId: "estab.contact",
                shouldReceiveDiscussionNotifications: false,
              },
              {
                role: "establishment-contact",
                status: "ACCEPTED",
                userId: "no-uuid-provided",
                shouldReceiveDiscussionNotifications: true,
              },
            ])
            .build(),
        ],
      );
    });

    it("cannot save an establishment with same siret", async () => {
      const formEstablishment = FormEstablishmentDtoBuilder.valid().build();

      const existingAggregateWithSameSiret = new EstablishmentAggregateBuilder()
        .withEstablishmentSiret(formEstablishment.siret)
        .withUserRights([
          {
            role: "establishment-admin",
            status: "ACCEPTED",
            job: "",
            phone: "",
            userId: "",
            shouldReceiveDiscussionNotifications: true,
            isMainContactByPhone: false,
          },
        ])
        .build();

      uow.establishmentAggregateRepository.establishmentAggregates = [
        existingAggregateWithSameSiret,
      ];

      await expectPromiseToFailWithError(
        insertEstablishmentAggregateFromForm.execute(
          {
            formEstablishment,
          },
          connectedUser,
        ),
        errors.establishment.conflictError({ siret: formEstablishment.siret }),
      );
    });

    describe("SIRET validation", () => {
      const formEstablishment = FormEstablishmentDtoBuilder.valid()
        .withSiret(TEST_OPEN_ESTABLISHMENT_1.siret)
        .build();

      const siretRawInactiveEstablishment = new SiretEstablishmentDtoBuilder()
        .withSiret(formEstablishment.siret)
        .withIsActive(false)
        .withBusinessName("INACTIVE BUSINESS")
        .withBusinessAddress("20 AVENUE DE SEGUR 75007 PARIS 7")
        .withNafDto({ code: "78.3Z", nomenclature: "Ref2" })
        .build();

      it("rejects formEstablishment with SIRETs that don't correspond to active businesses", async () => {
        siretGateway.setSirenEstablishment(siretRawInactiveEstablishment);

        await expectPromiseToFailWithError(
          insertEstablishmentAggregateFromForm.execute(
            { formEstablishment },
            connectedUser,
          ),
          errors.establishment.missingOrClosed({
            siret: formEstablishment.siret,
          }),
        );
      });

      it("accepts formEstablishment with SIRETs that correspond to active businesses", async () => {
        siretGateway.setSirenEstablishment(
          new SiretEstablishmentDtoBuilder().build(),
        );

        uow.romeRepository.appellations = formEstablishment.offers;

        await insertEstablishmentAggregateFromForm.execute(
          {
            formEstablishment,
          },
          connectedUser,
        );

        expect(uow.outboxRepository.events).toHaveLength(1);
        expect(
          uow.establishmentAggregateRepository.establishmentAggregates,
        ).toHaveLength(1);
      });

      it("Throws errors when the SIRET endpoint throws erorrs", async () => {
        const error = new Error("test error");
        siretGateway.setError(error);

        await expectPromiseToFailWithError(
          insertEstablishmentAggregateFromForm.execute(
            { formEstablishment },
            connectedUser,
          ),
          errors.siretApi.unavailable({ serviceName: "Sirene API" }),
        );
      });
    });
  });
});
