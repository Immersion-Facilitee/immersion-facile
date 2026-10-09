import { subDays, subMilliseconds, subYears } from "date-fns";
import { expectToEqual, makeBooleanFeatureFlag } from "shared";
import { EstablishmentAggregateBuilder } from "../../../../establishment/helpers/EstablishmentBuilders";
import { makeCreateNewEvent } from "../../../events/ports/EventBus";
import { CustomTimeGateway } from "../../../time-gateway/adapters/CustomTimeGateway";
import {
  createInMemoryUow,
  type InMemoryUnitOfWork,
} from "../../../unit-of-work/adapters/createInMemoryUow";
import { InMemoryUowPerformer } from "../../../unit-of-work/adapters/InMemoryUowPerformer";
import type { UnitOfWork } from "../../../unit-of-work/ports/UnitOfWork";
import type { UnitOfWorkPerformer } from "../../../unit-of-work/ports/UnitOfWorkPerformer";
import { UuidV4Generator } from "../../../uuid-generator/adapters/UuidGeneratorImplementations";
import {
  makeUser,
  saveDeletionWarningNotification,
  setUsersWithRecentConventions,
  setUsersWithRecentEstablishmentExchanges,
  setUserWithOldConventionAndDiscussion,
} from "./inactiveUsersTest.helpers";
import {
  makeTriggerEventsToDeleteInactiveUsers,
  type TriggerEventsToDeleteInactiveUsers,
} from "./TriggerEventsToDeleteInactiveUsers";

