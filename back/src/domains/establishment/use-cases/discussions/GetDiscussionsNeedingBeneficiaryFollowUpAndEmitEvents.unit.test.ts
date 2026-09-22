import { addMilliseconds, subDays, subMilliseconds } from "date-fns";
import { DiscussionBuilder, expectToEqual } from "shared";
import {
  defaultPriority,
  makeCreateNewEvent,
} from "../../../core/events/ports/EventBus";
import { CustomTimeGateway } from "../../../core/time-gateway/adapters/CustomTimeGateway";
import type { TimeGateway } from "../../../core/time-gateway/ports/TimeGateway";
import {
  createInMemoryUow,
  type InMemoryUnitOfWork,
} from "../../../core/unit-of-work/adapters/createInMemoryUow";
import { InMemoryUowPerformer } from "../../../core/unit-of-work/adapters/InMemoryUowPerformer";
import { TestUuidGenerator } from "../../../core/uuid-generator/adapters/UuidGeneratorImplementations";
import { EstablishmentAggregateBuilder } from "../../helpers/EstablishmentBuilders";
import {
  type GetDiscussionsNeedingBeneficiaryFollowUpAndEmitEvents,
  makeGetDiscussionsNeedingBeneficiaryFollowUpAndEmitEvents,
} from "./GetDiscussionsNeedingBeneficiaryFollowUpAndEmitEvents";

