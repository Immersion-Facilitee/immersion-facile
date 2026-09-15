import {
  addDays,
  addMilliseconds,
  subDays,
  subMilliseconds,
  subMonths,
} from "date-fns";
import {
  AgencyDtoBuilder,
  type AgencyStatus,
  type AgencyUsersRights,
  ConnectedUserBuilder,
  ConventionDtoBuilder,
  type ConventionStatus,
} from "shared";
import { v4 as uuid } from "uuid";
import { AppConfigBuilder } from "../../../../utils/AppConfigBuilder";
import { toAgencyWithRights } from "../../../../utils/agency";
import {
  type ExpectSavedNotificationsAndEvents,
  makeExpectSavedNotificationsAndEvents,
} from "../../../../utils/makeExpectSavedNotificationAndEvent.helpers";
import { makeSaveNotificationsBatchAndRelatedEvent } from "../../../core/notifications/helpers/Notification";
import { CustomTimeGateway } from "../../../core/time-gateway/adapters/CustomTimeGateway";
import {
  createInMemoryUow,
  type InMemoryUnitOfWork,
} from "../../../core/unit-of-work/adapters/createInMemoryUow";
import { InMemoryUowPerformer } from "../../../core/unit-of-work/adapters/InMemoryUowPerformer";
import { TestUuidGenerator } from "../../../core/uuid-generator/adapters/UuidGeneratorImplementations";
import {
  makeNotifyConventionSummaryToAgency,
  type NotifyConventionSummaryToAgency,
} from "./NotifyConventionSummaryToAgency";

