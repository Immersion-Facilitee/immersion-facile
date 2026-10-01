import { subDays, subMonths } from "date-fns";
import {
  expectToEqual,
  immersionFacileNoReplyEmailSender,
  UserBuilder,
} from "shared";
import {
  type ExpectSavedNotificationsAndEvents,
  makeExpectSavedNotificationsAndEvents,
} from "../../../utils/makeExpectSavedNotificationAndEvent.helpers";
import { makeSaveNotificationsBatchAndRelatedEvent } from "../../core/notifications/helpers/Notification";
import { CustomTimeGateway } from "../../core/time-gateway/adapters/CustomTimeGateway";
import {
  createInMemoryUow,
  type InMemoryUnitOfWork,
} from "../../core/unit-of-work/adapters/createInMemoryUow";
import { InMemoryUowPerformer } from "../../core/unit-of-work/adapters/InMemoryUowPerformer";
import { UuidV4Generator } from "../../core/uuid-generator/adapters/UuidGeneratorImplementations";
import { EstablishmentAggregateBuilder } from "../helpers/EstablishmentBuilders";
import {
  makeSuggestEstablishmentsReengagement,
  type SuggestEstablishmentsReengagement,
} from "./SuggestEstablishmentsReengagement";

describe("SuggestEstablishmentsReengagement", () => {
  const now = new Date("2026-01-15T10:00:00.000Z");
  const sixMonthsAgo = subMonths(now, 6);

  const admin = new UserBuilder()
    .withId("aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa")
    .withEmail("admin@mail.com")
    .build();
  const otherAdmin = new UserBuilder()
    .withId("bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb")
    .withEmail("other.admin@mail.com")
    .build();
  const pendingAdmin = new UserBuilder()
    .withId("cccccccc-cccc-4ccc-cccc-cccccccccccc")
    .withEmail("pending.admin@mail.com")
    .build();
  const contact = new UserBuilder()
    .withId("dddddddd-dddd-4ddd-dddd-dddddddddddd")
    .withEmail("contact@mail.com")
    .build();

  let uow: InMemoryUnitOfWork;
  let timeGateway: CustomTimeGateway;
  let expectSavedNotificationsAndEvents: ExpectSavedNotificationsAndEvents;
  let suggestEstablishmentsReengagement: SuggestEstablishmentsReengagement;

  beforeEach(() => {
    uow = createInMemoryUow();
    uow.userRepository.users = [admin, otherAdmin, pendingAdmin, contact];
    timeGateway = new CustomTimeGateway(now);
    expectSavedNotificationsAndEvents = makeExpectSavedNotificationsAndEvents(
      uow.notificationRepository,
      uow.outboxRepository,
    );
    suggestEstablishmentsReengagement = makeSuggestEstablishmentsReengagement({
      deps: {
        uowPerformer: new InMemoryUowPerformer(uow),
        timeGateway,
        saveNotificationsBatchAndRelatedEvent:
          makeSaveNotificationsBatchAndRelatedEvent(
            new UuidV4Generator(),
            timeGateway,
          ),
        batchSize: 2,
        maxEstablishmentsToReengage: 10,
      },
    });
  });

  it("does nothing when no establishment needs to be reengaged", async () => {
    const result = await suggestEstablishmentsReengagement.execute();

    expectToEqual(result, {
      numberOfEstablishmentsNotified: 0,
      numberOfNotificationsSent: 0,
    });
    expectSavedNotificationsAndEvents({ emails: [] });
  });

  it("sends an email to each accepted admin of establishments not updated for 6 months", async () => {
    uow.establishmentAggregateRepository.establishmentAggregates = [
      new EstablishmentAggregateBuilder()
        .withEstablishmentSiret("11111111111111")
        .withEstablishmentName("SAS FRANCE MERGUEZ DISTRIBUTION")
        .withEstablishmentCustomizedName(undefined)
        .withEstablishmentUpdatedAt(subDays(sixMonthsAgo, 1))
        .withUserRights([
          {
            userId: admin.id,
            role: "establishment-admin",
            status: "ACCEPTED",
            job: "Boss",
            phone: "+33688779955",
            shouldReceiveDiscussionNotifications: true,
            isMainContactByPhone: false,
          },
          {
            userId: otherAdmin.id,
            role: "establishment-admin",
            status: "ACCEPTED",
            job: "Other boss",
            phone: "+33688779666",
            shouldReceiveDiscussionNotifications: true,
            isMainContactByPhone: false,
          },
          {
            userId: pendingAdmin.id,
            role: "establishment-admin",
            status: "PENDING",
            job: "Pending boss",
            phone: "+33688779777",
            shouldReceiveDiscussionNotifications: true,
            isMainContactByPhone: false,
          },
          {
            userId: contact.id,
            role: "establishment-contact",
            status: "ACCEPTED",
            shouldReceiveDiscussionNotifications: true,
          },
        ])
        .build(),
      new EstablishmentAggregateBuilder()
        .withEstablishmentSiret("22222222222222")
        .withEstablishmentName("BREIZH GALETTE")
        .withEstablishmentCustomizedName("La Bonne Galette")
        .withEstablishmentUpdatedAt(subDays(sixMonthsAgo, 1))
        .withUserRights([
          {
            userId: admin.id,
            role: "establishment-admin",
            status: "ACCEPTED",
            job: "Boss",
            phone: "+33688779955",
            shouldReceiveDiscussionNotifications: true,
            isMainContactByPhone: false,
          },
        ])
        .build(),
    ];

    const result = await suggestEstablishmentsReengagement.execute();

    expectToEqual(result, {
      numberOfEstablishmentsNotified: 2,
      numberOfNotificationsSent: 3,
    });
    expectSavedNotificationsAndEvents({
      emails: [
        {
          kind: "ESTABLISHMENT_REENGAGEMENT_SUGGESTION",
          sender: immersionFacileNoReplyEmailSender,
          recipients: [admin.email],
          params: { businessName: "SAS FRANCE MERGUEZ DISTRIBUTION" },
        },
        {
          kind: "ESTABLISHMENT_REENGAGEMENT_SUGGESTION",
          sender: immersionFacileNoReplyEmailSender,
          recipients: [otherAdmin.email],
          params: { businessName: "SAS FRANCE MERGUEZ DISTRIBUTION" },
        },
        {
          kind: "ESTABLISHMENT_REENGAGEMENT_SUGGESTION",
          sender: immersionFacileNoReplyEmailSender,
          recipients: [admin.email],
          params: { businessName: "La Bonne Galette" },
        },
      ],
    });
    expectToEqual(
      uow.notificationRepository.notifications.map(
        ({ followedIds }) => followedIds,
      ),
      [
        { establishmentSiret: "11111111111111" },
        { establishmentSiret: "11111111111111" },
        { establishmentSiret: "22222222222222" },
      ],
    );
  });

  it("does not suggest reengagement to establishments updated within the last 6 months", async () => {
    uow.establishmentAggregateRepository.establishmentAggregates = [
      new EstablishmentAggregateBuilder()
        .withEstablishmentSiret("11111111111111")
        .withEstablishmentUpdatedAt(sixMonthsAgo)
        .withUserRights([
          {
            userId: admin.id,
            role: "establishment-admin",
            status: "ACCEPTED",
            job: "Boss",
            phone: "+33688779955",
            shouldReceiveDiscussionNotifications: true,
            isMainContactByPhone: false,
          },
        ])
        .build(),
    ];

    const result = await suggestEstablishmentsReengagement.execute();

    expectToEqual(result, {
      numberOfEstablishmentsNotified: 0,
      numberOfNotificationsSent: 0,
    });
    expectSavedNotificationsAndEvents({ emails: [] });
  });

  it("does not suggest reengagement to establishments without accepted admin", async () => {
    uow.establishmentAggregateRepository.establishmentAggregates = [
      new EstablishmentAggregateBuilder()
        .withEstablishmentSiret("11111111111111")
        .withEstablishmentUpdatedAt(subDays(sixMonthsAgo, 1))
        .withUserRights([
          {
            userId: pendingAdmin.id,
            role: "establishment-admin",
            status: "PENDING",
            job: "Pending boss",
            phone: "+33688779777",
            shouldReceiveDiscussionNotifications: true,
            isMainContactByPhone: false,
          },
          {
            userId: contact.id,
            role: "establishment-contact",
            status: "ACCEPTED",
            shouldReceiveDiscussionNotifications: true,
          },
        ])
        .build(),
    ];

    const result = await suggestEstablishmentsReengagement.execute();

    expectToEqual(result, {
      numberOfEstablishmentsNotified: 0,
      numberOfNotificationsSent: 0,
    });
    expectSavedNotificationsAndEvents({ emails: [] });
  });

  it("suggests reengagement again only when the previous suggestion is older than 6 months", async () => {
    uow.establishmentAggregateRepository.establishmentAggregates = [
      new EstablishmentAggregateBuilder()
        .withEstablishmentSiret("11111111111111")
        .withEstablishmentUpdatedAt(subDays(sixMonthsAgo, 10))
        .withUserRights([
          {
            userId: admin.id,
            role: "establishment-admin",
            status: "ACCEPTED",
            job: "Boss",
            phone: "+33688779955",
            shouldReceiveDiscussionNotifications: true,
            isMainContactByPhone: false,
          },
        ])
        .build(),
      new EstablishmentAggregateBuilder()
        .withEstablishmentSiret("22222222222222")
        .withEstablishmentUpdatedAt(subDays(sixMonthsAgo, 10))
        .withUserRights([
          {
            userId: admin.id,
            role: "establishment-admin",
            status: "ACCEPTED",
            job: "Boss",
            phone: "+33688779955",
            shouldReceiveDiscussionNotifications: true,
            isMainContactByPhone: false,
          },
        ])
        .build(),
    ];
    uow.notificationRepository.notifications = [
      {
        kind: "email",
        id: "11111111-1111-4111-8111-111111111111",
        createdAt: subDays(now, 1).toISOString(),
        followedIds: { establishmentSiret: "11111111111111" },
        templatedContent: {
          kind: "ESTABLISHMENT_REENGAGEMENT_SUGGESTION",
          sender: immersionFacileNoReplyEmailSender,
          recipients: [admin.email],
          params: { businessName: "Recently suggested" },
        },
      },
      {
        kind: "email",
        id: "22222222-2222-4222-8222-222222222222",
        createdAt: subDays(sixMonthsAgo, 1).toISOString(),
        followedIds: { establishmentSiret: "22222222222222" },
        templatedContent: {
          kind: "ESTABLISHMENT_REENGAGEMENT_SUGGESTION",
          sender: immersionFacileNoReplyEmailSender,
          recipients: [admin.email],
          params: { businessName: "Suggested long ago" },
        },
      },
    ];

    const result = await suggestEstablishmentsReengagement.execute();

    expectToEqual(result, {
      numberOfEstablishmentsNotified: 1,
      numberOfNotificationsSent: 1,
    });
    expectToEqual(
      uow.notificationRepository.notifications.map(
        ({ followedIds }) => followedIds,
      ),
      [
        { establishmentSiret: "11111111111111" },
        { establishmentSiret: "22222222222222" },
        { establishmentSiret: "22222222222222" },
      ],
    );
  });

  it("suggests reengagement to the oldest updated establishments first, up to maxEstablishmentsToReengage", async () => {
    uow.establishmentAggregateRepository.establishmentAggregates = [
      new EstablishmentAggregateBuilder()
        .withEstablishmentSiret("33333333333333")
        .withEstablishmentUpdatedAt(subDays(sixMonthsAgo, 1))
        .withUserRights([
          {
            userId: admin.id,
            role: "establishment-admin",
            status: "ACCEPTED",
            job: "Boss",
            phone: "+33688779955",
            shouldReceiveDiscussionNotifications: true,
            isMainContactByPhone: false,
          },
        ])
        .build(),
      new EstablishmentAggregateBuilder()
        .withEstablishmentSiret("11111111111111")
        .withEstablishmentUpdatedAt(subDays(sixMonthsAgo, 30))
        .withUserRights([
          {
            userId: admin.id,
            role: "establishment-admin",
            status: "ACCEPTED",
            job: "Boss",
            phone: "+33688779955",
            shouldReceiveDiscussionNotifications: true,
            isMainContactByPhone: false,
          },
        ])
        .build(),
      new EstablishmentAggregateBuilder()
        .withEstablishmentSiret("22222222222222")
        .withEstablishmentUpdatedAt(subDays(sixMonthsAgo, 20))
        .withUserRights([
          {
            userId: admin.id,
            role: "establishment-admin",
            status: "ACCEPTED",
            job: "Boss",
            phone: "+33688779955",
            shouldReceiveDiscussionNotifications: true,
            isMainContactByPhone: false,
          },
        ])
        .build(),
    ];

    const result = await makeSuggestEstablishmentsReengagement({
      deps: {
        uowPerformer: new InMemoryUowPerformer(uow),
        timeGateway,
        saveNotificationsBatchAndRelatedEvent:
          makeSaveNotificationsBatchAndRelatedEvent(
            new UuidV4Generator(),
            timeGateway,
          ),
        batchSize: 2,
        maxEstablishmentsToReengage: 2,
      },
    }).execute();

    expectToEqual(result, {
      numberOfEstablishmentsNotified: 2,
      numberOfNotificationsSent: 2,
    });
    expectToEqual(
      uow.notificationRepository.notifications.map(
        ({ followedIds }) => followedIds,
      ),
      [
        { establishmentSiret: "11111111111111" },
        { establishmentSiret: "22222222222222" },
      ],
    );
  });

  it("notifies every selected establishment when they span several batches", async () => {
    uow.establishmentAggregateRepository.establishmentAggregates = [
      new EstablishmentAggregateBuilder()
        .withEstablishmentSiret("11111111111111")
        .withEstablishmentUpdatedAt(subDays(sixMonthsAgo, 3))
        .withUserRights([
          {
            userId: admin.id,
            role: "establishment-admin",
            status: "ACCEPTED",
            job: "Boss",
            phone: "+33688779955",
            shouldReceiveDiscussionNotifications: true,
            isMainContactByPhone: false,
          },
        ])
        .build(),
      new EstablishmentAggregateBuilder()
        .withEstablishmentSiret("22222222222222")
        .withEstablishmentUpdatedAt(subDays(sixMonthsAgo, 2))
        .withUserRights([
          {
            userId: admin.id,
            role: "establishment-admin",
            status: "ACCEPTED",
            job: "Boss",
            phone: "+33688779955",
            shouldReceiveDiscussionNotifications: true,
            isMainContactByPhone: false,
          },
        ])
        .build(),
      new EstablishmentAggregateBuilder()
        .withEstablishmentSiret("33333333333333")
        .withEstablishmentUpdatedAt(subDays(sixMonthsAgo, 1))
        .withUserRights([
          {
            userId: otherAdmin.id,
            role: "establishment-admin",
            status: "ACCEPTED",
            job: "Other boss",
            phone: "+33688779666",
            shouldReceiveDiscussionNotifications: true,
            isMainContactByPhone: false,
          },
        ])
        .build(),
    ];

    const result = await suggestEstablishmentsReengagement.execute();

    expectToEqual(result, {
      numberOfEstablishmentsNotified: 3,
      numberOfNotificationsSent: 3,
    });
    expectToEqual(
      uow.notificationRepository.notifications.map(
        ({ followedIds }) => followedIds,
      ),
      [
        { establishmentSiret: "11111111111111" },
        { establishmentSiret: "22222222222222" },
        { establishmentSiret: "33333333333333" },
      ],
    );
  });

  it("does not suggest reengagement twice to the same establishment on consecutive runs", async () => {
    uow.establishmentAggregateRepository.establishmentAggregates = [
      new EstablishmentAggregateBuilder()
        .withEstablishmentSiret("11111111111111")
        .withEstablishmentUpdatedAt(subDays(sixMonthsAgo, 1))
        .withUserRights([
          {
            userId: admin.id,
            role: "establishment-admin",
            status: "ACCEPTED",
            job: "Boss",
            phone: "+33688779955",
            shouldReceiveDiscussionNotifications: true,
            isMainContactByPhone: false,
          },
        ])
        .build(),
    ];

    const firstRunResult = await suggestEstablishmentsReengagement.execute();
    const secondRunResult = await suggestEstablishmentsReengagement.execute();

    expectToEqual(firstRunResult, {
      numberOfEstablishmentsNotified: 1,
      numberOfNotificationsSent: 1,
    });
    expectToEqual(secondRunResult, {
      numberOfEstablishmentsNotified: 0,
      numberOfNotificationsSent: 0,
    });
    expectSavedNotificationsAndEvents({
      emails: [
        {
          kind: "ESTABLISHMENT_REENGAGEMENT_SUGGESTION",
          sender: immersionFacileNoReplyEmailSender,
          recipients: [admin.email],
          params: { businessName: "Company inside repository" },
        },
      ],
    });
  });
});