describe("GetDiscussionsNeedingBeneficiaryFollowUpAndEmitEvents", () => {
  const siret = "11112222333344";

  let timeGateway: TimeGateway;
  let uow: InMemoryUnitOfWork;
  let uuidGenerator: TestUuidGenerator;
  let getDiscussionsNeedingBeneficiaryFollowUpAndEmitEvents: GetDiscussionsNeedingBeneficiaryFollowUpAndEmitEvents;

  beforeEach(() => {
    timeGateway = new CustomTimeGateway();
    uow = createInMemoryUow();
    uuidGenerator = new TestUuidGenerator();
    getDiscussionsNeedingBeneficiaryFollowUpAndEmitEvents =
      makeGetDiscussionsNeedingBeneficiaryFollowUpAndEmitEvents({
        uowPerformer: new InMemoryUowPerformer(uow),
        deps: {
          timeGateway,
          createNewEvent: makeCreateNewEvent({ timeGateway, uuidGenerator }),
        },
      });
  });

  it("emits an event only for discussions created between 15 and 16 days ago whose establishment has a main contact reachable by phone", async () => {
    const discussionCreatedJustInsideRecentBound = new DiscussionBuilder()
      .withId("aaaaad2c-6f02-11ec-90d6-0242ac120008")
      .withSiret(siret)
      .withCreatedAt(subMilliseconds(subDays(timeGateway.now(), 15), 1))
      .build();

    const discussionCreatedJustOutsideRecentBound = new DiscussionBuilder()
      .withId("aaaaad2c-6f02-11ec-90d6-0242ac120002")
      .withSiret(siret)
      .withCreatedAt(addMilliseconds(subDays(timeGateway.now(), 15), 1))
      .build();

    const discussionCreatedJustInsideOldestBound = new DiscussionBuilder()
      .withId("aaaaad2c-6f02-11ec-90d6-0242ac120009")
      .withSiret(siret)
      .withCreatedAt(addMilliseconds(subDays(timeGateway.now(), 16), 1))
      .build();

    const discussionCreatedJustOutsideOldestBound = new DiscussionBuilder()
      .withId("aaaaad2c-6f02-11ec-90d6-0242ac120010")
      .withSiret(siret)
      .withCreatedAt(subMilliseconds(subDays(timeGateway.now(), 16), 1))
      .build();

    const discussionCreatedTenDaysAgo = new DiscussionBuilder()
      .withId("aaaaad2c-6f02-11ec-90d6-0242ac120003")
      .withSiret(siret)
      .withCreatedAt(subDays(timeGateway.now(), 10))
      .build();

    const discussionCreatedTwentyDaysAgo = new DiscussionBuilder()
      .withId("aaaaad2c-6f02-11ec-90d6-0242ac120011")
      .withSiret(siret)
      .withCreatedAt(subDays(timeGateway.now(), 20))
      .build();

    uow.discussionRepository.discussions = [
      discussionCreatedTenDaysAgo,
      discussionCreatedJustOutsideRecentBound,
      discussionCreatedJustInsideRecentBound,
      discussionCreatedJustInsideOldestBound,
      discussionCreatedJustOutsideOldestBound,
      discussionCreatedTwentyDaysAgo,
    ];
    uow.establishmentAggregateRepository.establishmentAggregates = [
      new EstablishmentAggregateBuilder()
        .withEstablishmentSiret(siret)
        .withContactMode("EMAIL")
        .withUserRights([
          {
            role: "establishment-contact",
            status: "ACCEPTED",
            userId: "contact-user-id",
            job: "Crêpier",
            phone: "+33123456789",
            isMainContactByPhone: true,
            shouldReceiveDiscussionNotifications: false,
          },
        ])
        .build(),
    ];
    uuidGenerator.setNextUuids(["event-id-1", "event-id-2"]);

    expectToEqual(
      await getDiscussionsNeedingBeneficiaryFollowUpAndEmitEvents.execute(),
      { numberOfDiscussionsToFollowUp: 2 },
    );
    expectToEqual(uow.outboxRepository.events, [
      {
        topic: "DiscussionBeneficiaryFollowUpRequested",
        payload: {
          discussionId: discussionCreatedJustInsideRecentBound.id,
          triggeredBy: { kind: "crawler" },
        },
        id: "event-id-1",
        occurredAt: expect.any(String),
        publications: [],
        wasQuarantined: false,
        status: "never-published",
        priority: defaultPriority,
      },
      {
        topic: "DiscussionBeneficiaryFollowUpRequested",
        payload: {
          discussionId: discussionCreatedJustInsideOldestBound.id,
          triggeredBy: { kind: "crawler" },
        },
        id: "event-id-2",
        occurredAt: expect.any(String),
        publications: [],
        wasQuarantined: false,
        status: "never-published",
        priority: defaultPriority,
      },
    ]);
  });

  it("ignores a discussion already answered by the establishment", async () => {
    const createdAt = subDays(timeGateway.now(), 15);

    uow.discussionRepository.discussions = [
      new DiscussionBuilder()
        .withId("aaaaad2c-6f02-11ec-90d6-0242ac120004")
        .withSiret(siret)
        .withCreatedAt(createdAt)
        .withExchanges([
          {
            subject: "Mise en relation initiale",
            message: "Bonjour, je souhaite faire une immersion",
            sentAt: createdAt.toISOString(),
            sender: "potentialBeneficiary",
            attachments: [],
          },
          {
            subject: "Réponse de l'entreprise",
            message: "Bonjour, c'est possible",
            sentAt: createdAt.toISOString(),
            sender: "establishment",
            email: "contact@establishment.com",
            firstname: "John",
            lastname: "Doe",
            attachments: [],
          },
        ])
        .build(),
    ];
    uow.establishmentAggregateRepository.establishmentAggregates = [
      new EstablishmentAggregateBuilder()
        .withEstablishmentSiret(siret)
        .withContactMode("EMAIL")
        .withUserRights([
          {
            role: "establishment-contact",
            status: "ACCEPTED",
            userId: "contact-user-id",
            job: "Crêpier",
            phone: "+33123456789",
            isMainContactByPhone: true,
            shouldReceiveDiscussionNotifications: false,
          },
        ])
        .build(),
    ];

    expectToEqual(
      await getDiscussionsNeedingBeneficiaryFollowUpAndEmitEvents.execute(),
      { numberOfDiscussionsToFollowUp: 0 },
    );
    expectToEqual(uow.outboxRepository.events, []);
  });

  it("ignores a discussion whose establishment has no main contact by phone", async () => {
    uow.discussionRepository.discussions = [
      new DiscussionBuilder()
        .withId("aaaaad2c-6f02-11ec-90d6-0242ac120005")
        .withSiret(siret)
        .withCreatedAt(subDays(timeGateway.now(), 15))
        .build(),
    ];
    uow.establishmentAggregateRepository.establishmentAggregates = [
      new EstablishmentAggregateBuilder()
        .withEstablishmentSiret(siret)
        .withContactMode("EMAIL")
        .withUserRights([
          {
            role: "establishment-contact",
            status: "ACCEPTED",
            userId: "contact-user-id",
            job: "Crêpier",
            phone: "+33123456789",
            isMainContactByPhone: false,
            shouldReceiveDiscussionNotifications: false,
          },
        ])
        .build(),
    ];

    expectToEqual(
      await getDiscussionsNeedingBeneficiaryFollowUpAndEmitEvents.execute(),
      { numberOfDiscussionsToFollowUp: 0 },
    );
    expectToEqual(uow.outboxRepository.events, []);
  });

  it("ignores a discussion whose main contact by phone has no phone number", async () => {
    uow.discussionRepository.discussions = [
      new DiscussionBuilder()
        .withId("aaaaad2c-6f02-11ec-90d6-0242ac120006")
        .withSiret(siret)
        .withCreatedAt(subDays(timeGateway.now(), 15))
        .build(),
    ];
    uow.establishmentAggregateRepository.establishmentAggregates = [
      new EstablishmentAggregateBuilder()
        .withEstablishmentSiret(siret)
        .withContactMode("EMAIL")
        .withUserRights([
          {
            role: "establishment-contact",
            status: "ACCEPTED",
            userId: "contact-user-id",
            job: "Crêpier",
            phone: undefined,
            isMainContactByPhone: true,
            shouldReceiveDiscussionNotifications: false,
          },
        ])
        .build(),
    ];

    expectToEqual(
      await getDiscussionsNeedingBeneficiaryFollowUpAndEmitEvents.execute(),
      { numberOfDiscussionsToFollowUp: 0 },
    );
    expectToEqual(uow.outboxRepository.events, []);
  });

  it("ignores a discussion whose establishment is in email contact mode", async () => {
    uow.discussionRepository.discussions = [
      new DiscussionBuilder()
        .withId("aaaaad2c-6f02-11ec-90d6-0242ac120007")
        .withSiret(siret)
        .withCreatedAt(subDays(timeGateway.now(), 15))
        .build(),
    ];
    uow.establishmentAggregateRepository.establishmentAggregates = [
      new EstablishmentAggregateBuilder()
        .withEstablishmentSiret(siret)
        .withContactMode("PHONE")
        .withUserRights([
          {
            role: "establishment-contact",
            status: "ACCEPTED",
            userId: "contact-user-id",
            job: "Crêpier",
            phone: "+33123456789",
            isMainContactByPhone: true,
            shouldReceiveDiscussionNotifications: false,
          },
        ])
        .build(),
    ];

    expectToEqual(
      await getDiscussionsNeedingBeneficiaryFollowUpAndEmitEvents.execute(),
      { numberOfDiscussionsToFollowUp: 0 },
    );
    expectToEqual(uow.outboxRepository.events, []);
  });

  it("does not emit any event when there is no discussion to follow up", async () => {
    uow.discussionRepository.discussions = [];
    uow.establishmentAggregateRepository.establishmentAggregates = [
      new EstablishmentAggregateBuilder()
        .withEstablishmentSiret(siret)
        .withContactMode("EMAIL")
        .withUserRights([
          {
            role: "establishment-contact",
            status: "ACCEPTED",
            userId: "contact-user-id",
            job: "Crêpier",
            phone: "+33123456789",
            isMainContactByPhone: true,
            shouldReceiveDiscussionNotifications: false,
          },
        ])
        .build(),
    ];

    expectToEqual(
      await getDiscussionsNeedingBeneficiaryFollowUpAndEmitEvents.execute(),
      { numberOfDiscussionsToFollowUp: 0 },
    );
    expectToEqual(uow.outboxRepository.events, []);
  });
});
