import { subDays, subMonths } from "date-fns";
import {
  AgencyDtoBuilder,
  ConnectedUserBuilder,
  ConventionDtoBuilder,
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
  type CloseInactiveAgenciesWithoutRecentConventions,
  makeCloseInactiveAgenciesWithoutRecentConventions,
} from "./CloseInactiveAgenciesWithoutRecentConventions";

describe("CloseInactiveAgenciesWithoutRecentConventions", () => {
  const numberOfMonthsWithoutConvention = 6;
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
    .withCreatedAt(subMonths(defaultDate, 7).toISOString())
    .build();

  const agency2 = AgencyDtoBuilder.create("agency2-id")
    .withName("Agency 2")
    .withStatus("active")
    .withCreatedAt(subMonths(defaultDate, 7).toISOString())
    .build();

  let uow: InMemoryUnitOfWork;
  let closeInactiveAgenciesWithoutRecentConventions: CloseInactiveAgenciesWithoutRecentConventions;
  let expectSavedNotificationsAndEvents: ExpectSavedNotificationsAndEvents;
  let timeGateway: CustomTimeGateway;

  beforeEach(() => {
    uow = createInMemoryUow();
    expectSavedNotificationsAndEvents = makeExpectSavedNotificationsAndEvents(
      uow.notificationRepository,
      uow.outboxRepository,
    );
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
        .withCreatedAt(subMonths(defaultDate, 7).toISOString())
        .build();

      const closedAgency = AgencyDtoBuilder.create("closedAgency-id")
        .withName("Agency 4")
        .withStatus("closed")
        .withStatusJustification("Already closed")
        .withCreatedAt(subMonths(defaultDate, 7).toISOString())
        .build();

      const rejectedAgency = AgencyDtoBuilder.create("rejectedAgency-id")
        .withName("Agency 5")
        .withStatus("rejected")
        .withStatusJustification("Rejected")
        .withCreatedAt(subMonths(defaultDate, 7).toISOString())
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
        .withDateSubmission(subDays(new Date(), 30).toISOString())
        .build();

      uow.agencyRepository.agencies = [agency1WithRights];
      uow.userRepository.users = [admin1];
      uow.conventionRepository.setConventions([recentConvention]);

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
        },
        {
          ...agency2WithRights,
          status: "closed",
          statusJustification: "Agence fermée automatiquement pour inactivité",
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
        .withDateSubmission(subDays(new Date(), 30).toISOString())
        .build();

      uow.agencyRepository.agencies = [agency1WithRights, agency2WithRights];
      uow.userRepository.users = [admin1, admin2];
      uow.conventionRepository.setConventions([recentConvention]);

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
        .withCreatedAt(subMonths(defaultDate, 7).toISOString())
        .build();

      const referringAgency = AgencyDtoBuilder.create("referring-agency-id")
        .withName("Referring Agency")
        .withStatus("active")
        .withRefersToAgencyInfo({
          refersToAgencyId: agency1.id,
          refersToAgencyName: agency1.name,
          refersToAgencyContactEmail: agency1.contactEmail,
        })
        .withCreatedAt(subMonths(defaultDate, 7).toISOString())
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

    it("should not close agencies that were created recently (less than 6 months ago)", async () => {
      const recentlyCreatedAgency = AgencyDtoBuilder.create("recent-agency-id")
        .withName("Recently Created Agency")
        .withStatus("active")
        .withCreatedAt(subMonths(defaultDate, 1).toISOString())
        .build();

      const oldAgency = AgencyDtoBuilder.create("old-agency-id")
        .withName("Old Agency")
        .withStatus("active")
        .withCreatedAt(subMonths(defaultDate, 7).toISOString())
        .build();

      const recentlyCreatedAgencyWithRights = toAgencyWithRights(
        recentlyCreatedAgency,
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
        recentlyCreatedAgencyWithRights,
        oldAgencyWithRights,
      ];
      uow.userRepository.users = [admin1, admin2];
      uow.conventionRepository.setConventions([]);

      const result =
        await closeInactiveAgenciesWithoutRecentConventions.execute({
          numberOfMonthsWithoutConvention,
        });

      expectToEqual(result, {
        numberOfAgenciesClosed: 1,
      });

      expectToEqual(uow.agencyRepository.agencies, [
        recentlyCreatedAgencyWithRights,
        {
          ...oldAgencyWithRights,
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
        .withCreatedAt(subMonths(defaultDate, 7).toISOString())
        .build();

      const agency4 = AgencyDtoBuilder.create("agency4-id")
        .withName("Agency 4")
        .withStatus("active")
        .withCreatedAt(subMonths(defaultDate, 7).toISOString())
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
        .withDateSubmission(subDays(new Date(), 30).toISOString())
        .build();

      uow.agencyRepository.agencies = [
        agency1WithRights,
        agencyToClose1,
        agencyToClose2,
      ];
      uow.userRepository.users = [admin1, admin2];
      uow.conventionRepository.setConventions([recentConventionForAgency1]);

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
          status: "closed",
          statusJustification: "Agence fermée automatiquement pour inactivité",
        },
        {
          ...agencyToClose2,
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

    it("should not close agencies of kind france-travail even if they are considered inactive", async () => {
      const ftAgency = AgencyDtoBuilder.create("pole-emploi-agency-id")
        .withName("Pôle Emploi Agency")
        .withStatus("active")
        .withKind("france-travail")
        .withCreatedAt(subMonths(defaultDate, 7).toISOString())
        .build();

      const poleEmploiAgencyWithRights = toAgencyWithRights(ftAgency, {
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
        poleEmploiAgencyWithRights,
        agency1WithRights,
      ];
      uow.userRepository.users = [admin1, admin2];
      uow.conventionRepository.setConventions([]);

      const result =
        await closeInactiveAgenciesWithoutRecentConventions.execute({
          numberOfMonthsWithoutConvention,
        });

      expectToEqual(result, {
        numberOfAgenciesClosed: 1,
      });

      expectToEqual(uow.agencyRepository.agencies, [
        poleEmploiAgencyWithRights,
        {
          ...agency1WithRights,
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
              agencyName: agency1.name,
              numberOfMonthsWithoutConvention,
            },
          },
        ],
      });
    });
  });
});
