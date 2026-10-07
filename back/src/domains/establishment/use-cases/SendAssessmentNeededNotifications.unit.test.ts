import { addDays, subDays } from "date-fns";
import {
  AgencyDtoBuilder,
  AssessmentDtoBuilder,
  assessmentEmailSender,
  ConnectedUserBuilder,
  type ConventionDto,
  ConventionDtoBuilder,
  errors,
  expectArraysToMatch,
  expectObjectInArrayToMatch,
  expectToEqual,
  getDisplayedBusinessName,
  getFormattedFirstnameAndLastname,
  immersionFacileNoReplyEmailSender,
  type Notification,
  type TemplatedEmail,
} from "shared";
import { v4 as uuid } from "uuid";
import { AppConfigBuilder } from "../../../utils/AppConfigBuilder";
import { toAgencyWithRights } from "../../../utils/agency";
import { fakeGenerateMagicLinkUrlFn } from "../../../utils/jwtTestHelper";
import {
  type ExpectSavedNotificationsAndEvents,
  makeExpectSavedNotificationsAndEvents,
} from "../../../utils/makeExpectSavedNotificationAndEvent.helpers";
import { makeCreateNewEvent } from "../../core/events/ports/EventBus";
import {
  makeSaveNotificationAndRelatedEvent,
  type SaveNotificationAndRelatedEvent,
} from "../../core/notifications/helpers/Notification";
import { DeterministShortLinkIdGeneratorGateway } from "../../core/short-link/adapters/short-link-generator-gateway/DeterministShortLinkIdGeneratorGateway";
import { CustomTimeGateway } from "../../core/time-gateway/adapters/CustomTimeGateway";
import {
  createInMemoryUow,
  type InMemoryUnitOfWork,
} from "../../core/unit-of-work/adapters/createInMemoryUow";
import { InMemoryUowPerformer } from "../../core/unit-of-work/adapters/InMemoryUowPerformer";
import { UuidV4Generator } from "../../core/uuid-generator/adapters/UuidGeneratorImplementations";
import {
  makeSendAssessmentNeededNotifications,
  type SendAssessmentNeededNotifications,
} from "./SendAssessmentNeededNotifications";

