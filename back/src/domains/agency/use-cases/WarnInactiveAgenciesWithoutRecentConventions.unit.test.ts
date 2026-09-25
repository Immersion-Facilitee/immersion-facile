import { subDays, subMonths } from "date-fns";
import {
  AgencyDtoBuilder,
  ConnectedUserBuilder,
  ConventionDtoBuilder,
  expectObjectInArrayToMatch,
  expectToEqual,
} from "shared";
import { toAgencyWithRights } from "../../../utils/agency";
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
import {
  makeWarnInactiveAgenciesWithoutRecentConventions,
  type WarnInactiveAgenciesWithoutRecentConventions,
} from "./WarnInactiveAgenciesWithoutRecentConventions";

describe("WarnInactiveAgenciesWithoutRecentConventions", () => {
  const numberOfMonthsWithoutConvention = 3;
  const now = new Date("2021-09-01T10:10:00.000Z");

  const agencyAdmin1 = new ConnectedUserBuilder()
    .withId("agencyAdmin1-id")
    .withEmail("agencyAdmin1@agency1.fr")
    .withFirstName("Agency Admin")
    .withLastName("One")
    .buildUser();

  const agencyAdmin2 = new ConnectedUserBuilder()
    .withId("agencyAdmin2-id")
    .withEmail("agencyAdmin2@agency2.fr")
    .withFirstName("Agency Admin")
    .withLastName("Two")
    .buildUser();

  const validator1 = new ConnectedUserBuilder()
    .withId("validator1-id")
    .withEmail("validator1@agency1.fr")
    .buildUser();

  const toReviewUser = new ConnectedUserBuilder()
    .withId("to-review-id")
    .withEmail("toreview@agency1.fr")
    .buildUser();

  const agency1 = new AgencyDtoBuilder()
    .withId("agency1-id")
    .withName("Agency 1")
    .withStatus("active")
    .withUpdatedAt(subMonths(now, 4))
    .build();

  const agency2 = new AgencyDtoBuilder()
    .withId("agency2-id")
    .withName("Agency 2")
    .withStatus("active")
    .withUpdatedAt(subMonths(now, 4))
    .build();

  let uow: InMemoryUnitOfWork;
  let warnInactiveAgenciesWithoutRecentConventions: WarnInactiveAgenciesWithoutRecentConventions;
  let expectSavedNotificationsAndEvents: ExpectSavedNotificationsAndEvents;
  let timeGateway: CustomTimeGateway;

  beforeEach(() => {
    uow = createInMemoryUow();
    expectSavedNotificationsAndEvents = makeExpectSavedNotificationsAndEvents(
      uow.notificationRepository,
      uow.outboxRepository,
    );
    timeGateway = new CustomTimeGateway(now);
    warnInactiveAgenciesWithoutRecentConventions =
      makeWarnInactiveAgenciesWithoutRecentConventions({
        deps: {
          uowPerformer: new InMemoryUowPerformer(uow),
          timeGateway,
          batchSize: 2,
          saveNotificationsBatchAndRelatedEvent:
            makeSaveNotificationsBatchAndRelatedEvent(
              new UuidV4Generator(),
              timeGateway,
            ),
        },
      });
  });

  describe("When there are no agencies to warn", () => {
    it.each(["needsReview", "closed", "rejected"] as const)(
      "should not warn agency with status %s",
      async (status) => {
        const agency = new AgencyDtoBuilder()
          .withId("agency-id")
          .withName(`Agency ${status}`)
          .withStatus(status)
          .withStatusJustification(
            status === "needsReview" ? null : `Status ${status}`,
          )
          .withUpdatedAt(subMonths(now, 4))
          .build();

        uow.agencyRepository.agencies = [
          toAgencyWithRights(agency, {
            [agencyAdmin1.id]: {
              isNotifiedByEmail: true,
              roles: ["agency-admin"],
            },
          }),
        ];
        uow.userRepository.users = [agencyAdmin1];

        const result =
          await warnInactiveAgenciesWithoutRecentConventions.execute({
            numberOfMonthsWithoutConvention,
          });

        expectToEqual(result, { numberOfAgenciesWarned: 0 });
        expectSavedNotificationsAndEvents({ emails: [] });
      },
    );

    it("should not warn agencies with recent conventions", async () => {
      const agency1WithRights = toAgencyWithRights(agency1, {
        [agencyAdmin1.id]: {
          isNotifiedByEmail: true,
          roles: ["agency-admin"],
        },
      });

      const recentConvention = new ConventionDtoBuilder()
        .withId("recent-convention-id")
        .withAgencyId(agency1.id)
        .withStatus("IN_REVIEW")
        .withDateSubmission(subDays(now, 30).toISOString())
        .build();

      uow.agencyRepository.agencies = [agency1WithRights];
      uow.userRepository.users = [agencyAdmin1];
      uow.conventionRepository.setConventions([recentConvention]);

      const result = await warnInactiveAgenciesWithoutRecentConventions.execute(
        {
          numberOfMonthsWithoutConvention,
        },
      );

      expectToEqual(result, { numberOfAgenciesWarned: 0 });
      expectSavedNotificationsAndEvents({ emails: [] });
    });

    it.each([
      {
        caseName: "less than numberOfMonthsWithoutConvention months ago",
        warningCreatedAt: () => subMonths(now, 1),
      },
      {
        caseName: "exactly numberOfMonthsWithoutConvention months ago",
        warningCreatedAt: () => subMonths(now, numberOfMonthsWithoutConvention),
      },
    ])(
      "should not warn agencies that already have a warning $caseName",
      async ({ warningCreatedAt }) => {
        const agency1WithRights = toAgencyWithRights(agency1, {
          [agencyAdmin1.id]: {
            isNotifiedByEmail: true,
            roles: ["agency-admin"],
          },
        });

        uow.agencyRepository.agencies = [agency1WithRights];
        uow.userRepository.users = [agencyAdmin1];
        uow.notificationRepository.notifications = [
          {
            id: "existing-warning-id",
            createdAt: warningCreatedAt().toISOString(),
            kind: "email",
            followedIds: { agencyId: agency1.id },
            templatedContent: {
              kind: "AGENCY_INACTIVITY_WARNING",
              bcc: [agencyAdmin1.email],
              params: {
                agencyName: agency1.name,
              },
            },
          },
        ];

        const result =
          await warnInactiveAgenciesWithoutRecentConventions.execute({
            numberOfMonthsWithoutConvention,
          });

        expectToEqual(result, { numberOfAgenciesWarned: 0 });
        expectToEqual(uow.notificationRepository.notifications.length, 1);
      },
    );

    it("should skip agencies whose users only have to-review role", async () => {
      uow.agencyRepository.agencies = [
        toAgencyWithRights(agency1, {
          [toReviewUser.id]: {
            isNotifiedByEmail: true,
            roles: ["to-review"],
          },
        }),
      ];
      uow.userRepository.users = [toReviewUser];

      const result = await warnInactiveAgenciesWithoutRecentConventions.execute(
        {
          numberOfMonthsWithoutConvention,
        },
      );

      expectToEqual(result, { numberOfAgenciesWarned: 0 });
      expectSavedNotificationsAndEvents({ emails: [] });
    });

    it("should not warn an agency updated since its last warning", async () => {
      const agencyUpdatedAfterWarning = new AgencyDtoBuilder()
        .withId("agency1-id")
        .withName("Agency 1")
        .withStatus("active")
        .withUpdatedAt(subMonths(now, 4))
        .build();

      uow.agencyRepository.agencies = [
        toAgencyWithRights(agencyUpdatedAfterWarning, {
          [agencyAdmin1.id]: {
            isNotifiedByEmail: true,
            roles: ["agency-admin"],
          },
        }),
      ];
      uow.userRepository.users = [agencyAdmin1];
      uow.notificationRepository.notifications = [
        {
          id: "old-warning-id",
          createdAt: subMonths(now, 5).toISOString(),
          kind: "email",
          followedIds: { agencyId: agencyUpdatedAfterWarning.id },
          templatedContent: {
            kind: "AGENCY_INACTIVITY_WARNING",
            bcc: [agencyAdmin1.email],
            params: {
              agencyName: agencyUpdatedAfterWarning.name,
            },
          },
        },
      ];

      const result = await warnInactiveAgenciesWithoutRecentConventions.execute(
        {
          numberOfMonthsWithoutConvention,
        },
      );

      expectToEqual(result, { numberOfAgenciesWarned: 0 });
      expectToEqual(uow.notificationRepository.notifications.length, 1);
    });

    it("should not warn an agency with conventions submitted since its last warning", async () => {
      const veryOldAgency = new AgencyDtoBuilder()
        .withId("agency1-id")
        .withName("Agency 1")
        .withStatus("active")
        .withUpdatedAt(subMonths(now, 12))
        .build();

      const conventionAfterWarning = new ConventionDtoBuilder()
        .withId("convention-after-warning-id")
        .withAgencyId(veryOldAgency.id)
        .withStatus("ACCEPTED_BY_VALIDATOR")
        .withDateSubmission(subMonths(now, 4).toISOString())
        .build();

      uow.agencyRepository.agencies = [
        toAgencyWithRights(veryOldAgency, {
          [agencyAdmin1.id]: {
            isNotifiedByEmail: true,
            roles: ["agency-admin"],
          },
        }),
      ];
      uow.userRepository.users = [agencyAdmin1];
      uow.conventionRepository.setConventions([conventionAfterWarning]);
      uow.notificationRepository.notifications = [
        {
          id: "old-warning-id",
          createdAt: subMonths(now, 5).toISOString(),
          kind: "email",
          followedIds: { agencyId: veryOldAgency.id },
          templatedContent: {
            kind: "AGENCY_INACTIVITY_WARNING",
            bcc: [agencyAdmin1.email],
            params: {
              agencyName: veryOldAgency.name,
            },
          },
        },
      ];

      const result = await warnInactiveAgenciesWithoutRecentConventions.execute(
        {
          numberOfMonthsWithoutConvention,
        },
      );

      expectToEqual(result, { numberOfAgenciesWarned: 0 });
      expectToEqual(uow.notificationRepository.notifications.length, 1);
    });

    it("should not warn an agency when a referring agency has conventions submitted since its last warning", async () => {
      const veryOldAgency = new AgencyDtoBuilder()
        .withId("agency1-id")
        .withName("Agency 1")
        .withStatus("active")
        .withUpdatedAt(subMonths(now, 12))
        .build();

      const referringAgency = new AgencyDtoBuilder()
        .withId("referring-agency-id")
        .withName("Referring Agency")
        .withStatus("active")
        .withRefersToAgencyInfo({
          refersToAgencyId: veryOldAgency.id,
          refersToAgencyName: veryOldAgency.name,
          refersToAgencyContactEmail: veryOldAgency.contactEmail,
        })
        .withUpdatedAt(subMonths(now, 12))
        .build();

      const conventionOnReferringAgencyAfterWarning = new ConventionDtoBuilder()
        .withId("convention-referring-after-warning-id")
        .withAgencyId(referringAgency.id)
        .withStatus("ACCEPTED_BY_VALIDATOR")
        .withDateSubmission(subMonths(now, 4).toISOString())
        .build();

      uow.agencyRepository.agencies = [
        toAgencyWithRights(veryOldAgency, {
          [agencyAdmin1.id]: {
            isNotifiedByEmail: true,
            roles: ["agency-admin"],
          },
        }),
        toAgencyWithRights(referringAgency, {}),
      ];
      uow.userRepository.users = [agencyAdmin1];
      uow.conventionRepository.setConventions([
        conventionOnReferringAgencyAfterWarning,
      ]);
      uow.notificationRepository.notifications = [
        {
          id: "old-warning-id",
          createdAt: subMonths(now, 5).toISOString(),
          kind: "email",
          followedIds: { agencyId: veryOldAgency.id },
          templatedContent: {
            kind: "AGENCY_INACTIVITY_WARNING",
            bcc: [agencyAdmin1.email],
            params: {
              agencyName: veryOldAgency.name,
            },
          },
        },
      ];

      const result = await warnInactiveAgenciesWithoutRecentConventions.execute(
        {
          numberOfMonthsWithoutConvention,
        },
      );

      expectToEqual(result, { numberOfAgenciesWarned: 0 });
      expectToEqual(uow.notificationRepository.notifications.length, 1);
    });
  });

  describe("When there are agencies to warn", () => {
    it("should send AGENCY_INACTIVITY_WARNING in bcc to notifiable users", async () => {
      const agency1WithRights = toAgencyWithRights(agency1, {
        [agencyAdmin1.id]: {
          isNotifiedByEmail: true,
          roles: ["agency-admin"],
        },
        [validator1.id]: {
          isNotifiedByEmail: false,
          roles: ["validator"],
        },
      });
      const agency2WithRights = toAgencyWithRights(agency2, {
        [agencyAdmin2.id]: {
          isNotifiedByEmail: true,
          roles: ["agency-admin", "validator"],
        },
      });

      uow.agencyRepository.agencies = [agency1WithRights, agency2WithRights];
      uow.userRepository.users = [agencyAdmin1, agencyAdmin2, validator1];
      uow.conventionRepository.setConventions([]);

      const result = await warnInactiveAgenciesWithoutRecentConventions.execute(
        {
          numberOfMonthsWithoutConvention,
        },
      );

      expectToEqual(result, { numberOfAgenciesWarned: 2 });
      expectSavedNotificationsAndEvents({
        emails: [
          {
            kind: "AGENCY_INACTIVITY_WARNING",
            bcc: [agencyAdmin1.email, validator1.email],
            params: {
              agencyName: agency1.name,
            },
          },
          {
            kind: "AGENCY_INACTIVITY_WARNING",
            bcc: [agencyAdmin2.email],
            params: {
              agencyName: agency2.name,
            },
          },
        ],
        priority: 7,
      });
    });

    it("should exclude users that are to-review", async () => {
      const multiRoleUser = new ConnectedUserBuilder()
        .withId("multi-role-id")
        .withEmail("multi@agency1.fr")
        .buildUser();

      uow.agencyRepository.agencies = [
        toAgencyWithRights(agency1, {
          [agencyAdmin1.id]: {
            isNotifiedByEmail: true,
            roles: ["agency-admin"],
          },
          [multiRoleUser.id]: {
            isNotifiedByEmail: true,
            roles: ["agency-admin", "to-review"],
          },
          [toReviewUser.id]: {
            isNotifiedByEmail: true,
            roles: ["to-review"],
          },
        }),
      ];
      uow.userRepository.users = [agencyAdmin1, multiRoleUser, toReviewUser];

      const result = await warnInactiveAgenciesWithoutRecentConventions.execute(
        {
          numberOfMonthsWithoutConvention,
        },
      );

      expectToEqual(result, { numberOfAgenciesWarned: 1 });
      expectSavedNotificationsAndEvents({
        emails: [
          {
            kind: "AGENCY_INACTIVITY_WARNING",
            bcc: [agencyAdmin1.email],
            params: {
              agencyName: agency1.name,
            },
          },
        ],
      });
    });

    it("should send a new warning if the previous one is older than numberOfMonthsWithoutConvention and the agency stayed inactive", async () => {
      const veryOldAgency = new AgencyDtoBuilder()
        .withId("agency1-id")
        .withName("Agency 1")
        .withStatus("active")
        .withUpdatedAt(subMonths(now, 12))
        .build();

      uow.agencyRepository.agencies = [
        toAgencyWithRights(veryOldAgency, {
          [agencyAdmin1.id]: {
            isNotifiedByEmail: true,
            roles: ["agency-admin"],
          },
        }),
      ];
      uow.userRepository.users = [agencyAdmin1];
      uow.notificationRepository.notifications = [
        {
          id: "old-warning-id",
          createdAt: subMonths(now, 5).toISOString(),
          kind: "email",
          followedIds: { agencyId: veryOldAgency.id },
          templatedContent: {
            kind: "AGENCY_INACTIVITY_WARNING",
            bcc: [agencyAdmin1.email],
            params: {
              agencyName: veryOldAgency.name,
            },
          },
        },
      ];

      const result = await warnInactiveAgenciesWithoutRecentConventions.execute(
        {
          numberOfMonthsWithoutConvention,
        },
      );

      expectToEqual(result, { numberOfAgenciesWarned: 1 });
      expectToEqual(uow.notificationRepository.notifications.length, 2);
      expectObjectInArrayToMatch(uow.notificationRepository.notifications, [
        {
          id: "old-warning-id",
          followedIds: { agencyId: veryOldAgency.id },
          templatedContent: {
            kind: "AGENCY_INACTIVITY_WARNING",
            bcc: [agencyAdmin1.email],
            params: {
              agencyName: veryOldAgency.name,
            },
          },
        },
        {
          followedIds: { agencyId: veryOldAgency.id },
          templatedContent: {
            kind: "AGENCY_INACTIVITY_WARNING",
            bcc: [agencyAdmin1.email],
            params: {
              agencyName: veryOldAgency.name,
            },
          },
        },
      ]);
      expectObjectInArrayToMatch(uow.outboxRepository.events, [
        { topic: "NotificationAdded" },
      ]);
    });

    it("should warn agencies on all paginated pages", async () => {
      const agency3 = new AgencyDtoBuilder()
        .withId("agency3-id")
        .withName("Agency 3")
        .withStatus("active")
        .withUpdatedAt(subMonths(now, 4))
        .build();

      const agency4 = new AgencyDtoBuilder()
        .withId("agency4-id")
        .withName("Agency 4")
        .withStatus("active")
        .withUpdatedAt(subMonths(now, 5))
        .build();

      const agencyToWarn1 = toAgencyWithRights(
        new AgencyDtoBuilder(agency1).withUpdatedAt(subMonths(now, 6)).build(),
        {
          [agencyAdmin1.id]: {
            isNotifiedByEmail: true,
            roles: ["agency-admin"],
          },
        },
      );
      const agencyToWarn2 = toAgencyWithRights(
        new AgencyDtoBuilder(agency2).withUpdatedAt(subMonths(now, 5)).build(),
        {
          [agencyAdmin2.id]: {
            isNotifiedByEmail: true,
            roles: ["agency-admin"],
          },
        },
      );
      const agencyToWarn3 = toAgencyWithRights(agency3, {
        [agencyAdmin1.id]: { isNotifiedByEmail: true, roles: ["agency-admin"] },
      });
      const agencyToWarn4 = toAgencyWithRights(agency4, {
        [agencyAdmin2.id]: { isNotifiedByEmail: true, roles: ["agency-admin"] },
      });

      uow.agencyRepository.agencies = [
        agencyToWarn1,
        agencyToWarn2,
        agencyToWarn3,
        agencyToWarn4,
      ];
      uow.userRepository.users = [agencyAdmin1, agencyAdmin2];

      const result = await warnInactiveAgenciesWithoutRecentConventions.execute(
        {
          numberOfMonthsWithoutConvention,
        },
      );

      expectToEqual(result, { numberOfAgenciesWarned: 4 });
      expectSavedNotificationsAndEvents({
        emails: [
          {
            kind: "AGENCY_INACTIVITY_WARNING",
            bcc: [agencyAdmin1.email],
            params: {
              agencyName: agencyToWarn1.name,
            },
          },
          {
            kind: "AGENCY_INACTIVITY_WARNING",
            bcc: [agencyAdmin2.email],
            params: {
              agencyName: agencyToWarn2.name,
            },
          },
          {
            kind: "AGENCY_INACTIVITY_WARNING",
            bcc: [agencyAdmin1.email],
            params: {
              agencyName: agencyToWarn3.name,
            },
          },
          {
            kind: "AGENCY_INACTIVITY_WARNING",
            bcc: [agencyAdmin2.email],
            params: {
              agencyName: agencyToWarn4.name,
            },
          },
        ],
      });
    });
  });
});
