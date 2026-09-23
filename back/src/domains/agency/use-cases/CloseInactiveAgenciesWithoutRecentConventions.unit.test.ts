import { addDays, addMonths, subDays, subMonths } from "date-fns";
import {
  AgencyDtoBuilder,
  type AgencyId,
  type AgencyKind,
  ConnectedUserBuilder,
  ConventionDtoBuilder,
  type Email,
  expectToEqual,
  type Notification,
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
  type CloseInactiveAgenciesWithoutRecentConventions,
  makeCloseInactiveAgenciesWithoutRecentConventions,
} from "./CloseInactiveAgenciesWithoutRecentConventions";

describe("CloseInactiveAgenciesWithoutRecentConventions", () => {
  const numberOfMonthsWithoutConvention = 3;
  const defaultDate = new Date("2021-09-01T10:10:00.000Z");

  const admin1 = new ConnectedUserBuilder()
    .withId("admin1-id")
    .withEmail("admin1@agency1.fr")
    .withFirstName("Admin")
    .withLastName("One")
    .buildUser();

  const admin2 = new ConnectedUserBuilder()
    .withId("admin2-id")
    .withEmail("admin2@agency2.fr")
    .withFirstName("Admin")
    .withLastName("Two")
    .buildUser();

  const validator1 = new ConnectedUserBuilder()
    .withId("validator1-id")
    .withEmail("validator1@agency1.fr")
    .buildUser();

  const agency1 = AgencyDtoBuilder.create("agency1-id")
    .withName("Agency 1")
    .withStatus("active")
    .withUpdatedAt(subMonths(defaultDate, 4))
    .build();

  const agency2 = AgencyDtoBuilder.create("agency2-id")
    .withName("Agency 2")
    .withStatus("active")
    .withUpdatedAt(subMonths(defaultDate, 4))
    .build();

  const makeInactivityWarningNotification = (params: {
    id: string;
    agencyId: AgencyId;
    agencyName: string;
    createdAt: Date;
    recipientEmail: Email;
  }): Notification => ({
    id: params.id,
    createdAt: params.createdAt.toISOString(),
    kind: "email" as const,
    followedIds: { agencyId: params.agencyId },
    templatedContent: {
      kind: "AGENCY_INACTIVITY_WARNING" as const,
      bcc: [params.recipientEmail],
      params: {
        agencyName: params.agencyName,
      },
    },
  });

  let uow: InMemoryUnitOfWork;
  let closeInactiveAgenciesWithoutRecentConventions: CloseInactiveAgenciesWithoutRecentConventions;
  let expectSavedNotificationsAndEvents: ExpectSavedNotificationsAndEvents;
  let timeGateway: CustomTimeGateway;

  beforeEach(() => {
    uow = createInMemoryUow();
    const expectSavedNotificationsAndEventsIncludingSeededWarnings =
      makeExpectSavedNotificationsAndEvents(
        uow.notificationRepository,
        uow.outboxRepository,
      );
    expectSavedNotificationsAndEvents = (params) => {
      uow.notificationRepository.notifications =
        uow.notificationRepository.notifications.filter(
          (notification) =>
            notification.kind !== "email" ||
            notification.templatedContent.kind !== "AGENCY_INACTIVITY_WARNING",
        );
      expectSavedNotificationsAndEventsIncludingSeededWarnings(params);
    };
    timeGateway = new CustomTimeGateway(defaultDate);
    closeInactiveAgenciesWithoutRecentConventions =
      makeCloseInactiveAgenciesWithoutRecentConventions({
        deps: {
          uowPerformer: new InMemoryUowPerformer(uow),
          timeGateway,
          batchSize: 100,
          saveNotificationsBatchAndRelatedEvent:
            makeSaveNotificationsBatchAndRelatedEvent(
              new UuidV4Generator(),
              timeGateway,
            ),
        },
      });
  });

  describe("When there are no agencies to close", () => {
    it("should return zero closed for agencies that are already closed, rejected, or in review", async () => {
      const needsReviewAgency = AgencyDtoBuilder.create("needsReviewAgency-id")
        .withName("Agency 3")
        .withStatus("needsReview")
        .withUpdatedAt(subMonths(defaultDate, 4))
        .build();

      const closedAgency = AgencyDtoBuilder.create("closedAgency-id")
        .withName("Agency 4")
        .withStatus("closed")
        .withStatusJustification("Already closed")
        .withUpdatedAt(subMonths(defaultDate, 4))
        .build();

      const rejectedAgency = AgencyDtoBuilder.create("rejectedAgency-id")
        .withName("Agency 5")
        .withStatus("rejected")
        .withStatusJustification("Rejected")
        .withUpdatedAt(subMonths(defaultDate, 4))
        .build();
      uow.agencyRepository.agencies = [
        toAgencyWithRights(needsReviewAgency, {
          [admin1.id]: {
            isNotifiedByEmail: true,
            roles: ["agency-admin"],
          },
        }),
        toAgencyWithRights(closedAgency, {
          [admin1.id]: {
            isNotifiedByEmail: true,
            roles: ["agency-admin"],
          },
        }),
        toAgencyWithRights(rejectedAgency, {
          [admin1.id]: {
            isNotifiedByEmail: true,
            roles: ["agency-admin"],
          },
        }),
      ];
      uow.userRepository.users = [admin1];

      const result =
        await closeInactiveAgenciesWithoutRecentConventions.execute({
          numberOfMonthsWithoutConvention,
        });

      expectToEqual(result, {
        numberOfAgenciesClosed: 0,
      });
      expectSavedNotificationsAndEvents({
        emails: [],
      });
    });

    it("should return zero closed for agencies with recent conventions", async () => {
      const agency1WithRights = toAgencyWithRights(agency1, {
        [admin1.id]: {
          isNotifiedByEmail: true,
          roles: ["agency-admin"],
        },
      });

      const recentConvention = new ConventionDtoBuilder()
        .withId("recent-convention-id")
        .withAgencyId(agency1.id)
        .withStatus("IN_REVIEW")
        .withDateSubmission(subDays(defaultDate, 30).toISOString())
        .build();

      uow.agencyRepository.agencies = [agency1WithRights];
      uow.userRepository.users = [admin1];
      uow.conventionRepository.setConventions([recentConvention]);
      uow.notificationRepository.notifications = [
        makeInactivityWarningNotification({
          id: "warning-agency1",
          agencyId: agency1.id,
          agencyName: agency1.name,
          createdAt: subMonths(defaultDate, numberOfMonthsWithoutConvention),
          recipientEmail: admin1.email,
        }),
      ];

      const result =
        await closeInactiveAgenciesWithoutRecentConventions.execute({
          numberOfMonthsWithoutConvention,
        });

      expectToEqual(result, {
        numberOfAgenciesClosed: 0,
      });
      expectSavedNotificationsAndEvents({
        emails: [],
      });
      expectToEqual(uow.agencyRepository.agencies, [agency1WithRights]);
    });

    it("should not close inactive agencies without an inactivity warning", async () => {
      const agency1WithRights = toAgencyWithRights(agency1, {
        [admin1.id]: {
          isNotifiedByEmail: true,
          roles: ["agency-admin"],
        },
      });

      uow.agencyRepository.agencies = [agency1WithRights];
      uow.userRepository.users = [admin1];
      uow.conventionRepository.setConventions([]);

      const result =
        await closeInactiveAgenciesWithoutRecentConventions.execute({
          numberOfMonthsWithoutConvention,
        });

      expectToEqual(result, {
        numberOfAgenciesClosed: 0,
      });
      expectToEqual(uow.agencyRepository.agencies, [agency1WithRights]);
      expectSavedNotificationsAndEvents({
        emails: [],
      });
    });

    it("should not close inactive agencies whose inactivity warning is too recent", async () => {
      const agency1WithRights = toAgencyWithRights(agency1, {
        [admin1.id]: {
          isNotifiedByEmail: true,
          roles: ["agency-admin"],
        },
      });

      uow.agencyRepository.agencies = [agency1WithRights];
      uow.userRepository.users = [admin1];
      uow.conventionRepository.setConventions([]);
      uow.notificationRepository.notifications = [
        makeInactivityWarningNotification({
          id: "recent-warning-agency1",
          agencyId: agency1.id,
          agencyName: agency1.name,
          createdAt: subMonths(defaultDate, 1),
          recipientEmail: admin1.email,
        }),
      ];

      const result =
        await closeInactiveAgenciesWithoutRecentConventions.execute({
          numberOfMonthsWithoutConvention,
        });

      expectToEqual(result, {
        numberOfAgenciesClosed: 0,
      });
      expectToEqual(uow.agencyRepository.agencies, [agency1WithRights]);
      expectSavedNotificationsAndEvents({
        emails: [],
      });
    });

    it("should not close warned agencies which has been updated since the warning", async () => {
      const warningDate = subMonths(defaultDate, 3);
      const agencyUpdatedAfterWarning = AgencyDtoBuilder.create("agency1-id")
        .withName("Agency 1")
        .withStatus("active")
        .withUpdatedAt(addDays(warningDate, 15))
        .build();

      const agencyWithRights = toAgencyWithRights(agencyUpdatedAfterWarning, {
        [admin1.id]: {
          isNotifiedByEmail: true,
          roles: ["agency-admin"],
        },
      });

      uow.agencyRepository.agencies = [agencyWithRights];
      uow.userRepository.users = [admin1];
      uow.conventionRepository.setConventions([]);
      uow.notificationRepository.notifications = [
        makeInactivityWarningNotification({
          id: "invalidated-warning-agency1",
          agencyId: agencyUpdatedAfterWarning.id,
          agencyName: agencyUpdatedAfterWarning.name,
          createdAt: warningDate,
          recipientEmail: admin1.email,
        }),
      ];

      const result =
        await closeInactiveAgenciesWithoutRecentConventions.execute({
          numberOfMonthsWithoutConvention,
        });

      expectToEqual(result, {
        numberOfAgenciesClosed: 0,
      });
      expectToEqual(uow.agencyRepository.agencies, [agencyWithRights]);
      expectSavedNotificationsAndEvents({
        emails: [],
      });
    });

    it("should not close warned agencies which has new conventions since the warning", async () => {
      const warningDate = subMonths(defaultDate, 5);
      const veryOldAgency = AgencyDtoBuilder.create("agency1-id")
        .withName("Agency 1")
        .withStatus("active")
        .withUpdatedAt(subMonths(defaultDate, 12))
        .build();

      const agencyWithRights = toAgencyWithRights(veryOldAgency, {
        [admin1.id]: {
          isNotifiedByEmail: true,
          roles: ["agency-admin"],
        },
      });

      const conventionAfterWarning = new ConventionDtoBuilder()
        .withId("convention-after-warning-id")
        .withAgencyId(veryOldAgency.id)
        .withStatus("ACCEPTED_BY_VALIDATOR")
        .withDateSubmission(addMonths(warningDate, 2).toISOString())
        .build();

      uow.agencyRepository.agencies = [agencyWithRights];
      uow.userRepository.users = [admin1];
      uow.conventionRepository.setConventions([conventionAfterWarning]);
      uow.notificationRepository.notifications = [
        makeInactivityWarningNotification({
          id: "invalidated-warning-agency1",
          agencyId: veryOldAgency.id,
          agencyName: veryOldAgency.name,
          createdAt: warningDate,
          recipientEmail: admin1.email,
        }),
      ];

      const result =
        await closeInactiveAgenciesWithoutRecentConventions.execute({
          numberOfMonthsWithoutConvention,
        });

      expectToEqual(result, {
        numberOfAgenciesClosed: 0,
      });
      expectToEqual(uow.agencyRepository.agencies, [agencyWithRights]);
      expectSavedNotificationsAndEvents({
        emails: [],
      });
    });
  });

  describe("When there are agencies to close", () => {
    it("should close active agencies without recent conventions and send notifications to admins", async () => {
      const agency1WithRights = toAgencyWithRights(agency1, {
        [admin1.id]: {
          isNotifiedByEmail: true,
          roles: ["agency-admin"],
        },
        [validator1.id]: {
          isNotifiedByEmail: true,
          roles: ["validator"],
        },
      });
      const agency2WithRights = toAgencyWithRights(agency2, {
        [admin2.id]: {
          isNotifiedByEmail: true,
          roles: ["agency-admin"],
        },
      });
      uow.agencyRepository.agencies = [agency1WithRights, agency2WithRights];
      uow.userRepository.users = [admin1, admin2, validator1];
      uow.conventionRepository.setConventions([]);
      uow.notificationRepository.notifications = [
        makeInactivityWarningNotification({
          id: "warning-agency1",
          agencyId: agency1.id,
          agencyName: agency1.name,
          createdAt: subMonths(defaultDate, numberOfMonthsWithoutConvention),
          recipientEmail: admin1.email,
        }),
        makeInactivityWarningNotification({
          id: "warning-agency2",
          agencyId: agency2.id,
          agencyName: agency2.name,
          createdAt: subMonths(defaultDate, numberOfMonthsWithoutConvention),
          recipientEmail: admin2.email,
        }),
      ];

      const result =
        await closeInactiveAgenciesWithoutRecentConventions.execute({
          numberOfMonthsWithoutConvention,
        });

      expectToEqual(result, {
        numberOfAgenciesClosed: 2,
      });

      expectToEqual(uow.agencyRepository.agencies, [
        {
          ...agency1WithRights,
          status: "closed",
          statusJustification: "Agence fermée automatiquement pour inactivité",
          updatedAt: timeGateway.now().toISOString(),
        },
        {
          ...agency2WithRights,
          status: "closed",
          statusJustification: "Agence fermée automatiquement pour inactivité",
          updatedAt: timeGateway.now().toISOString(),
        },
      ]);

      expectSavedNotificationsAndEvents({
        emails: [
          {
            kind: "AGENCY_CLOSED_FOR_INACTIVITY",
            recipients: [admin1.email],
            params: {
              agencyName: agency1.name,
              numberOfMonthsWithoutConvention,
            },
          },
          {
            kind: "AGENCY_CLOSED_FOR_INACTIVITY",
            recipients: [admin2.email],
            params: {
              agencyName: agency2.name,
              numberOfMonthsWithoutConvention,
            },
          },
        ],
        priority: 7,
      });
    });

    it("should not close agencies with recent conventions", async () => {
      const agency1WithRights = toAgencyWithRights(agency1, {
        [admin1.id]: {
          isNotifiedByEmail: true,
          roles: ["agency-admin"],
        },
      });
      const agency2WithRights = toAgencyWithRights(agency2, {
        [admin2.id]: {
          isNotifiedByEmail: true,
          roles: ["agency-admin"],
        },
      });

      const recentConvention = new ConventionDtoBuilder()
        .withId("recent-convention-id")
        .withAgencyId(agency1.id)
        .withStatus("ACCEPTED_BY_VALIDATOR")
        .withDateSubmission(subDays(defaultDate, 30).toISOString())
        .build();

      uow.agencyRepository.agencies = [agency1WithRights, agency2WithRights];
      uow.userRepository.users = [admin1, admin2];
      uow.conventionRepository.setConventions([recentConvention]);
      uow.notificationRepository.notifications = [
        makeInactivityWarningNotification({
          id: "warning-agency1",
          agencyId: agency1.id,
          agencyName: agency1.name,
          createdAt: subMonths(defaultDate, numberOfMonthsWithoutConvention),
          recipientEmail: admin1.email,
        }),
        makeInactivityWarningNotification({
          id: "warning-agency2",
          agencyId: agency2.id,
          agencyName: agency2.name,
          createdAt: subMonths(defaultDate, numberOfMonthsWithoutConvention),
          recipientEmail: admin2.email,
        }),
      ];

      const result =
        await closeInactiveAgenciesWithoutRecentConventions.execute({
          numberOfMonthsWithoutConvention,
        });

      expectToEqual(result, {
        numberOfAgenciesClosed: 1,
      });

      expectToEqual(uow.agencyRepository.agencies, [
        agency1WithRights,
        {
          ...agency2WithRights,
          updatedAt: timeGateway.now().toISOString(),
          status: "closed",
          statusJustification: "Agence fermée automatiquement pour inactivité",
        },
      ]);

      expectSavedNotificationsAndEvents({
        emails: [
          {
            kind: "AGENCY_CLOSED_FOR_INACTIVITY",
            recipients: [admin2.email],
            params: {
              agencyName: agency2.name,
              numberOfMonthsWithoutConvention,
            },
          },
        ],
      });
    });

    it("should not close agencies that are referenced by agencies with recent conventions", async () => {
      const agency3 = AgencyDtoBuilder.create("agency3-id")
        .withName("Agency 3")
        .withStatus("active")
        .withUpdatedAt(subMonths(defaultDate, 4))
        .build();

      const referringAgency = AgencyDtoBuilder.create("referring-agency-id")
        .withName("Referring Agency")
        .withStatus("active")
        .withRefersToAgencyInfo({
          refersToAgencyId: agency1.id,
          refersToAgencyName: agency1.name,
          refersToAgencyContactEmail: agency1.contactEmail,
        })
        .withUpdatedAt(subMonths(defaultDate, 4))
        .build();

      const agency1WithRights = toAgencyWithRights(agency1, {
        [admin1.id]: {
          isNotifiedByEmail: true,
          roles: ["agency-admin"],
        },
      });
      const referringAgencyWithRights = toAgencyWithRights(referringAgency, {
        [admin2.id]: {
          isNotifiedByEmail: true,
          roles: ["agency-admin"],
        },
      });
      const agency3WithRights = toAgencyWithRights(agency3, {
        [admin1.id]: {
          isNotifiedByEmail: true,
          roles: ["agency-admin"],
        },
      });

      const recentConvention = new ConventionDtoBuilder()
        .withId("recent-convention-id")
        .withAgencyId(referringAgency.id)
        .withStatus("READY_TO_SIGN")
        .withDateSubmission(subDays(defaultDate, 30).toISOString())
        .build();

      uow.agencyRepository.agencies = [
        agency1WithRights,
        referringAgencyWithRights,
        agency3WithRights,
      ];
      uow.userRepository.users = [admin1, admin2];
      uow.conventionRepository.setConventions([recentConvention]);
      uow.notificationRepository.notifications = [
        makeInactivityWarningNotification({
          id: "warning-agency1",
          agencyId: agency1.id,
          agencyName: agency1.name,
          createdAt: subMonths(defaultDate, numberOfMonthsWithoutConvention),
          recipientEmail: admin1.email,
        }),
        makeInactivityWarningNotification({
          id: "warning-agency3",
          agencyId: agency3.id,
          agencyName: agency3.name,
          createdAt: subMonths(defaultDate, numberOfMonthsWithoutConvention),
          recipientEmail: admin1.email,
        }),
      ];

      const result =
        await closeInactiveAgenciesWithoutRecentConventions.execute({
          numberOfMonthsWithoutConvention,
        });

      expectToEqual(result, {
        numberOfAgenciesClosed: 1,
      });

      expectToEqual(uow.agencyRepository.agencies, [
        agency1WithRights,
        referringAgencyWithRights,
        {
          ...agency3WithRights,
          updatedAt: timeGateway.now().toISOString(),
          status: "closed",
          statusJustification: "Agence fermée automatiquement pour inactivité",
        },
      ]);
    });

    it("should send separate emails for each agency even if the same admin manages multiple agencies", async () => {
      uow.agencyRepository.agencies = [
        toAgencyWithRights(agency1, {
          [admin1.id]: {
            isNotifiedByEmail: true,
            roles: ["agency-admin"],
          },
        }),
        toAgencyWithRights(agency2, {
          [admin1.id]: {
            isNotifiedByEmail: true,
            roles: ["agency-admin"],
          },
        }),
      ];
      uow.userRepository.users = [admin1];
      uow.conventionRepository.setConventions([]);
      uow.notificationRepository.notifications = [
        makeInactivityWarningNotification({
          id: "warning-agency1",
          agencyId: agency1.id,
          agencyName: agency1.name,
          createdAt: subMonths(defaultDate, numberOfMonthsWithoutConvention),
          recipientEmail: admin1.email,
        }),
        makeInactivityWarningNotification({
          id: "warning-agency2",
          agencyId: agency2.id,
          agencyName: agency2.name,
          createdAt: subMonths(defaultDate, numberOfMonthsWithoutConvention),
          recipientEmail: admin1.email,
        }),
      ];

      const result =
        await closeInactiveAgenciesWithoutRecentConventions.execute({
          numberOfMonthsWithoutConvention,
        });

      expectToEqual(result, {
        numberOfAgenciesClosed: 2,
      });

      expectSavedNotificationsAndEvents({
        emails: [
          {
            kind: "AGENCY_CLOSED_FOR_INACTIVITY",
            recipients: [admin1.email],
            params: {
              agencyName: agency1.name,
              numberOfMonthsWithoutConvention,
            },
          },
          {
            kind: "AGENCY_CLOSED_FOR_INACTIVITY",
            recipients: [admin1.email],
            params: {
              agencyName: agency2.name,
              numberOfMonthsWithoutConvention,
            },
          },
        ],
      });
    });

    it("should not close agencies that were updated recently (less than 3 months ago)", async () => {
      const recentlyUpdatedAgency = AgencyDtoBuilder.create("recent-agency-id")
        .withName("Recently updated Agency")
        .withStatus("active")
        .withUpdatedAt(subMonths(defaultDate, 1))
        .build();

      const oldAgency = AgencyDtoBuilder.create("old-agency-id")
        .withName("Old Agency")
        .withStatus("active")
        .withUpdatedAt(subMonths(defaultDate, 4))
        .build();

      const recentlyUpdatedAgencyWithRights = toAgencyWithRights(
        recentlyUpdatedAgency,
        {
          [admin1.id]: {
            isNotifiedByEmail: true,
            roles: ["agency-admin"],
          },
        },
      );
      const oldAgencyWithRights = toAgencyWithRights(oldAgency, {
        [admin2.id]: {
          isNotifiedByEmail: true,
          roles: ["agency-admin"],
        },
      });

      uow.agencyRepository.agencies = [
        recentlyUpdatedAgencyWithRights,
        oldAgencyWithRights,
      ];
      uow.userRepository.users = [admin1, admin2];
      uow.conventionRepository.setConventions([]);
      uow.notificationRepository.notifications = [
        makeInactivityWarningNotification({
          id: "warning-old-agency",
          agencyId: oldAgency.id,
          agencyName: oldAgency.name,
          createdAt: subMonths(defaultDate, numberOfMonthsWithoutConvention),
          recipientEmail: admin2.email,
        }),
      ];

      const result =
        await closeInactiveAgenciesWithoutRecentConventions.execute({
          numberOfMonthsWithoutConvention,
        });

      expectToEqual(result, {
        numberOfAgenciesClosed: 1,
      });

      expectToEqual(uow.agencyRepository.agencies, [
        recentlyUpdatedAgencyWithRights,
        {
          ...oldAgencyWithRights,
          updatedAt: timeGateway.now().toISOString(),
          status: "closed",
          statusJustification: "Agence fermée automatiquement pour inactivité",
        },
      ]);

      expectSavedNotificationsAndEvents({
        emails: [
          {
            kind: "AGENCY_CLOSED_FOR_INACTIVITY",
            recipients: [admin2.email],
            params: {
              agencyName: oldAgency.name,
              numberOfMonthsWithoutConvention,
            },
          },
        ],
      });
    });

    it("should close agencies found on subsequent pages", async () => {
      const agency3 = AgencyDtoBuilder.create("agency3-id")
        .withName("Agency 3")
        .withStatus("active")
        .withUpdatedAt(subMonths(defaultDate, 4))
        .build();

      const agency4 = AgencyDtoBuilder.create("agency4-id")
        .withName("Agency 4")
        .withStatus("active")
        .withUpdatedAt(subMonths(defaultDate, 4))
        .build();

      const agency1WithRights = toAgencyWithRights(agency1, {
        [admin1.id]: { isNotifiedByEmail: true, roles: ["agency-admin"] },
      });
      const agencyToClose1 = toAgencyWithRights(agency3, {
        [admin2.id]: { isNotifiedByEmail: true, roles: ["agency-admin"] },
      });
      const agencyToClose2 = toAgencyWithRights(agency4, {
        [admin2.id]: { isNotifiedByEmail: true, roles: ["agency-admin"] },
      });

      const recentConventionForAgency1 = new ConventionDtoBuilder()
        .withId("convention-agency1-id")
        .withAgencyId(agency1.id)
        .withStatus("IN_REVIEW")
        .withDateSubmission(subDays(defaultDate, 30).toISOString())
        .build();

      uow.agencyRepository.agencies = [
        agency1WithRights,
        agencyToClose1,
        agencyToClose2,
      ];
      uow.userRepository.users = [admin1, admin2];
      uow.conventionRepository.setConventions([recentConventionForAgency1]);
      uow.notificationRepository.notifications = [
        makeInactivityWarningNotification({
          id: "warning-agency3",
          agencyId: agency3.id,
          agencyName: agency3.name,
          createdAt: subMonths(defaultDate, numberOfMonthsWithoutConvention),
          recipientEmail: admin2.email,
        }),
        makeInactivityWarningNotification({
          id: "warning-agency4",
          agencyId: agency4.id,
          agencyName: agency4.name,
          createdAt: subMonths(defaultDate, numberOfMonthsWithoutConvention),
          recipientEmail: admin2.email,
        }),
      ];

      const closeInactiveAgenciesWithoutRecentConventions =
        makeCloseInactiveAgenciesWithoutRecentConventions({
          deps: {
            uowPerformer: new InMemoryUowPerformer(uow),
            timeGateway,
            saveNotificationsBatchAndRelatedEvent:
              makeSaveNotificationsBatchAndRelatedEvent(
                new UuidV4Generator(),
                timeGateway,
              ),
            batchSize: 2,
          },
        });

      const result =
        await closeInactiveAgenciesWithoutRecentConventions.execute({
          numberOfMonthsWithoutConvention,
        });

      expectToEqual(result, { numberOfAgenciesClosed: 2 });
      expectToEqual(uow.agencyRepository.agencies, [
        agency1WithRights,
        {
          ...agencyToClose1,
          updatedAt: timeGateway.now().toISOString(),
          status: "closed",
          statusJustification: "Agence fermée automatiquement pour inactivité",
        },
        {
          ...agencyToClose2,
          updatedAt: timeGateway.now().toISOString(),
          status: "closed",
          statusJustification: "Agence fermée automatiquement pour inactivité",
        },
      ]);
      expectSavedNotificationsAndEvents({
        emails: [
          {
            kind: "AGENCY_CLOSED_FOR_INACTIVITY",
            recipients: [admin2.email],
            params: {
              agencyName: agencyToClose1.name,
              numberOfMonthsWithoutConvention,
            },
          },
          {
            kind: "AGENCY_CLOSED_FOR_INACTIVITY",
            recipients: [admin2.email],
            params: {
              agencyName: agencyToClose2.name,
              numberOfMonthsWithoutConvention,
            },
          },
        ],
      });
    });

    it.each(["france-travail", "operateur-cep"] satisfies AgencyKind[])(
      "should not close agencies of kind %s even if they are considered inactive",
      async (kind) => {
        const agencyToKeep = AgencyDtoBuilder.create("agency-id")
          .withName(`Agency ${kind}`)
          .withStatus("active")
          .withKind(kind)
          .withUpdatedAt(subMonths(defaultDate, 4))
          .build();

        const agencyToKeepWithRights = toAgencyWithRights(agencyToKeep, {
          [admin1.id]: {
            isNotifiedByEmail: true,
            roles: ["agency-admin"],
          },
        });
        const agency1WithRights = toAgencyWithRights(agency1, {
          [admin2.id]: {
            isNotifiedByEmail: true,
            roles: ["agency-admin"],
          },
        });

        uow.agencyRepository.agencies = [
          agencyToKeepWithRights,
          agency1WithRights,
        ];
        uow.userRepository.users = [admin1, admin2];
        uow.conventionRepository.setConventions([]);
        uow.notificationRepository.notifications = [
          makeInactivityWarningNotification({
            id: "warning-agency1",
            agencyId: agency1.id,
            agencyName: agency1.name,
            createdAt: subMonths(defaultDate, numberOfMonthsWithoutConvention),
            recipientEmail: admin2.email,
          }),
        ];

        const result =
          await closeInactiveAgenciesWithoutRecentConventions.execute({
            numberOfMonthsWithoutConvention,
          });

        expectToEqual(result, {
          numberOfAgenciesClosed: 1,
        });

        expectToEqual(uow.agencyRepository.agencies, [
          agencyToKeepWithRights,
          {
            ...agency1WithRights,
            updatedAt: timeGateway.now().toISOString(),
            status: "closed",
            statusJustification:
              "Agence fermée automatiquement pour inactivité",
          },
        ]);

        expectSavedNotificationsAndEvents({
          emails: [
            {
              kind: "AGENCY_CLOSED_FOR_INACTIVITY",
              recipients: [admin2.email],
              params: {
                agencyName: agency1.name,
                numberOfMonthsWithoutConvention,
              },
            },
          ],
        });
      },
    );
  });
});
