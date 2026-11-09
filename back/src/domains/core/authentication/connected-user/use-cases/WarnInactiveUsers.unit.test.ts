import {
  addDays,
  subDays,
  subMilliseconds,
  subMonths,
  subYears,
} from "date-fns";
import {
  type AbsoluteUrl,
  ConventionDtoBuilder,
  DiscussionBuilder,
  expectArraysToMatch,
  expectToEqual,
  frontRoutes,
  makeBooleanFeatureFlag,
  makeRouteAbsoluteUrl,
} from "shared";
import {
  type ExpectSavedNotificationsAndEvents,
  makeExpectSavedNotificationsAndEvents,
} from "../../../../../utils/makeExpectSavedNotificationAndEvent.helpers";
import { makeSaveNotificationsBatchAndRelatedEvent } from "../../../notifications/helpers/Notification";
import { CustomTimeGateway } from "../../../time-gateway/adapters/CustomTimeGateway";
import {
  createInMemoryUow,
  type InMemoryUnitOfWork,
} from "../../../unit-of-work/adapters/createInMemoryUow";
import { InMemoryUowPerformer } from "../../../unit-of-work/adapters/InMemoryUowPerformer";
import type { UnitOfWork } from "../../../unit-of-work/ports/UnitOfWork";
import type { UnitOfWorkPerformer } from "../../../unit-of-work/ports/UnitOfWorkPerformer";
import { UuidV4Generator } from "../../../uuid-generator/adapters/UuidGeneratorImplementations";
import { inactiveUserNotificationEventPriority } from "./inactiveUserConstants";
import {
  makeUser,
  saveDeletionWarningNotification,
  setUsersWithRecentConventions,
  setUsersWithRecentEstablishmentExchanges,
  setUserWithOldConventionAndDiscussion,
} from "./inactiveUsersTest.helpers";
import {
  makeWarnInactiveUsers,
  type WarnInactiveUsers,
} from "./WarnInactiveUsers";