describe("TriggerEventsToDeleteInactiveUsers", () => {
  const now = new Date("2026-01-15T10:00:00.000Z");
  const twoYearsAgo = subYears(now, 2);
  const inactiveLastLoginAt = subDays(twoYearsAgo, 1).toISOString();

  let uow: InMemoryUnitOfWork;
  let triggerEventsToDeleteInactiveUsers: TriggerEventsToDeleteInactiveUsers;
  let timeGateway: CustomTimeGateway;

  beforeEach(() => {
    uow = createInMemoryUow();
    uow.featureFlagRepository.featureFlags = {
      enableInactiveUsersCleanup: makeBooleanFeatureFlag(true),
    };
    timeGateway = new CustomTimeGateway();
    timeGateway.setNextDate(now);

    const uuidGenerator = new UuidV4Generator();
    const createNewEvent = makeCreateNewEvent({
      timeGateway,
      uuidGenerator,
    });

    triggerEventsToDeleteInactiveUsers = makeTriggerEventsToDeleteInactiveUsers(
      {
        deps: {
          uowPerformer: new InMemoryUowPerformer(uow),
          timeGateway,
          createNewEvent,
          batchSize: 2,
        },
      },
    );
  });

  it("does nothing when the enableInactiveUsersCleanup flag is off", async () => {
    uow.featureFlagRepository.featureFlags = {
      enableInactiveUsersCleanup: makeBooleanFeatureFlag(false),
    };
    const inactiveUser = makeUser({
      id: "inactive-id",
      email: "inactive@test.fr",
      lastLoginAt: inactiveLastLoginAt,
    });
    uow.userRepository.users = [inactiveUser];

    const result = await triggerEventsToDeleteInactiveUsers.execute();

    expectToEqual(result, { numberOfDeletionsTriggered: 0 });
    expectToEqual(uow.outboxRepository.events.length, 0);
  });

  it("saves a quarantined InactiveUserAccountDeletionTriggered event by default", async () => {
    const inactiveUser = makeUser({
      id: "inactive-id",
      email: "inactive@test.fr",
      lastLoginAt: inactiveLastLoginAt,
    });
    uow.userRepository.users = [inactiveUser];
    saveDeletionWarningNotification({
      uow,
      userId: inactiveUser.id,
      createdAt: subDays(now, 8),
    });

    const result = await triggerEventsToDeleteInactiveUsers.execute();

    expectToEqual(result, { numberOfDeletionsTriggered: 1 });
    expectToEqual(uow.outboxRepository.events.length, 1);
    const event = uow.outboxRepository.events[0];
    expectToEqual(event.topic, "InactiveUserAccountDeletionTriggered");
    expectToEqual(event.payload, {
      userId: inactiveUser.id,
      triggeredBy: { kind: "crawler" },
    });
    expectToEqual(event.wasQuarantined, true);
    expectToEqual(event.priority, 8);
  });

  it("triggers deletion for warned inactive users, skips user prevented to be deleted", async () => {
    const inactiveUser = makeUser({
      id: "inactive-id",
      email: "inactive@test.fr",
      lastLoginAt: inactiveLastLoginAt,
    });
    const inactiveUserPreventedToBeDeleted = makeUser({
      id: "inactive-id-prevented-to-be-deleted",
      email: "inactive-prevented-to-be-deleted@test.fr",
      firstName: "Marie",
      lastName: "Martin Prevented",
      lastLoginAt: inactiveLastLoginAt,
      preventToDelete: true,
    });

    uow.userRepository.users = [inactiveUser, inactiveUserPreventedToBeDeleted];
    [inactiveUser, inactiveUserPreventedToBeDeleted].forEach((user) => {
      saveDeletionWarningNotification({
        uow,
        userId: user.id,
        createdAt: subDays(now, 8),
      });
    });

    const result = await triggerEventsToDeleteInactiveUsers.execute();

    expectToEqual(result, { numberOfDeletionsTriggered: 1 });
    expectToEqual(uow.outboxRepository.events.length, 1);
    expectToEqual(uow.outboxRepository.events[0].payload, {
      userId: inactiveUser.id,
      triggeredBy: { kind: "crawler" },
    });
  });

  it("saves non-quarantined events when enableInactiveUsersDeletionAutoProcessing is on", async () => {
    uow.featureFlagRepository.featureFlags = {
      enableInactiveUsersCleanup: makeBooleanFeatureFlag(true),
      enableInactiveUsersDeletionAutoProcessing: makeBooleanFeatureFlag(true),
    };
    const inactiveUser = makeUser({
      id: "inactive-id",
      email: "inactive@test.fr",
      lastLoginAt: inactiveLastLoginAt,
    });
    uow.userRepository.users = [inactiveUser];
    saveDeletionWarningNotification({
      uow,
      userId: inactiveUser.id,
      createdAt: subDays(now, 8),
    });

    await triggerEventsToDeleteInactiveUsers.execute();

    expectToEqual(uow.outboxRepository.events.length, 1);
    expectToEqual(uow.outboxRepository.events[0].wasQuarantined, false);
    expectToEqual(uow.outboxRepository.events[0].priority, 8);
  });

  it("returns 0 and saves no events when no users to delete", async () => {
    uow.userRepository.users = [];

    const result = await triggerEventsToDeleteInactiveUsers.execute();

    expectToEqual(result, { numberOfDeletionsTriggered: 0 });
    expectToEqual(uow.outboxRepository.events.length, 0);
  });

  it("does not trigger deletion for user with convention ending within 2-year window (future or 23 months ago)", async () => {
    setUsersWithRecentConventions({
      now,
      uow,
      users: [
        {
          id: "future-convention-id",
          email: "future-convention@test.fr",
        },
        {
          id: "recent-convention-id",
          email: "recent-convention@test.fr",
        },
      ],
    });

    const result = await triggerEventsToDeleteInactiveUsers.execute();

    expectToEqual(result, { numberOfDeletionsTriggered: 0 });
    expectToEqual(uow.outboxRepository.events.length, 0);
  });

  it("does not trigger deletion for warned user not logged in and created 2 years ago", async () => {
    const userNotLoggedAndCreatedTwoYearsAgo = makeUser({
      id: "user",
      email: "inactive@test.fr",
      lastLoginAt: undefined,
      createdAt: twoYearsAgo.toISOString(),
    });

    uow.userRepository.users = [userNotLoggedAndCreatedTwoYearsAgo];

    saveDeletionWarningNotification({
      uow,
      userId: userNotLoggedAndCreatedTwoYearsAgo.id,
      createdAt: subDays(now, 8),
    });

    const result = await triggerEventsToDeleteInactiveUsers.execute();

    expectToEqual(result, { numberOfDeletionsTriggered: 0 });
    expectToEqual(uow.outboxRepository.events.length, 0);
  });

  it("does not trigger deletion for warned user logged in and created 2 years ago", async () => {
    const userLoggedAndCreatedTwoYearsAgo = makeUser({
      id: "user",
      email: "inactive@test.fr",
      lastLoginAt: twoYearsAgo.toISOString(),
      createdAt: twoYearsAgo.toISOString(),
    });

    uow.userRepository.users = [userLoggedAndCreatedTwoYearsAgo];

    saveDeletionWarningNotification({
      uow,
      userId: userLoggedAndCreatedTwoYearsAgo.id,
      createdAt: subDays(now, 8),
    });

    const result = await triggerEventsToDeleteInactiveUsers.execute();

    expectToEqual(result, { numberOfDeletionsTriggered: 0 });
    expectToEqual(uow.outboxRepository.events.length, 0);
  });

  it("trigger deletion for warned user that never logged in and created more than 2 years ago", async () => {
    const userNotLoggedAndCreatedMoreThanTwoYearsAgo = makeUser({
      id: "user",
      email: "inactive@test.fr",
      lastLoginAt: undefined,
      createdAt: subMilliseconds(twoYearsAgo, 1).toISOString(),
    });

    uow.userRepository.users = [userNotLoggedAndCreatedMoreThanTwoYearsAgo];

    saveDeletionWarningNotification({
      uow,
      userId: userNotLoggedAndCreatedMoreThanTwoYearsAgo.id,
      createdAt: subDays(now, 8),
    });

    const result = await triggerEventsToDeleteInactiveUsers.execute();

    expectToEqual(result, { numberOfDeletionsTriggered: 1 });
    expectToEqual(uow.outboxRepository.events.length, 1);
  });

  it("does not trigger deletion for user who sent a recent exchange as establishment (30 days ago or 23 months ago)", async () => {
    setUsersWithRecentEstablishmentExchanges({
      now,
      uow,
      users: [
        {
          id: "recent-exchange-id",
          email: "recent-exchange@test.fr",
        },
        {
          id: "old-exchange-id",
          email: "old-exchange@test.fr",
        },
      ],
    });

    const result = await triggerEventsToDeleteInactiveUsers.execute();

    expectToEqual(result, { numberOfDeletionsTriggered: 0 });
    expectToEqual(uow.outboxRepository.events.length, 0);
  });

  it("triggers deletion for user with expired convention and old discussion", async () => {
    const inactiveUser = makeUser({
      id: "inactive-id",
      email: "inactive@test.fr",
      lastLoginAt: inactiveLastLoginAt,
    });
    setUserWithOldConventionAndDiscussion({
      now,
      uow,
      user: inactiveUser,
    });
    saveDeletionWarningNotification({
      uow,
      userId: inactiveUser.id,
      createdAt: subDays(now, 8),
    });

    const result = await triggerEventsToDeleteInactiveUsers.execute();

    expectToEqual(result, { numberOfDeletionsTriggered: 1 });
    expectToEqual(uow.outboxRepository.events.length, 1);
    const event = uow.outboxRepository.events[0];
    expectToEqual(event.topic, "InactiveUserAccountDeletionTriggered");
    expectToEqual(event.payload, {
      userId: inactiveUser.id,
      triggeredBy: { kind: "crawler" },
    });
    expectToEqual(event.wasQuarantined, true);
    expectToEqual(event.priority, 8);
  });

  it("only triggers deletion for users warned inside [warnedFrom, warnedTo]", async () => {
    const warnedInsideWindow = makeUser({
      id: "warned-inside-id",
      email: "warned-inside@test.fr",
      lastLoginAt: inactiveLastLoginAt,
    });
    const neverWarned = makeUser({
      id: "never-warned-id",
      email: "never-warned@test.fr",
      lastLoginAt: inactiveLastLoginAt,
    });
    const warnedTooRecently = makeUser({
      id: "warned-too-recently-id",
      email: "warned-too-recently@test.fr",
      lastLoginAt: inactiveLastLoginAt,
    });
    const warnedTooLongAgo = makeUser({
      id: "warned-too-long-ago-id",
      email: "warned-too-long-ago@test.fr",
      lastLoginAt: inactiveLastLoginAt,
    });

    uow.userRepository.users = [
      warnedInsideWindow,
      neverWarned,
      warnedTooRecently,
      warnedTooLongAgo,
    ];
    saveDeletionWarningNotification({
      uow,
      userId: warnedInsideWindow.id,
      createdAt: subDays(now, 8),
    });
    saveDeletionWarningNotification({
      uow,
      userId: warnedTooRecently.id,
      createdAt: subDays(now, 6),
    });
    saveDeletionWarningNotification({
      uow,
      userId: warnedTooLongAgo.id,
      createdAt: subDays(now, 11),
    });

    const result = await triggerEventsToDeleteInactiveUsers.execute();

    expectToEqual(result, { numberOfDeletionsTriggered: 1 });
    expectToEqual(uow.outboxRepository.events.length, 1);
    expectToEqual(uow.outboxRepository.events[0].payload, {
      userId: warnedInsideWindow.id,
      triggeredBy: { kind: "crawler" },
    });
  });

  it("processes warned inactive users in batches and skips the empty final batch", async () => {
    const countingUowPerformer = makeCountingUowPerformer(uow);
    triggerEventsToDeleteInactiveUsers = makeTriggerEventsToDeleteInactiveUsers(
      {
        deps: {
          uowPerformer: countingUowPerformer,
          timeGateway,
          createNewEvent: makeCreateNewEvent({
            timeGateway,
            uuidGenerator: new UuidV4Generator(),
          }),
          batchSize: 2,
        },
      },
    );
    const users = makeInactiveUsers(3);
    uow.userRepository.users = users;
    users.forEach((user) => {
      saveDeletionWarningNotification({
        uow,
        userId: user.id,
        createdAt: subDays(now, 8),
      });
    });

    const result = await triggerEventsToDeleteInactiveUsers.execute();

    expectToEqual(result, { numberOfDeletionsTriggered: 3 });
    expectToEqual(
      uow.outboxRepository.events.filter(
        (event) => event.topic === "InactiveUserAccountDeletionTriggered",
      ).length,
      3,
    );
    expectToEqual(countingUowPerformer.getCount(), 4);
  });

  it("does not trigger deletion for last ACCEPTED admin when remaining right is PENDING", async () => {
    const inactiveAdmin = makeUser({
      id: "inactive-admin-id",
      email: "inactive-admin@test.fr",
      lastLoginAt: inactiveLastLoginAt,
    });
    const pendingContact = makeUser({
      id: "pending-contact-id",
      email: "pending-contact@test.fr",
    });
    uow.userRepository.users = [inactiveAdmin, pendingContact];
    saveDeletionWarningNotification({
      uow,
      userId: inactiveAdmin.id,
      createdAt: subDays(now, 8),
    });
    uow.establishmentAggregateRepository.establishmentAggregates = [
      new EstablishmentAggregateBuilder()
        .withUserRights([
          {
            userId: inactiveAdmin.id,
            role: "establishment-admin",
            status: "ACCEPTED",
            isMainContactByPhone: true,
            job: "",
            phone: "",
            shouldReceiveDiscussionNotifications: true,
          },
          {
            userId: pendingContact.id,
            role: "establishment-contact",
            status: "PENDING",
            shouldReceiveDiscussionNotifications: true,
          },
        ])
        .build(),
    ];

    const result = await triggerEventsToDeleteInactiveUsers.execute();

    expectToEqual(result, { numberOfDeletionsTriggered: 0 });
    expectToEqual(uow.outboxRepository.events.length, 0);
  });

  it("triggers deletion for last ACCEPTED admin when remaining contact is ACCEPTED", async () => {
    const inactiveAdmin = makeUser({
      id: "inactive-admin-id",
      email: "inactive-admin@test.fr",
      lastLoginAt: inactiveLastLoginAt,
    });
    const acceptedContact = makeUser({
      id: "accepted-contact-id",
      email: "accepted-contact@test.fr",
    });
    uow.userRepository.users = [inactiveAdmin, acceptedContact];
    saveDeletionWarningNotification({
      uow,
      userId: inactiveAdmin.id,
      createdAt: subDays(now, 8),
    });
    uow.establishmentAggregateRepository.establishmentAggregates = [
      new EstablishmentAggregateBuilder()
        .withUserRights([
          {
            userId: inactiveAdmin.id,
            role: "establishment-admin",
            status: "ACCEPTED",
            isMainContactByPhone: true,
            job: "",
            phone: "",
            shouldReceiveDiscussionNotifications: true,
          },
          {
            userId: acceptedContact.id,
            role: "establishment-contact",
            status: "ACCEPTED",
            shouldReceiveDiscussionNotifications: true,
          },
        ])
        .build(),
    ];

    const result = await triggerEventsToDeleteInactiveUsers.execute();

    expectToEqual(result, { numberOfDeletionsTriggered: 1 });
    expectToEqual(uow.outboxRepository.events.length, 1);
    expectToEqual(uow.outboxRepository.events[0].payload, {
      userId: inactiveAdmin.id,
      triggeredBy: { kind: "crawler" },
    });
  });

  it("triggers deletion for last ACCEPTED admin when no other user has rights on establishment", async () => {
    const inactiveAdmin = makeUser({
      id: "inactive-admin-id",
      email: "inactive-admin@test.fr",
      lastLoginAt: inactiveLastLoginAt,
    });
    uow.userRepository.users = [inactiveAdmin];
    saveDeletionWarningNotification({
      uow,
      userId: inactiveAdmin.id,
      createdAt: subDays(now, 8),
    });
    uow.establishmentAggregateRepository.establishmentAggregates = [
      new EstablishmentAggregateBuilder()
        .withUserRights([
          {
            userId: inactiveAdmin.id,
            role: "establishment-admin",
            status: "ACCEPTED",
            isMainContactByPhone: true,
            job: "",
            phone: "",
            shouldReceiveDiscussionNotifications: true,
          },
        ])
        .build(),
    ];

    const result = await triggerEventsToDeleteInactiveUsers.execute();

    expectToEqual(result, { numberOfDeletionsTriggered: 1 });
    expectToEqual(uow.outboxRepository.events.length, 1);
    expectToEqual(uow.outboxRepository.events[0].payload, {
      userId: inactiveAdmin.id,
      triggeredBy: { kind: "crawler" },
    });
  });

  it("does not trigger deletion when user is last ACCEPTED admin of one establishment even if they have an ACCEPTED contact right elsewhere", async () => {
    const inactiveAdmin = makeUser({
      id: "inactive-admin-id",
      email: "inactive-admin@test.fr",
      lastLoginAt: inactiveLastLoginAt,
    });
    const pendingContact = makeUser({
      id: "pending-contact-id",
      email: "pending-contact@test.fr",
    });
    const otherAdmin = makeUser({
      id: "other-admin-id",
      email: "other-admin@test.fr",
    });
    uow.userRepository.users = [inactiveAdmin, pendingContact, otherAdmin];
    saveDeletionWarningNotification({
      uow,
      userId: inactiveAdmin.id,
      createdAt: subDays(now, 8),
    });
    uow.establishmentAggregateRepository.establishmentAggregates = [
      new EstablishmentAggregateBuilder()
        .withUserRights([
          {
            userId: inactiveAdmin.id,
            role: "establishment-admin",
            status: "ACCEPTED",
            isMainContactByPhone: true,
            job: "",
            phone: "",
            shouldReceiveDiscussionNotifications: true,
          },
          {
            userId: pendingContact.id,
            role: "establishment-contact",
            status: "PENDING",
            shouldReceiveDiscussionNotifications: true,
          },
        ])
        .build(),
      new EstablishmentAggregateBuilder()
        .withEstablishmentSiret("12345678901234")
        .withUserRights([
          {
            userId: otherAdmin.id,
            role: "establishment-admin",
            status: "ACCEPTED",
            isMainContactByPhone: true,
            job: "",
            phone: "",
            shouldReceiveDiscussionNotifications: true,
          },
          {
            userId: inactiveAdmin.id,
            role: "establishment-contact",
            status: "ACCEPTED",
            shouldReceiveDiscussionNotifications: true,
          },
        ])
        .build(),
    ];

    const result = await triggerEventsToDeleteInactiveUsers.execute();

    expectToEqual(result, { numberOfDeletionsTriggered: 0 });
    expectToEqual(uow.outboxRepository.events.length, 0);
  });

  const makeInactiveUsers = (count: number) =>
    Array.from({ length: count }, (_, index) =>
      makeUser({
        id: `00000000-0000-4000-9000-${String(index + 1).padStart(12, "0")}`,
        email: `inactive-${index + 1}@test.fr`,
        lastLoginAt: inactiveLastLoginAt,
      }),
    );

  const makeCountingUowPerformer = (
    uow: UnitOfWork,
  ): UnitOfWorkPerformer & { getCount: () => number } => {
    let count = 0;
    return {
      perform: async (cb) => {
        count++;
        return cb(uow);
      },
      getCount: () => count,
    };
  };
});