describe("SendAssessmentNeededNotifications", () => {
  let uow: InMemoryUnitOfWork;
  let sendEmailWithAssessmentCreationLink: SendAssessmentNeededNotifications;
  let timeGateway: CustomTimeGateway;
  let expectSavedNotificationsAndEvents: ExpectSavedNotificationsAndEvents;
  let saveNotificationAndRelatedEvent: SaveNotificationAndRelatedEvent;
  const config = new AppConfigBuilder().build();
  let shortLinkIdGeneratorGateway: DeterministShortLinkIdGeneratorGateway;

  const now = new Date("2021-05-15T08:00:00.000Z");
  const twoDaysAgo = subDays(now, 2);
  const yesterday = subDays(now, 1);
  const inOneDay = addDays(now, 1);
  const inTwoDays = addDays(now, 2);

  const agency = new AgencyDtoBuilder()
    .withLogoUrl("http://LOGO AGENCY IF URL")
    .build();

  const counsellor = new ConnectedUserBuilder()
    .withId("counsellor")
    .withEmail("counsellor@mail.com")
    .build();
  const validator1 = new ConnectedUserBuilder()
    .withId("validator1")
    .withEmail("validator1@mail.com")
    .build();
  const validator2 = new ConnectedUserBuilder()
    .withId("validator2")
    .withEmail("validator2@mail.com")
    .build();

  const conventionValidatedWithAgencyStartedTwoDaysAgo =
    new ConventionDtoBuilder()
      .withAgencyId(agency.id)
      .withDateStart(twoDaysAgo.toISOString())
      .validated()
      .build();

  const conventionEndedYesterday = new ConventionDtoBuilder(
    conventionValidatedWithAgencyStartedTwoDaysAgo,
  )
    .withId("11111111-1111-4111-8111-111111111111")
    .withDateEnd(yesterday.toISOString())
    .build();

  const conventionEndingTomorrow = new ConventionDtoBuilder(
    conventionValidatedWithAgencyStartedTwoDaysAgo,
  )
    .withId("22222222-2222-4222-8222-222222222222")
    .withDateEnd(inOneDay.toISOString())
    .build();

  const conventionEndingInTwoDays = new ConventionDtoBuilder(
    conventionValidatedWithAgencyStartedTwoDaysAgo,
  )
    .withId("33333333-3333-4333-8333-333333333333")
    .withDateEnd(inTwoDays.toISOString())
    .build();

  const shortLink1 = "short-link-id-1";
  const shortLink2 = "short-link-id-2";

  beforeEach(() => {
    const uuidGenerator = new UuidV4Generator();

    uow = createInMemoryUow();
    timeGateway = new CustomTimeGateway(now);

    expectSavedNotificationsAndEvents = makeExpectSavedNotificationsAndEvents(
      uow.notificationRepository,
      uow.outboxRepository,
    );
    saveNotificationAndRelatedEvent = makeSaveNotificationAndRelatedEvent(
      uuidGenerator,
      timeGateway,
    );
    shortLinkIdGeneratorGateway = new DeterministShortLinkIdGeneratorGateway();

    sendEmailWithAssessmentCreationLink = makeSendAssessmentNeededNotifications(
      {
        deps: {
          config,
          saveNotificationAndRelatedEvent,
          timeGateway,
          generateConventionMagicLinkUrl: fakeGenerateMagicLinkUrlFn,
          outOfTransaction: {
            conventionQueries: uow.conventionQueries,
            assessmentRepository: uow.assessmentRepository,
          },
          shortLinkIdGeneratorGateway,
          createNewEvent: makeCreateNewEvent({
            timeGateway,
            uuidGenerator,
          }),
          uowPerformer: new InMemoryUowPerformer(uow),
        },
      },
    );

    uow.agencyRepository.agencies = [
      toAgencyWithRights(agency, {
        [counsellor.id]: { isNotifiedByEmail: true, roles: ["counsellor"] },
        [validator1.id]: { isNotifiedByEmail: true, roles: ["validator"] },
        [validator2.id]: { isNotifiedByEmail: false, roles: ["validator"] },
      }),
    ];
    uow.userRepository.users = [counsellor, validator1, validator2];
    shortLinkIdGeneratorGateway.addMoreShortLinkIds([shortLink1]);
  });

  describe("Right paths", () => {
    it("Sends an email to tutors for immersions that end in time range and are kind immersion", async () => {
      shortLinkIdGeneratorGateway.addMoreShortLinkIds([shortLink2]);

      // Arrange
      uow.conventionRepository.setConventions([
        conventionEndedYesterday,
        conventionEndingTomorrow,
        conventionEndingInTwoDays,
      ]);

      expectToEqual(
        await sendEmailWithAssessmentCreationLink.execute({
          conventionEndDate: {
            from: yesterday,
            to: inOneDay,
          },
        }),
        {
          conventionsQtyWithImmersionEnding: 2,
          conventionsQtyWithAlreadyExistingAssessment: 0,
          conventionsQtyWithAssessmentSentSuccessfully: 2,
        },
      );

      // Assert
      expectSavedNotificationsAndEvents({
        emails: [
          makeEstablishmentNotification(conventionEndedYesterday, shortLink1),
          makeBeneficiaryNotification(conventionEndedYesterday),
          makeEstablishmentNotification(conventionEndingTomorrow, shortLink2),
          makeBeneficiaryNotification(conventionEndingTomorrow),
        ],
      });

      expectObjectInArrayToMatch(uow.outboxRepository.events, [
        { topic: "NotificationAdded" },
        { topic: "NotificationAdded" },
        {
          topic: "EmailWithLinkToCreateAssessmentSent",
          payload: { id: conventionEndedYesterday.id },
        },
        {
          topic: "BeneficiaryAssessmentEmailSent",
          payload: {
            id: conventionEndedYesterday.id,
          },
        },
        { topic: "NotificationAdded" },
        { topic: "NotificationAdded" },
        {
          topic: "EmailWithLinkToCreateAssessmentSent",
          payload: { id: conventionEndingTomorrow.id },
        },
        {
          topic: "BeneficiaryAssessmentEmailSent",
          payload: {
            id: conventionEndingTomorrow.id,
          },
        },
      ]);
    });

    it("Sends an email to tutors only for immersions that end in time range and are kind cci-ministage", async () => {
      // Arrange

      const conventionCCIEndingTomorrow = new ConventionDtoBuilder(
        conventionEndingTomorrow,
      )
        .withInternshipKind("mini-stage-cci")
        .build();

      const conventionCCIEndingInTwoDays = new ConventionDtoBuilder(
        conventionEndingInTwoDays,
      )
        .withInternshipKind("mini-stage-cci")
        .build();

      uow.conventionRepository.setConventions([
        conventionCCIEndingTomorrow,
        conventionCCIEndingInTwoDays,
      ]);

      // Act
      expectToEqual(
        await sendEmailWithAssessmentCreationLink.execute({
          conventionEndDate: {
            from: now,
            to: inOneDay,
          },
        }),
        {
          conventionsQtyWithImmersionEnding: 1,
          conventionsQtyWithAlreadyExistingAssessment: 0,
          conventionsQtyWithAssessmentSentSuccessfully: 1,
        },
      );

      // Assert
      expectSavedNotificationsAndEvents({
        emails: [
          makeEstablishmentNotification(conventionCCIEndingTomorrow),
          makeBeneficiaryNotification(conventionCCIEndingTomorrow),
        ],
      });

      expectObjectInArrayToMatch(uow.outboxRepository.events, [
        {
          topic: "NotificationAdded",
        },

        {
          topic: "NotificationAdded",
        },
        {
          topic: "EmailWithLinkToCreateAssessmentSent",
          payload: { id: conventionEndingTomorrow.id },
        },
        {
          topic: "BeneficiaryAssessmentEmailSent",
          payload: {
            id: conventionEndingTomorrow.id,
          },
        },
      ]);
    });

    it("Sends only establishment notification when beneficiary already received assessment notification", async () => {
      const existingBeneficiaryEmailContent: TemplatedEmail = {
        kind: "ASSESSMENT_BENEFICIARY_NOTIFICATION",
        params: {
          conventionId: conventionEndingTomorrow.id,
          beneficiaryLastName:
            conventionEndingTomorrow.signatories.beneficiary.lastName,
          beneficiaryFirstName:
            conventionEndingTomorrow.signatories.beneficiary.firstName,
          businessName: conventionEndingTomorrow.businessName,
          internshipKind: conventionEndingTomorrow.internshipKind,
          establishmentTutorEmail:
            conventionEndingTomorrow.establishmentTutor.email,
        },
        recipients: [conventionEndingTomorrow.signatories.beneficiary.email],
        sender: immersionFacileNoReplyEmailSender,
      };

      uow.conventionRepository.setConventions([conventionEndingTomorrow]);

      const existingBeneficiaryNotification: Notification = {
        createdAt: new Date().toISOString(),
        followedIds: {
          conventionId: conventionEndingTomorrow.id,
          agencyId: conventionEndingTomorrow.agencyId,
          establishmentSiret: conventionEndingTomorrow.siret,
        },
        id: "existing-beneficiary-notification",
        kind: "email",
        templatedContent: existingBeneficiaryEmailContent,
      };

      uow.notificationRepository.notifications = [
        existingBeneficiaryNotification,
      ];
      await uow.outboxRepository.save({
        id: "existing-notification-added",
        topic: "NotificationAdded",
        priority: 5,

        payload: {
          id: existingBeneficiaryNotification.id,
          kind: existingBeneficiaryNotification.kind,
        },
        occurredAt: new Date().toISOString(),
        publications: [],
        wasQuarantined: false,
        status: "published",
      });

      await uow.outboxRepository.save({
        id: "existing-beneficiary-assessment-email",
        topic: "BeneficiaryAssessmentEmailSent",
        priority: 5,
        payload: {
          id: conventionEndingTomorrow.id,
        },
        occurredAt: new Date().toISOString(),
        publications: [],
        wasQuarantined: false,
        status: "published",
      });

      expectToEqual(
        await sendEmailWithAssessmentCreationLink.execute({
          conventionEndDate: {
            from: now,
            to: inOneDay,
          },
        }),
        {
          conventionsQtyWithImmersionEnding: 1,
          conventionsQtyWithAlreadyExistingAssessment: 0,
          conventionsQtyWithAssessmentSentSuccessfully: 1,
        },
      );

      expectSavedNotificationsAndEvents({
        emails: [
          existingBeneficiaryEmailContent,
          makeEstablishmentNotification(conventionEndingTomorrow),
        ],
      });

      expectObjectInArrayToMatch(uow.outboxRepository.events, [
        {
          topic: "NotificationAdded",
        },
        {
          topic: "BeneficiaryAssessmentEmailSent",
          payload: {
            id: conventionEndingTomorrow.id,
          },
        },
        {
          topic: "NotificationAdded",
        },
        {
          topic: "EmailWithLinkToCreateAssessmentSent",
          payload: { id: conventionEndingTomorrow.id },
        },
      ]);
    });

    it("Does not send an email to tutor having already received one", async () => {
      const existingTutorTemplatedEmail: TemplatedEmail = {
        kind: "ASSESSMENT_ESTABLISHMENT_NOTIFICATION",
        params: {
          internshipKind: "immersion",
          assessmentCreationLink: fakeGenerateMagicLinkUrlFn({
            email: conventionEndedYesterday.establishmentTutor.email,
            id: conventionEndedYesterday.id,
            targetRoute: "assessment",
            role: "establishment-tutor",
            now,
          }),
          beneficiaryFirstName: getFormattedFirstnameAndLastname({
            firstname:
              conventionEndedYesterday.signatories.beneficiary.firstName,
          }),
          beneficiaryLastName: getFormattedFirstnameAndLastname({
            lastname: conventionEndedYesterday.signatories.beneficiary.lastName,
          }),
          conventionId: conventionEndedYesterday.id,
          establishmentTutorName: getFormattedFirstnameAndLastname({
            firstname: conventionEndedYesterday.establishmentTutor.firstName,
            lastname: conventionEndedYesterday.establishmentTutor.lastName,
          }),
          agencyLogoUrl: undefined,
        },
        recipients: [conventionEndedYesterday.establishmentTutor.email],
        sender: assessmentEmailSender,
      };
      // Arrange

      uow.conventionRepository.setConventions([conventionEndedYesterday]);
      const tutorNotification: Notification = {
        createdAt: new Date().toISOString(),
        followedIds: {
          conventionId: conventionEndedYesterday.id,
          agencyId: conventionEndedYesterday.agencyId,
          establishmentSiret: conventionEndedYesterday.siret,
        },
        id: "first-notification-added-manually",
        kind: "email",
        templatedContent: existingTutorTemplatedEmail,
      };
      uow.notificationRepository.notifications = [tutorNotification];

      await uow.outboxRepository.save({
        id: "existing-notification-added",
        topic: "NotificationAdded",
        priority: 5,
        payload: {
          id: tutorNotification.id,
          kind: tutorNotification.kind,
        },
        occurredAt: new Date().toISOString(),
        publications: [],
        wasQuarantined: false,
        status: "published",
      });

      await uow.outboxRepository.save({
        id: "existing-beneficiary-assessment-email",
        topic: "EmailWithLinkToCreateAssessmentSent",
        priority: 5,
        payload: {
          id: conventionEndedYesterday.id,
        },
        occurredAt: new Date().toISOString(),
        publications: [],
        wasQuarantined: false,
        status: "published",
      });

      expectArraysToMatch(uow.outboxRepository.events, [
        {
          topic: "NotificationAdded",
        },
        {
          topic: "EmailWithLinkToCreateAssessmentSent",
          payload: {
            id: conventionEndedYesterday.id,
          },
        },
      ]);

      // Act
      expectToEqual(
        await sendEmailWithAssessmentCreationLink.execute({
          conventionEndDate: {
            from: yesterday,
            to: now,
          },
        }),
        {
          conventionsQtyWithImmersionEnding: 1,
          conventionsQtyWithAlreadyExistingAssessment: 0,
          conventionsQtyWithAssessmentSentSuccessfully: 1,
        },
      );

      // Assert
      expectSavedNotificationsAndEvents({
        emails: [
          existingTutorTemplatedEmail,
          makeBeneficiaryNotification(conventionEndedYesterday),
        ],
      });
      expectArraysToMatch(uow.outboxRepository.events, [
        {
          topic: "NotificationAdded",
        },
        {
          topic: "EmailWithLinkToCreateAssessmentSent",
          payload: {
            id: conventionEndedYesterday.id,
          },
        },
        {
          topic: "NotificationAdded",
        },
        {
          topic: "BeneficiaryAssessmentEmailSent",
          payload: { id: conventionEndedYesterday.id },
        },
      ]);
    });

    describe("When an assessment as already been filled", () => {
      it("Does not send emails if the convention already has an assessment filled", async () => {
        uow.conventionRepository.setConventions([conventionEndedYesterday]);
        const assessmentDto = new AssessmentDtoBuilder()
          .withConventionId(conventionEndedYesterday.id)
          .build();
        uow.assessmentRepository.assessments = [
          {
            _entityName: "Assessment",
            numberOfHoursActuallyMade: 10,
            ...assessmentDto,
          },
        ];

        expectToEqual(uow.outboxRepository.events, []);

        expectToEqual(
          await sendEmailWithAssessmentCreationLink.execute({
            conventionEndDate: {
              from: yesterday,
              to: now,
            },
          }),
          {
            conventionsQtyWithImmersionEnding: 1,
            conventionsQtyWithAlreadyExistingAssessment: 1,
            conventionsQtyWithAssessmentSentSuccessfully: 0,
          },
        );

        expectToEqual(uow.notificationRepository.notifications, []);
        expectToEqual(uow.outboxRepository.events, []);
      });

      it("Only sends emails for conventions where no assessment was filled (in case there are several conventions)", async () => {
        const conventionEndingYesterdayWithoutAssessment =
          new ConventionDtoBuilder({ ...conventionEndedYesterday })
            .withId("aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaa00")
            .build();
        uow.conventionRepository.setConventions([
          conventionEndedYesterday,
          conventionEndingYesterdayWithoutAssessment,
        ]);

        const assessmentDto = new AssessmentDtoBuilder()
          .withConventionId(conventionEndedYesterday.id)
          .build();

        uow.assessmentRepository.assessments = [
          {
            _entityName: "Assessment",
            numberOfHoursActuallyMade: 10,
            ...assessmentDto,
          },
        ];

        expectToEqual(uow.outboxRepository.events, []);

        expectToEqual(
          await sendEmailWithAssessmentCreationLink.execute({
            conventionEndDate: {
              from: yesterday,
              to: now,
            },
          }),
          {
            conventionsQtyWithImmersionEnding: 2,
            conventionsQtyWithAlreadyExistingAssessment: 1,
            conventionsQtyWithAssessmentSentSuccessfully: 1,
          },
        );

        expectObjectInArrayToMatch(uow.notificationRepository.notifications, [
          {
            kind: "email",
            followedIds: {
              conventionId: conventionEndingYesterdayWithoutAssessment.id,
              agencyId: conventionEndingYesterdayWithoutAssessment.agencyId,
            },
            templatedContent: makeEstablishmentNotification(
              conventionEndingYesterdayWithoutAssessment,
            ),
          },
          {
            kind: "email",
            followedIds: {
              conventionId: conventionEndingYesterdayWithoutAssessment.id,
              agencyId: conventionEndingYesterdayWithoutAssessment.agencyId,
            },
            templatedContent: makeBeneficiaryNotification(
              conventionEndingYesterdayWithoutAssessment,
            ),
          },
        ]);
      });
    });
  });

  describe("Error handling report", () => {
    it("shows error in report about schema parsing error but does not fail the entire script", async () => {
      const phoneNumber =
        conventionEndedYesterday.signatories.beneficiary.phone;
      const conventionWithSignatoriesWithSamePhoneNumber =
        new ConventionDtoBuilder({ ...conventionEndedYesterday })
          .withBeneficiaryPhone(phoneNumber)
          .withEstablishmentRepresentativePhone(phoneNumber)
          .withDateSubmission(
            new Date("2026-01-01T00:00:00.000Z").toISOString(),
          )
          .build();
      uow.conventionRepository.setConventions([
        conventionWithSignatoriesWithSamePhoneNumber,
        conventionEndingTomorrow,
      ]);

      expectToEqual(
        await sendEmailWithAssessmentCreationLink.execute({
          conventionEndDate: {
            from: yesterday,
            to: inOneDay,
          },
        }),
        {
          conventionsQtyWithAlreadyExistingAssessment: 0,
          conventionsQtyWithAssessmentSentSuccessfully: 1,
          conventionsQtyWithImmersionEnding: 2,
          conventionsAssessmentSentErrored: {
            [conventionWithSignatoriesWithSamePhoneNumber.id]: new Error(
              `Schema validation failed for schema conventionSchema for element with id ${conventionWithSignatoriesWithSamePhoneNumber.id}. See issues for details.`,
            ),
          },
        },
      );

      expectObjectInArrayToMatch(uow.outboxRepository.events, [
        { topic: "NotificationAdded" },
        { topic: "NotificationAdded" },
        {
          topic: "EmailWithLinkToCreateAssessmentSent",
          payload: { id: conventionEndingTomorrow.id },
        },
        {
          topic: "BeneficiaryAssessmentEmailSent",
          payload: {
            id: conventionEndingTomorrow.id,
          },
        },
      ]);
    });

    it("shows error in report about convention on missing user but does not fail the entire script", async () => {
      const conventionWithoutAgency = new ConventionDtoBuilder(
        conventionValidatedWithAgencyStartedTwoDaysAgo,
      )
        .withAgencyId("cccccc99-9c0b-1bbb-bb6d-6bb9bd38bb3a")
        .withId(uuid())
        .withDateEnd(inOneDay.toISOString())
        .build();
      uow.conventionRepository.setConventions([
        conventionWithoutAgency,
        conventionEndingInTwoDays,
      ]);
      uow.userRepository.users = [];

      expectToEqual(
        await sendEmailWithAssessmentCreationLink.execute({
          conventionEndDate: {
            from: now,
            to: inOneDay,
          },
        }),
        {
          conventionsQtyWithAlreadyExistingAssessment: 0,
          conventionsQtyWithAssessmentSentSuccessfully: 0,
          conventionsQtyWithImmersionEnding: 1,
          conventionsAssessmentSentErrored: {
            [conventionWithoutAgency.id]: errors.agency.notFound({
              agencyId: conventionWithoutAgency.agencyId,
            }),
          },
        },
      );
    });

    it("shows error in report about convention on missing agency but does not fail the entire script", async () => {
      uow.conventionRepository.setConventions([
        conventionEndingTomorrow,
        conventionEndingInTwoDays,
      ]);
      uow.agencyRepository.agencies = [];

      expectToEqual(
        await sendEmailWithAssessmentCreationLink.execute({
          conventionEndDate: {
            from: now,
            to: inOneDay,
          },
        }),
        {
          conventionsQtyWithAlreadyExistingAssessment: 0,
          conventionsQtyWithAssessmentSentSuccessfully: 0,
          conventionsQtyWithImmersionEnding: 1,
          conventionsAssessmentSentErrored: {
            [conventionEndingTomorrow.id]: errors.agency.notFound({
              agencyId: conventionEndingTomorrow.agencyId,
            }),
          },
        },
      );
    });
  });

  const makeEstablishmentNotification = (
    convention: ConventionDto,
    shortLink: string = shortLink1,
  ): TemplatedEmail => ({
    kind: "ASSESSMENT_ESTABLISHMENT_NOTIFICATION",
    params: {
      // biome-ignore lint/style/noNonNullAssertion: logo provided on agency
      agencyLogoUrl: agency.logoUrl!,
      beneficiaryFirstName: getFormattedFirstnameAndLastname({
        firstname: convention.signatories.beneficiary.firstName,
      }),
      beneficiaryLastName: getFormattedFirstnameAndLastname({
        lastname: convention.signatories.beneficiary.lastName,
      }),
      conventionId: convention.id,
      establishmentTutorName: getFormattedFirstnameAndLastname({
        firstname: convention.establishmentTutor.firstName,
        lastname: convention.establishmentTutor.lastName,
      }),
      assessmentCreationLink: `${config.immersionFacileBaseUrl}/api/to/${shortLink}`,
      internshipKind: convention.internshipKind,
    },
    recipients: [convention.establishmentTutor.email],
    sender: assessmentEmailSender,
  });

  const makeBeneficiaryNotification = (
    convention: ConventionDto,
  ): TemplatedEmail => ({
    kind: "ASSESSMENT_BENEFICIARY_NOTIFICATION",
    params: {
      conventionId: convention.id,
      beneficiaryLastName: getFormattedFirstnameAndLastname({
        lastname: convention.signatories.beneficiary.lastName,
      }),
      beneficiaryFirstName: getFormattedFirstnameAndLastname({
        firstname: convention.signatories.beneficiary.firstName,
      }),
      businessName: getDisplayedBusinessName(convention),
      internshipKind: convention.internshipKind,
      establishmentTutorEmail: convention.establishmentTutor.email,
    },
    recipients: [convention.signatories.beneficiary.email],
    sender: immersionFacileNoReplyEmailSender,
  });
});
