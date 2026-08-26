import {
  ConnectedUserBuilder,
  defaultAddress,
  defaultCountryCode,
  defaultValidFormEstablishment,
  errors,
  expectObjectInArrayToMatch,
  expectPromiseToFailWithError,
  expectToEqual,
  type FormEstablishmentBatchDto,
  type FormEstablishmentDto,
  FormEstablishmentDtoBuilder,
  type GroupOptions,
} from "shared";
import { InMemoryAddressGateway } from "../../core/address/adapters/InMemoryAddressGateway";
import { makeCreateNewEvent } from "../../core/events/ports/EventBus";
import {
  InMemorySiretGateway,
  TEST_OPEN_ESTABLISHMENT_1,
  TEST_OPEN_ESTABLISHMENT_2,
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
} from "../helpers/EstablishmentBuilders";
import {
  type AddFormEstablishmentBatch,
  makeAddFormEstablishmentBatch,
} from "./AddFormEstablismentsBatch";
import { makeInsertEstablishmentAggregateFromForm } from "./InsertEstablishmentAggregateFromFormEstablishement";

describe("AddFormEstablishmentsBatch Use Case", () => {
  const userNotAdmin = new ConnectedUserBuilder().withIsAdmin(false).build();

  const userAdmin = new ConnectedUserBuilder().withIsAdmin(true).build();

  const groupOptions: GroupOptions = {
    heroHeader: {
      title: "My title",
      description: "My description",
    },
  };

  const createFormEstablishmentBatchDto = (): FormEstablishmentBatchDto => {
    const formEstablishment1: FormEstablishmentDto =
      FormEstablishmentDtoBuilder.valid()
        .withSiret(TEST_OPEN_ESTABLISHMENT_1.siret)
        .build();

    const formEstablishment2: FormEstablishmentDto =
      FormEstablishmentDtoBuilder.valid()
        .withSiret(TEST_OPEN_ESTABLISHMENT_2.siret)
        .withBusinessName("michelin")
        .build();

    return {
      groupName: "L'amie caliné",
      title: groupOptions.heroHeader.title,
      description: groupOptions.heroHeader.description,
      formEstablishments: [formEstablishment1, formEstablishment2],
    };
  };

  let uow: InMemoryUnitOfWork;
  let addFormEstablishmentBatch: AddFormEstablishmentBatch;
  let siretGateway: InMemorySiretGateway;
  let uuidGenerator: TestUuidGenerator;
  let timeGateway: CustomTimeGateway;

  const formEstablishmentBatch = createFormEstablishmentBatchDto();

  beforeEach(() => {
    uow = createInMemoryUow();
    siretGateway = new InMemorySiretGateway();
    uuidGenerator = new TestUuidGenerator();
    timeGateway = new CustomTimeGateway();
    const addressGateway = new InMemoryAddressGateway();
    const uowPerformer = new InMemoryUowPerformer(uow);

    addFormEstablishmentBatch = makeAddFormEstablishmentBatch({
      deps: {
        insertEstablishmentAggregateFromForm:
          makeInsertEstablishmentAggregateFromForm({
            uowPerformer,
            deps: {
              siretGateway,
              addressGateway,
              uuidGenerator,
              timeGateway,
              createNewEvent: makeCreateNewEvent({
                timeGateway,
                uuidGenerator,
              }),
            },
          }),
        uowPerformer,
      },
    });

    addressGateway.setNextLookupStreetAndAddresses([
      [
        {
          ...defaultAddress.addressAndPosition,
          address: {
            ...defaultAddress.addressAndPosition.address,
            countryCode: defaultCountryCode,
          },
          formattedAddress: "Fake address",
        },
      ],
      [
        {
          ...defaultAddress.addressAndPosition,
          address: {
            ...defaultAddress.addressAndPosition.address,
            countryCode: defaultCountryCode,
          },
          formattedAddress: "Fake address",
        },
      ],
    ]);

    uow.romeRepository.appellations = defaultValidFormEstablishment.offers;
  });

  it("throws Forbidden if currentUser user is not admin", async () => {
    await expectPromiseToFailWithError(
      addFormEstablishmentBatch.execute(formEstablishmentBatch, userNotAdmin),
      errors.user.forbidden({ userId: userNotAdmin.id }),
    );
  });

  it("Adds two formEstablishments successfully and returns report", async () => {
    uuidGenerator.setNextUuids(["1", "2", "3", "4", "5", "6"]);
    const report = await addFormEstablishmentBatch.execute(
      formEstablishmentBatch,
      userAdmin,
    );

    expectToEqual(report, {
      numberOfEstablishmentsProcessed: 2,
      numberOfSuccess: 2,
      failures: [],
    });

    expectToEqual(uow.userRepository.users, [
      {
        createdAt: "2021-09-01T10:10:00.000Z",
        preventToDelete: false,
        email: "amil@mail.com",
        proConnect: null,
        firstName: "",
        id: "1",
        lastName: "",
      },
      {
        createdAt: "2021-09-01T10:10:00.000Z",
        preventToDelete: false,
        email: "copy1@mail.com",
        proConnect: null,
        firstName: "",
        id: "2",
        lastName: "",
      },
      {
        createdAt: "2021-09-01T10:10:00.000Z",
        preventToDelete: false,
        email: "copy2@mail.com",
        proConnect: null,
        firstName: "",
        id: "3",
        lastName: "",
      },
    ]);

    expectToEqual(
      uow.establishmentAggregateRepository.establishmentAggregates,
      await Promise.all(
        formEstablishmentBatch.formEstablishments.map(async (form) =>
          new EstablishmentAggregateBuilder()
            .withEstablishment(
              new EstablishmentEntityBuilder()
                .withSiret(form.siret)
                .withCustomizedName(form.businessNameCustomized)
                .withNafDto(
                  (await siretGateway.getEstablishmentBySiret(form.siret))
                    ?.nafDto || { code: "", nomenclature: "" },
                )
                .withCreatedAt(timeGateway.now())
                .withUpdatedAt(timeGateway.now())
                .withIsCommited(false)
                .withName(form.businessName)
                .withNumberOfEmployeeRange("3-5")
                .withWebsite(form.website)
                .withNextAvailabilityDate(
                  form.nextAvailabilityDate &&
                    new Date(form.nextAvailabilityDate),
                )
                .withAcquisition({
                  acquisitionCampaign: form.acquisitionCampaign,
                  acquisitionKeyword: form.acquisitionKeyword,
                })
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
              form.offers.map((offer) => ({
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
                userId: "1",
                shouldReceiveDiscussionNotifications: true,
                isMainContactByPhone: false,
              },
              {
                role: "establishment-contact",
                status: "ACCEPTED",
                userId: "2",
                shouldReceiveDiscussionNotifications: false,
              },
              {
                role: "establishment-contact",
                status: "ACCEPTED",
                userId: "3",
                shouldReceiveDiscussionNotifications: true,
              },
            ])
            .build(),
        ),
      ),
    );
  });

  it("reports the errors when something goes wrong with an addition", async () => {
    uuidGenerator.setNextUuids(["1", "2", "3", "4", "5", "6"]);
    const existingFormEstablishment =
      formEstablishmentBatch.formEstablishments[0];
    uow.establishmentAggregateRepository.insertEstablishmentAggregate(
      new EstablishmentAggregateBuilder()
        .withEstablishment(
          new EstablishmentEntityBuilder()
            .withSiret(existingFormEstablishment.siret)
            .withCustomizedName(
              existingFormEstablishment.businessNameCustomized,
            )
            .withNafDto({ code: "", nomenclature: "" })
            .withCreatedAt(timeGateway.now())
            .withUpdatedAt(timeGateway.now())
            .withIsCommited(false)
            .withName(existingFormEstablishment.businessName)
            .withNumberOfEmployeeRange("0")
            .withLocations([])
            .withWebsite(existingFormEstablishment.website)
            .withNextAvailabilityDate(
              existingFormEstablishment.nextAvailabilityDate &&
                new Date(existingFormEstablishment.nextAvailabilityDate),
            )
            .withAcquisition({
              acquisitionCampaign:
                existingFormEstablishment.acquisitionCampaign,
              acquisitionKeyword: existingFormEstablishment.acquisitionKeyword,
            })
            .withScore(0)
            .build(),
        )
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
        .build(),
    );

    const report = await addFormEstablishmentBatch.execute(
      formEstablishmentBatch,
      userAdmin,
    );

    expectToEqual(report, {
      numberOfEstablishmentsProcessed: 2,
      numberOfSuccess: 1,
      failures: [
        {
          errorMessage: errors.establishment.conflictError({
            siret: existingFormEstablishment.siret,
          }).message,
          siret: existingFormEstablishment.siret,
        },
      ],
    });
  });

  it("Saves an event with topic : 'NewEstablishmentAggregateInsertedFromForm'", async () => {
    uuidGenerator.setNextUuids(["1", "2", "3", "4", "5", "6"]);

    const report = await addFormEstablishmentBatch.execute(
      formEstablishmentBatch,
      userAdmin,
    );

    expectToEqual(report, {
      failures: [],
      numberOfEstablishmentsProcessed: 2,
      numberOfSuccess: 2,
    });

    expectObjectInArrayToMatch(uow.outboxRepository.events, [
      {
        id: "4",
        topic: "NewEstablishmentAggregateInsertedFromForm",
        payload: {
          establishmentAggregate: new EstablishmentAggregateBuilder()
            .withEstablishment(
              new EstablishmentEntityBuilder()
                .withSiret(formEstablishmentBatch.formEstablishments[0].siret)
                .withCustomizedName(
                  formEstablishmentBatch.formEstablishments[0]
                    .businessNameCustomized,
                )
                .withNafDto({ code: "7112B", nomenclature: "Ref2" })
                .withCreatedAt(timeGateway.now())
                .withUpdatedAt(timeGateway.now())
                .withIsCommited(false)
                .withName(
                  formEstablishmentBatch.formEstablishments[0].businessName,
                )
                .withNumberOfEmployeeRange("3-5")
                .withLocations([
                  {
                    ...defaultAddress.addressAndPosition,
                    id: defaultAddress.formAddress.id,
                  },
                ])
                .withWebsite(
                  formEstablishmentBatch.formEstablishments[0].website,
                )
                .withNextAvailabilityDate(
                  formEstablishmentBatch.formEstablishments[0]
                    .nextAvailabilityDate &&
                    new Date(
                      formEstablishmentBatch.formEstablishments[0]
                        .nextAvailabilityDate,
                    ),
                )
                .withAcquisition({
                  acquisitionCampaign:
                    formEstablishmentBatch.formEstablishments[0]
                      .acquisitionCampaign,
                  acquisitionKeyword:
                    formEstablishmentBatch.formEstablishments[0]
                      .acquisitionKeyword,
                })
                .withScore(0)
                .build(),
            )
            .withUserRights([
              {
                role: "establishment-admin",
                status: "ACCEPTED",
                job: "a job",
                phone: "+33612345678",
                userId: "1",
                shouldReceiveDiscussionNotifications: true,
                isMainContactByPhone: false,
              },
              {
                role: "establishment-contact",
                status: "ACCEPTED",
                userId: "2",
                shouldReceiveDiscussionNotifications: false,
              },
              {
                role: "establishment-contact",
                status: "ACCEPTED",
                userId: "3",
                shouldReceiveDiscussionNotifications: true,
              },
            ])
            .withOffers(
              formEstablishmentBatch.formEstablishments[0].offers.map(
                (offer) => ({
                  ...offer,
                  createdAt: timeGateway.now(),
                }),
              ),
            )
            .build(),
          triggeredBy: {
            kind: "connected-user",
            userId: userAdmin.id,
          },
        },
      },
      {
        id: "5",
        topic: "NewEstablishmentAggregateInsertedFromForm",
        payload: {
          establishmentAggregate: new EstablishmentAggregateBuilder()
            .withEstablishment(
              new EstablishmentEntityBuilder()
                .withSiret(formEstablishmentBatch.formEstablishments[1].siret)
                .withCustomizedName(
                  formEstablishmentBatch.formEstablishments[1]
                    .businessNameCustomized,
                )
                .withNafDto({ code: "8559A", nomenclature: "Ref2" })
                .withCreatedAt(timeGateway.now())
                .withUpdatedAt(timeGateway.now())
                .withIsCommited(false)
                .withName(
                  formEstablishmentBatch.formEstablishments[1].businessName,
                )
                .withNumberOfEmployeeRange("3-5")
                .withLocations([
                  {
                    ...defaultAddress.addressAndPosition,
                    id: defaultAddress.formAddress.id,
                  },
                ])
                .withWebsite(
                  formEstablishmentBatch.formEstablishments[1].website,
                )
                .withNextAvailabilityDate(
                  formEstablishmentBatch.formEstablishments[1]
                    .nextAvailabilityDate &&
                    new Date(
                      formEstablishmentBatch.formEstablishments[1]
                        .nextAvailabilityDate,
                    ),
                )
                .withAcquisition({
                  acquisitionCampaign:
                    formEstablishmentBatch.formEstablishments[1]
                      .acquisitionCampaign,
                  acquisitionKeyword:
                    formEstablishmentBatch.formEstablishments[1]
                      .acquisitionKeyword,
                })
                .withScore(0)
                .build(),
            )
            .withOffers(
              formEstablishmentBatch.formEstablishments[1].offers.map(
                (offer) => ({
                  ...offer,
                  createdAt: timeGateway.now(),
                }),
              ),
            )
            .withUserRights([
              {
                role: "establishment-admin",
                status: "ACCEPTED",
                job: "a job",
                phone: "+33612345678",
                userId: "1",
                shouldReceiveDiscussionNotifications: true,
                isMainContactByPhone: false,
              },
              {
                role: "establishment-contact",
                status: "ACCEPTED",
                userId: "2",
                shouldReceiveDiscussionNotifications: false,
              },
              {
                role: "establishment-contact",
                status: "ACCEPTED",
                userId: "3",
                shouldReceiveDiscussionNotifications: true,
              },
            ])
            .build(),
          triggeredBy: {
            kind: "connected-user",
            userId: userAdmin.id,
          },
        },
      },
    ]);
  });

  it("creates the establishmentGroup with the sirets of the establishments", async () => {
    uuidGenerator.setNextUuids(["event1-id", "event2-id"]);

    await addFormEstablishmentBatch.execute(formEstablishmentBatch, userAdmin);

    expect(uow.groupRepository.groupEntities).toHaveLength(1);
    expectToEqual(uow.groupRepository.groupEntities[0], {
      slug: "l-amie-caline",
      name: formEstablishmentBatch.groupName,
      sirets: [
        formEstablishmentBatch.formEstablishments[0].siret,
        formEstablishmentBatch.formEstablishments[1].siret,
      ],
      options: groupOptions,
    });
  });

  it("updates Group if it already exists", async () => {
    const slug = "l-amie-caline";
    await uow.groupRepository.save({
      slug,
      name: formEstablishmentBatch.groupName,
      sirets: [formEstablishmentBatch.formEstablishments[0].siret],
      options: groupOptions,
    });
    await uow.establishmentAggregateRepository.insertEstablishmentAggregate(
      new EstablishmentAggregateBuilder()
        .withEstablishment(
          new EstablishmentEntityBuilder()
            .withSiret(formEstablishmentBatch.formEstablishments[0].siret)
            .withCustomizedName(
              formEstablishmentBatch.formEstablishments[0]
                .businessNameCustomized,
            )
            .withNafDto({ code: "", nomenclature: "" })
            .withCreatedAt(timeGateway.now())
            .withUpdatedAt(timeGateway.now())
            .withIsCommited(false)
            .withName(formEstablishmentBatch.formEstablishments[0].businessName)
            .withNumberOfEmployeeRange("0")
            .withLocations([])
            .withWebsite(formEstablishmentBatch.formEstablishments[0].website)
            .withNextAvailabilityDate(
              formEstablishmentBatch.formEstablishments[0]
                .nextAvailabilityDate &&
                new Date(
                  formEstablishmentBatch.formEstablishments[0]
                    .nextAvailabilityDate,
                ),
            )
            .withAcquisition({
              acquisitionCampaign:
                formEstablishmentBatch.formEstablishments[0]
                  .acquisitionCampaign,
              acquisitionKeyword:
                formEstablishmentBatch.formEstablishments[0].acquisitionKeyword,
            })
            .withScore(0)
            .build(),
        )
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
        .build(),
    );
    uuidGenerator.setNextUuids(["event1-id", "event2-id"]);

    const report = await addFormEstablishmentBatch.execute(
      formEstablishmentBatch,
      userAdmin,
    );

    expectToEqual(report, {
      numberOfEstablishmentsProcessed: 2,
      numberOfSuccess: 1,
      failures: [
        {
          siret: formEstablishmentBatch.formEstablishments[0].siret,
          errorMessage: errors.establishment.conflictError({
            siret: formEstablishmentBatch.formEstablishments[0].siret,
          }).message,
        },
      ],
    });

    expectToEqual(uow.groupRepository.groupEntities, [
      {
        slug,
        name: formEstablishmentBatch.groupName,
        sirets: [
          formEstablishmentBatch.formEstablishments[0].siret,
          formEstablishmentBatch.formEstablishments[1].siret,
        ],
        options: groupOptions,
      },
    ]);
  });
});