describe("NotifyConventionSummary", () => {
  const now = new Date();
  const inFiveDays = addDays(now, 5);
  const afterFiveDays = addMilliseconds(inFiveDays, 1);
  const oneDayAgo = subDays(now, 1);
  const beforeOneDayAgo = subMilliseconds(oneDayAgo, 1);
  const oneMonthAgo = subMonths(now, 1);
  const beforeOneMonthAgo = subMilliseconds(oneMonthAgo, 1);

  const agencyUser = new ConnectedUserBuilder()
    .withEmail("agency-user@mail.com")
    .buildUser();
  const userRights: AgencyUsersRights = {
    [agencyUser.id]: { roles: ["validator"], isNotifiedByEmail: true },
  };

  const validatedConventionOneDayAgo = new ConventionDtoBuilder()
    .withId(uuid())
    .withStatus("ACCEPTED_BY_VALIDATOR")
    .withDateValidation(oneDayAgo.toISOString())
    .build();

  const activeAgencyRelatedToConvention = new AgencyDtoBuilder()
    .withId(validatedConventionOneDayAgo.agencyId)
    .withStatus("active")
    .build();

  let useCase: NotifyConventionSummaryToAgency;
  let uow: InMemoryUnitOfWork;
  let uuidGenerator: TestUuidGenerator;
  let timeGateway: CustomTimeGateway;
  let expectSavedNotificationsAndEvents: ExpectSavedNotificationsAndEvents;
  const appConfig = new AppConfigBuilder().build();

  beforeEach(() => {
    uow = createInMemoryUow();
    uuidGenerator = new TestUuidGenerator(["1", "2", "3", "4"]);
    timeGateway = new CustomTimeGateway(now);
    useCase = makeNotifyConventionSummaryToAgency({
      uowPerformer: new InMemoryUowPerformer(uow),
      deps: {
        saveNotificationsBatchAndRelatedEvent:
          makeSaveNotificationsBatchAndRelatedEvent(uuidGenerator, timeGateway),
        timeGateway,
        appConfig,
      },
    });
    expectSavedNotificationsAndEvents = makeExpectSavedNotificationsAndEvents(
      uow.notificationRepository,
      uow.outboxRepository,
    );

    uow.userRepository.users = [agencyUser];
    uow.agencyRepository.agencies = [
      toAgencyWithRights(activeAgencyRelatedToConvention, userRights),
    ];
  });

  describe("filter agencies", () => {
    beforeEach(() => {
      uow.conventionRepository.setConventions([validatedConventionOneDayAgo]);
    });

    it.each<AgencyStatus>(["closed", "needsReview", "rejected"])(
      "do not send notification when agency is with status %s",
      async (status) => {
        const agency = new AgencyDtoBuilder(activeAgencyRelatedToConvention)
          .withStatus(status)
          .build();

        uow.agencyRepository.agencies = [
          toAgencyWithRights(agency, userRights),
        ];

        await useCase.execute();

        expectSavedNotificationsAndEvents({
          emails: [],
        });
      },
    );

    it.each<AgencyStatus>(["active", "from-api-PE"])(
      "send notification when agency is with status %s",
      async (status) => {
        const agency = new AgencyDtoBuilder(activeAgencyRelatedToConvention)
          .withStatus(status)
          .build();

        uow.agencyRepository.agencies = [
          toAgencyWithRights(agency, userRights),
        ];

        await useCase.execute();

        expectSavedNotificationsAndEvents({
          emails: [
            {
              kind: "CONVENTION_SUMMARY_NOTIFICATION_TO_AGENCY",
              params: {
                agencyName: agency.name,
                domain: appConfig.immersionFacileDomain,
                conventionsToManage: 0,
                newConventions: 0,
                validatedConventions: 1,
              },
              bcc: [agencyUser.email],
            },
          ],
        });
      },
    );

    it("do not send notificiation when no convention match convention report", async () => {
      uow.conventionRepository.setConventions([]);

      await useCase.execute();

      expectSavedNotificationsAndEvents({
        emails: [],
      });
    });
  });

  describe("validated conventions", () => {
    it("include conventions only with status ACCEPTED_BY_VALIDATOR validated from one day ago", async () => {
      const validatedConventionBeforeOneDayAgo = new ConventionDtoBuilder(
        validatedConventionOneDayAgo,
      )
        .withId(uuid())
        .withDateValidation(beforeOneMonthAgo.toISOString())
        .build();

      uow.conventionRepository.setConventions([
        validatedConventionOneDayAgo,
        validatedConventionBeforeOneDayAgo,
      ]);

      await useCase.execute();

      expectSavedNotificationsAndEvents({
        emails: [
          {
            kind: "CONVENTION_SUMMARY_NOTIFICATION_TO_AGENCY",
            params: {
              agencyName: activeAgencyRelatedToConvention.name,
              domain: appConfig.immersionFacileDomain,
              conventionsToManage: 0,
              newConventions: 0,
              validatedConventions: 1,
            },
            bcc: [agencyUser.email],
          },
        ],
      });
    });

    it.each<ConventionStatus>([
      "ACCEPTED_BY_COUNSELLOR",
      "CANCELLED",
      "DEPRECATED",
      "IN_REVIEW",
      "PARTIALLY_SIGNED",
      "READY_TO_SIGN",
      "REJECTED",
    ])(
      "exclude conventions validated from one day ago with bad status %s",
      async (status) => {
        const validatedConventionOneDayAgoWithBadStatus =
          new ConventionDtoBuilder(validatedConventionOneDayAgo)
            .withId(uuid())
            .withStatus(status)
            .build();

        uow.conventionRepository.setConventions([
          validatedConventionOneDayAgoWithBadStatus,
        ]);

        await useCase.execute();

        expectSavedNotificationsAndEvents({
          emails: [],
        });
      },
    );
  });

  describe("new conventions", () => {
    it("include conventions only with status PARTIALLY_SIGNED or READY_TO_SIGN submitted from one day ago", async () => {
      const partiallySignedConventionOneDayAgo = new ConventionDtoBuilder()
        .withId(uuid())
        .withStatus("PARTIALLY_SIGNED")
        .withDateSubmission(oneDayAgo.toISOString())
        .build();

      const readyToSignConventionOneDayAgo = new ConventionDtoBuilder()
        .withId(uuid())
        .withStatus("READY_TO_SIGN")
        .withDateSubmission(oneDayAgo.toISOString())
        .build();

      const partiallySignedConventionBeforeOneDayAgo =
        new ConventionDtoBuilder()
          .withId(uuid())
          .withStatus("PARTIALLY_SIGNED")
          .withDateSubmission(beforeOneDayAgo.toISOString())
          .build();

      const readyToSignConventionBeforeOneDayAgo = new ConventionDtoBuilder()
        .withId(uuid())
        .withStatus("READY_TO_SIGN")
        .withDateSubmission(beforeOneDayAgo.toISOString())
        .build();

      uow.conventionRepository.setConventions([
        readyToSignConventionOneDayAgo,
        readyToSignConventionBeforeOneDayAgo,
        partiallySignedConventionOneDayAgo,
        partiallySignedConventionBeforeOneDayAgo,
      ]);

      await useCase.execute();

      expectSavedNotificationsAndEvents({
        emails: [
          {
            kind: "CONVENTION_SUMMARY_NOTIFICATION_TO_AGENCY",
            params: {
              agencyName: activeAgencyRelatedToConvention.name,
              domain: appConfig.immersionFacileDomain,
              conventionsToManage: 0,
              newConventions: 2,
              validatedConventions: 0,
            },
            bcc: [agencyUser.email],
          },
        ],
      });
    });

    it.each<ConventionStatus>([
      "ACCEPTED_BY_COUNSELLOR",
      "ACCEPTED_BY_VALIDATOR",
      "CANCELLED",
      "DEPRECATED",
      "IN_REVIEW",
      "REJECTED",
    ])(
      "exclude conventions submitted from one day ago with status %s",
      async (status) => {
        const submittedConventionOneDayAgoWithStatus =
          new ConventionDtoBuilder()
            .withId(uuid())
            .withDateSubmission(oneDayAgo.toISOString())
            .withStatus(status)
            .build();

        uow.conventionRepository.setConventions([
          submittedConventionOneDayAgoWithStatus,
        ]);

        await useCase.execute();

        expectSavedNotificationsAndEvents({
          emails: [],
        });
      },
    );
  });

  describe("conventions to manage", () => {
    it("include conventions only with status IN_REVIEW or ACCEPTED_BY_COUNSELLOR with date start from one month ago to in five days", async () => {
      const inReviewConventionOneMonthAgo = new ConventionDtoBuilder()
        .withId(uuid())
        .withStatus("IN_REVIEW")
        .withDateStart(oneMonthAgo.toISOString())
        .build();

      const acceptedByCounsellorConventionOneMonthAgo =
        new ConventionDtoBuilder()
          .withId(uuid())
          .withStatus("ACCEPTED_BY_COUNSELLOR")
          .withDateStart(oneMonthAgo.toISOString())
          .build();

      const inReviewConventionBeforeOneMonthAgo = new ConventionDtoBuilder()
        .withId(uuid())
        .withStatus("IN_REVIEW")
        .withDateStart(beforeOneMonthAgo.toISOString())
        .build();

      const acceptedByCounsellorConventionBeforeOneDayAgo =
        new ConventionDtoBuilder()
          .withId(uuid())
          .withStatus("ACCEPTED_BY_COUNSELLOR")
          .withDateStart(beforeOneMonthAgo.toISOString())
          .build();

      const inReviewConventionInFiveDays = new ConventionDtoBuilder()
        .withId(uuid())
        .withStatus("IN_REVIEW")
        .withDateStart(inFiveDays.toISOString())
        .build();

      const acceptedByCounsellorConventionInFiveDays =
        new ConventionDtoBuilder()
          .withId(uuid())
          .withStatus("ACCEPTED_BY_COUNSELLOR")
          .withDateStart(inFiveDays.toISOString())
          .build();

      const inReviewConventionAfterFiveDays = new ConventionDtoBuilder()
        .withId(uuid())
        .withStatus("IN_REVIEW")
        .withDateStart(afterFiveDays.toISOString())
        .build();

      const acceptedByCounsellorConventionAfterFiveDays =
        new ConventionDtoBuilder()
          .withId(uuid())
          .withStatus("ACCEPTED_BY_COUNSELLOR")
          .withDateStart(afterFiveDays.toISOString())
          .build();

      uow.conventionRepository.setConventions([
        inReviewConventionBeforeOneMonthAgo,
        inReviewConventionOneMonthAgo,
        inReviewConventionInFiveDays,
        inReviewConventionAfterFiveDays,
        acceptedByCounsellorConventionBeforeOneDayAgo,
        acceptedByCounsellorConventionOneMonthAgo,
        acceptedByCounsellorConventionInFiveDays,
        acceptedByCounsellorConventionAfterFiveDays,
      ]);

      await useCase.execute();

      expectSavedNotificationsAndEvents({
        emails: [
          {
            kind: "CONVENTION_SUMMARY_NOTIFICATION_TO_AGENCY",
            params: {
              agencyName: activeAgencyRelatedToConvention.name,
              domain: appConfig.immersionFacileDomain,
              conventionsToManage: 4,
              newConventions: 0,
              validatedConventions: 0,
            },
            bcc: [agencyUser.email],
          },
        ],
      });
    });

    it.each<ConventionStatus>([
      "CANCELLED",
      "ACCEPTED_BY_VALIDATOR",
      "DEPRECATED",
      "PARTIALLY_SIGNED",
      "READY_TO_SIGN",
      "REJECTED",
    ])(
      "exclude conventions with status %s with date start from one month ago to in five days",
      async (status) => {
        const conventionOneMonthAgoWithBadStatus = new ConventionDtoBuilder()
          .withId(uuid())
          .withStatus(status)
          .withDateStart(oneMonthAgo.toISOString())
          .build();

        uow.conventionRepository.setConventions([
          conventionOneMonthAgoWithBadStatus,
        ]);

        await useCase.execute();

        expectSavedNotificationsAndEvents({
          emails: [],
        });
      },
    );

    describe("With agencies related to agencies", () => {
      const mainAgency = new AgencyDtoBuilder()
        .withId(uuid())
        .withName("Main agency")
        .build();
      const agencyWithRefersTo = new AgencyDtoBuilder()
        .withId(validatedConventionOneDayAgo.agencyId)
        .withName("Agency refers to")
        .withRefersToAgencyInfo({
          refersToAgencyId: mainAgency.id,
          refersToAgencyName: mainAgency.name,
          refersToAgencyContactEmail: mainAgency.contactEmail,
        })
        .build();

      const agencyRefersToUser = new ConnectedUserBuilder()
        .withId(uuid())
        .withEmail("user-agency-refers-to@mail.com")
        .buildUser();

      beforeEach(() => {
        uow.agencyRepository.agencies = [
          toAgencyWithRights(agencyWithRefersTo, {
            [agencyRefersToUser.id]: {
              isNotifiedByEmail: true,
              roles: ["validator"],
            },
          }),
          toAgencyWithRights(mainAgency, userRights),
        ];

        uow.userRepository.users = [agencyUser, agencyRefersToUser];
      });

      it("include conventions of agencies related to agencies with status ACCEPTED_BY_COUNSELLOR with date start from one month ago to in five days", async () => {
        const inReviewConventionOneMonthAgo = new ConventionDtoBuilder()
          .withId(uuid())
          .withStatus("IN_REVIEW")
          .withDateStart(oneMonthAgo.toISOString())
          .build();

        const acceptedByCounsellorConventionOneMonthAgo =
          new ConventionDtoBuilder()
            .withId(uuid())
            .withStatus("ACCEPTED_BY_COUNSELLOR")
            .withDateStart(oneMonthAgo.toISOString())
            .build();

        const inReviewConventionBeforeOneMonthAgo = new ConventionDtoBuilder()
          .withId(uuid())
          .withStatus("IN_REVIEW")
          .withDateStart(beforeOneMonthAgo.toISOString())
          .build();

        const acceptedByCounsellorConventionBeforeOneDayAgo =
          new ConventionDtoBuilder()
            .withId(uuid())
            .withStatus("ACCEPTED_BY_COUNSELLOR")
            .withDateStart(beforeOneMonthAgo.toISOString())
            .build();

        const inReviewConventionInFiveDays = new ConventionDtoBuilder()
          .withId(uuid())
          .withStatus("IN_REVIEW")
          .withDateStart(inFiveDays.toISOString())
          .build();

        const acceptedByCounsellorConventionInFiveDays =
          new ConventionDtoBuilder()
            .withId(uuid())
            .withStatus("ACCEPTED_BY_COUNSELLOR")
            .withDateStart(inFiveDays.toISOString())
            .build();

        const inReviewConventionAfterFiveDays = new ConventionDtoBuilder()
          .withId(uuid())
          .withStatus("IN_REVIEW")
          .withDateStart(afterFiveDays.toISOString())
          .build();

        const acceptedByCounsellorConventionAfterFiveDays =
          new ConventionDtoBuilder()
            .withId(uuid())
            .withStatus("ACCEPTED_BY_COUNSELLOR")
            .withDateStart(afterFiveDays.toISOString())
            .build();

        uow.conventionRepository.setConventions([
          inReviewConventionBeforeOneMonthAgo,
          inReviewConventionOneMonthAgo,
          inReviewConventionInFiveDays,
          inReviewConventionAfterFiveDays,
          acceptedByCounsellorConventionBeforeOneDayAgo,
          acceptedByCounsellorConventionOneMonthAgo,
          acceptedByCounsellorConventionInFiveDays,
          acceptedByCounsellorConventionAfterFiveDays,
        ]);

        await useCase.execute();

        expectSavedNotificationsAndEvents({
          emails: [
            {
              kind: "CONVENTION_SUMMARY_NOTIFICATION_TO_AGENCY",
              params: {
                agencyName: mainAgency.name,
                domain: appConfig.immersionFacileDomain,
                conventionsToManage: 2,
                newConventions: 0,
                validatedConventions: 0,
              },
              bcc: [agencyUser.email],
            },
            {
              kind: "CONVENTION_SUMMARY_NOTIFICATION_TO_AGENCY",
              params: {
                agencyName: agencyWithRefersTo.name,
                domain: appConfig.immersionFacileDomain,
                conventionsToManage: 4,
                newConventions: 0,
                validatedConventions: 0,
              },
              bcc: [agencyRefersToUser.email],
            },
          ],
        });
      });

      it.each<ConventionStatus>([
        "ACCEPTED_BY_VALIDATOR",
        "CANCELLED",
        "DEPRECATED",
        "IN_REVIEW",
        "PARTIALLY_SIGNED",
        "READY_TO_SIGN",
        "REJECTED",
      ])(
        "exclude conventions of agencies related to agencies with status %s with date start from one month ago to in five days",
        async (status) => {
          const conventionOneMonthAgoWithBasStatus = new ConventionDtoBuilder()
            .withId(uuid())
            .withStatus(status)
            .withDateStart(oneMonthAgo.toISOString())
            .build();

          uow.conventionRepository.setConventions([
            conventionOneMonthAgoWithBasStatus,
          ]);

          await useCase.execute();

          expectSavedNotificationsAndEvents({
            emails:
              conventionOneMonthAgoWithBasStatus.status === "IN_REVIEW"
                ? [
                    {
                      kind: "CONVENTION_SUMMARY_NOTIFICATION_TO_AGENCY",
                      params: {
                        agencyName: agencyWithRefersTo.name,
                        domain: appConfig.immersionFacileDomain,
                        conventionsToManage: 1,
                        newConventions: 0,
                        validatedConventions: 0,
                      },
                      bcc: [agencyRefersToUser.email],
                    },
                  ]
                : [],
          });
        },
      );
    });
  });
});