describe("WarnInactiveUsers", () => {
  const immersionBaseUrl: AbsoluteUrl = "https://immersion-facile.test";

  const now = new Date("2026-01-15T10:00:00.000Z");
  const twoYearsAgo = subYears(now, 2);
  const inactiveLastLoginAt = subDays(twoYearsAgo, 1).toISOString();

  let uow: InMemoryUnitOfWork;
  let warnInactiveUsers: WarnInactiveUsers;
  let expectSavedNotificationsAndEvents: ExpectSavedNotificationsAndEvents;
  let timeGateway: CustomTimeGateway;

  beforeEach(() => {
    uow = createInMemoryUow();
    uow.featureFlagRepository.featureFlags = {
      enableInactiveUsersCleanup: makeBooleanFeatureFlag(true),
    };
    timeGateway = new CustomTimeGateway();
    timeGateway.setNextDate(now);

    expectSavedNotificationsAndEvents = makeExpectSavedNotificationsAndEvents(
      uow.notificationRepository,
      uow.outboxRepository,
    );

    warnInactiveUsers = makeWarnInactiveUsers({
      deps: {
        uowPerformer: new InMemoryUowPerformer(uow),
        saveNotificationsBatchAndRelatedEvent:
          makeSaveNotificationsBatchAndRelatedEvent(
            new UuidV4Generator(),
            timeGateway,
          ),
        timeGateway,
        immersionBaseUrl,
        batchSize: 2,
      },
    });
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

    const result = await warnInactiveUsers.execute();

    expectToEqual(result, { numberOfWarningsSent: 0 });
    expectToEqual(uow.outboxRepository.events.length, 0);
  });

  it("warns inactive and never-logged-in users, skips boundary-active user, skip user prevented to be deleted", async () => {
    const inactiveUser = makeUser({
      id: "inactive-id",
      email: "inactive@test.fr",
      firstName: "mArIe",
      lastName: "mArtIn",
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

    const boundaryActiveUser = makeUser({
      id: "boundary-id",
      email: "boundary@test.fr",
      lastLoginAt: twoYearsAgo.toISOString(),
    });
    const neverLoggedInUserAndCreatedMoreThan2YearsAgo = makeUser({
      id: "never-logged-id-26",
      email: "never-26@test.fr",
      firstName: "Paul",
      lastName: "Durand",
      createdAt: subMilliseconds(twoYearsAgo, 1).toISOString(),
    });
    const neverLoggedInUserAndCreated2YearsAgo = makeUser({
      id: "never-logged-id-25",
      email: "never-25@test.fr",
      firstName: "Paul",
      lastName: "Durand",
      createdAt: twoYearsAgo.toISOString(),
    });
    const neverLoggedInUserAndCreated1MonthAgo = makeUser({
      id: "never-logged-id-1",
      email: "never-1@test.fr",
      firstName: "Paul",
      lastName: "Durand",
      createdAt: subMonths(now, 1).toISOString(),
    });

    uow.userRepository.users = [
      inactiveUser,
      inactiveUserPreventedToBeDeleted,
      boundaryActiveUser,
      neverLoggedInUserAndCreatedMoreThan2YearsAgo,
      neverLoggedInUserAndCreated2YearsAgo,
      neverLoggedInUserAndCreated1MonthAgo,
    ];

    const result = await warnInactiveUsers.execute();

    expectToEqual(result, { numberOfWarningsSent: 2 });
    expectSavedNotificationsAndEvents({
      emails: [
        {
          kind: "ACCOUNT_DELETION_WARNING",
          recipients: [inactiveUser.email],
          params: {
            fullName: "Marie MARTIN",
            deletionDate: "22 janvier 2026",
            loginUrl: makeRouteAbsoluteUrl({
              route: frontRoutes.myAccount(),
              baseUrl: immersionBaseUrl,
            }),
          },
        },
        {
          kind: "ACCOUNT_DELETION_WARNING",
          recipients: [neverLoggedInUserAndCreatedMoreThan2YearsAgo.email],
          params: {
            fullName: "Paul DURAND",
            deletionDate: "22 janvier 2026",
            loginUrl: makeRouteAbsoluteUrl({
              route: frontRoutes.myAccount(),
              baseUrl: immersionBaseUrl,
            }),
          },
        },
      ],
      priority: inactiveUserNotificationEventPriority,
    });
  });

  it("does not warn user with convention ending within 2-year window (future or 23 months ago)", async () => {
    setUsersWithRecentConventions({
      now,
      uow,
      users: [
        {
          id: "future-convention-user-id",
          email: "future-convention@test.fr",
        },
        {
          id: "recent-convention-user-id",
          email: "recent-convention@test.fr",
        },
      ],
    });

    const result = await warnInactiveUsers.execute();

    expectToEqual(result, { numberOfWarningsSent: 0 });
  });

  it("warns user with a recent convention whose status does not demonstrate activity", async () => {
    const userWithRejected = makeUser({
      id: "rejected-user-id",
      email: "rejected-user@test.fr",
      firstName: "Reject",
      lastName: "Writer",
      lastLoginAt: inactiveLastLoginAt,
    });
    uow.userRepository.users = [userWithRejected];

    uow.conventionRepository.setConventions([
      new ConventionDtoBuilder()
        .withId("rejected-convention")
        .withBeneficiaryEmail(userWithRejected.email)
        .withDateEnd(addDays(now, 30).toISOString())
        .withStatus("REJECTED")
        .build(),
    ]);

    const result = await warnInactiveUsers.execute();

    expectToEqual(result, { numberOfWarningsSent: 1 });
  });

  it("does not warn user who sent a recent exchange as establishment (30 days ago or 23 months ago)", async () => {
    setUsersWithRecentEstablishmentExchanges({
      now,
      uow,
      users: [
        {
          id: "recent-exchange-user-id",
          email: "recent-exchange@test.fr",
        },
        {
          id: "old-exchange-user-id",
          email: "old-exchange@test.fr",
        },
      ],
    });

    const result = await warnInactiveUsers.execute();

    expectToEqual(result, { numberOfWarningsSent: 0 });
  });

  it("does not protect a user whose email only appears as potential beneficiary on a recent discussion", async () => {
    const candidateOnlyUser = makeUser({
      id: "candidate-only-id",
      email: "candidate-only@test.fr",
      firstName: "Cand",
      lastName: "Only",
      lastLoginAt: inactiveLastLoginAt,
    });
    uow.userRepository.users = [candidateOnlyUser];

    uow.discussionRepository.discussions = [
      new DiscussionBuilder()
        .withId("discussion-candidate-only")
        .withPotentialBeneficiaryEmail(candidateOnlyUser.email)
        .withExchanges([
          {
            subject: "Candidate sent",
            message: "Hello",
            sentAt: subDays(now, 10).toISOString(),
            sender: "potentialBeneficiary",
            attachments: [],
          },
        ])
        .build(),
    ];

    const result = await warnInactiveUsers.execute();

    expectToEqual(result, { numberOfWarningsSent: 1 });
  });

  it("warns user with expired convention and old establishment exchange", async () => {
    const userWithOldActivity = makeUser({
      id: "old-activity-user-id",
      email: "old-activity@test.fr",
      firstName: "Expired",
      lastName: "Convention",
      lastLoginAt: inactiveLastLoginAt,
    });
    setUserWithOldConventionAndDiscussion({
      now,
      uow,
      user: userWithOldActivity,
    });

    const result = await warnInactiveUsers.execute();

    expectToEqual(result, { numberOfWarningsSent: 1 });
    expectSavedNotificationsAndEvents({
      emails: [
        {
          kind: "ACCOUNT_DELETION_WARNING",
          recipients: [userWithOldActivity.email],
          params: {
            fullName: "Expired CONVENTION",
            deletionDate: "22 janvier 2026",
            loginUrl: makeRouteAbsoluteUrl({
              route: frontRoutes.myAccount(),
              baseUrl: immersionBaseUrl,
            }),
          },
        },
      ],
      priority: inactiveUserNotificationEventPriority,
    });
  });

  it("does not re-warn a user who was already warned within the dedup window", async () => {
    const recentlyWarnedUser = makeUser({
      id: "recently-warned-id",
      email: "recently-warned@test.fr",
      lastLoginAt: inactiveLastLoginAt,
    });
    const freshCandidate = makeUser({
      id: "fresh-candidate-id",
      email: "fresh-candidate@test.fr",
      firstName: "Fresh",
      lastName: "Candidate",
      lastLoginAt: inactiveLastLoginAt,
    });
    uow.userRepository.users = [recentlyWarnedUser, freshCandidate];

    saveDeletionWarningNotification({
      uow,
      userId: recentlyWarnedUser.id,
      createdAt: subDays(now, 3),
    });

    const result = await warnInactiveUsers.execute();

    expectToEqual(result, { numberOfWarningsSent: 1 });
    const newWarnings = uow.notificationRepository.notifications.filter(
      (n) =>
        n.kind === "email" &&
        n.templatedContent.kind === "ACCOUNT_DELETION_WARNING" &&
        n.followedIds.userId === freshCandidate.id,
    );
    expectToEqual(newWarnings.length, 1);
    expectArraysToMatch(uow.outboxRepository.events, [
      {
        topic: "NotificationAdded",
        payload: {
          id: newWarnings[0].id,
          kind: newWarnings[0].kind,
        },
        priority: inactiveUserNotificationEventPriority,
      },
    ]);
  });

  it("processes inactive users in batches and skips the empty final batch", async () => {
    const countingUowPerformer = makeCountingUowPerformer(uow);
    warnInactiveUsers = makeWarnInactiveUsers({
      deps: {
        uowPerformer: countingUowPerformer,
        saveNotificationsBatchAndRelatedEvent:
          makeSaveNotificationsBatchAndRelatedEvent(
            new UuidV4Generator(),
            timeGateway,
          ),
        timeGateway,
        immersionBaseUrl,
        batchSize: 2,
      },
    });
    const inactiveUsers = makeInactiveUsers(3);
    uow.userRepository.users = inactiveUsers;

    const result = await warnInactiveUsers.execute();

    expectToEqual(result, { numberOfWarningsSent: 3 });
    expectToEqual(uow.outboxRepository.events.length, 3);
    expectSavedNotificationsAndEvents({
      emails: inactiveUsers.map((user) => ({
        kind: "ACCOUNT_DELETION_WARNING",
        recipients: [user.email],
        params: {
          fullName: "Jean DUPONT",
          deletionDate: "22 janvier 2026",
          loginUrl: makeRouteAbsoluteUrl({
            route: frontRoutes.myAccount(),
            baseUrl: immersionBaseUrl,
          }),
        },
      })),
      priority: inactiveUserNotificationEventPriority,
    });
    expectToEqual(countingUowPerformer.getCount(), 4);
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
