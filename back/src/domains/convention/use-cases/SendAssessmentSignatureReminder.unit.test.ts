import { subHours } from "date-fns";
import {
  AgencyDtoBuilder,
  type AgencyRole,
  type AssessmentDto,
  type AssessmentSignatureReminderAuthorizedRole,
  assessmentSignatureReminderAuthorizedRoles,
  CONVENTION_MANUAL_REMINDER_COOLDOWN_IN_HOURS,
  ConnectedUserBuilder,
  ConventionDtoBuilder,
  type ConventionRelatedJwtPayload,
  type ConventionRole,
  errors,
  expectObjectInArrayToMatch,
  expectPromiseToFailWithError,
  expectToEqual,
  getFormattedFirstnameAndLastname,
} from "shared";
import type { AppConfig } from "../../../config/bootstrap/appConfig";
import { AppConfigBuilder } from "../../../utils/AppConfigBuilder";
import { toAgencyWithRights } from "../../../utils/agency";
import { createConventionMagicLinkPayload } from "../../../utils/jwt";
import { fakeGenerateMagicLinkUrlFn } from "../../../utils/jwtTestHelper";
import { makeCreateNewEvent } from "../../core/events/ports/EventBus";
import { makeSaveNotificationAndRelatedEvent } from "../../core/notifications/helpers/Notification";
import { DeterministShortLinkIdGeneratorGateway } from "../../core/short-link/adapters/short-link-generator-gateway/DeterministShortLinkIdGeneratorGateway";
import { makeShortLinkUrl } from "../../core/short-link/ShortLink";
import { CustomTimeGateway } from "../../core/time-gateway/adapters/CustomTimeGateway";
import type { TimeGateway } from "../../core/time-gateway/ports/TimeGateway";
import {
  createInMemoryUow,
  type InMemoryUnitOfWork,
} from "../../core/unit-of-work/adapters/createInMemoryUow";
import { InMemoryUowPerformer } from "../../core/unit-of-work/adapters/InMemoryUowPerformer";
import { TestUuidGenerator } from "../../core/uuid-generator/adapters/UuidGeneratorImplementations";
import { EstablishmentAggregateBuilder } from "../../establishment/helpers/EstablishmentBuilders";
import { createAssessmentEntity } from "../entities/AssessmentEntity";
import {
  makeSendAssessmentSignatureReminder,
  type SendAssessmentSignatureReminder,
} from "./SendAssessmentSignatureReminder";

const now = new Date("2026-05-01T10:00:00.000Z");
const config: AppConfig = new AppConfigBuilder({}).build();
const shortLinkId = "shortLinkId";
const notificationId = "assessment-signature-reminder-notification-id";

const convention = new ConventionDtoBuilder()
  .withStatus("ACCEPTED_BY_VALIDATOR")
  .withBeneficiaryPhone("+33612345679")
  .withBeneficiaryEmail("beneficiary@mail.com")
  .build();

const assessmentDto: AssessmentDto = {
  conventionId: convention.id,
  status: "COMPLETED",
  endedWithAJob: false,
  establishmentFeedback: "Feedback",
  establishmentAdvices: "Advices",
  beneficiaryAgreement: true,
  beneficiaryFeedback: null,
  signedAt: null,
  createdAt: "2026-04-01T00:00:00.000Z",
};

const agency = new AgencyDtoBuilder().withId(convention.agencyId).build();

const connectedValidator = new ConnectedUserBuilder().build();

const establishmentRepresentativeJwt = createConventionMagicLinkPayload({
  id: convention.id,
  role: "establishment-representative",
  email: convention.signatories.establishmentRepresentative.email,
  now,
});

describe("SendAssessmentSignatureReminder", () => {
  let uow: InMemoryUnitOfWork;
  let usecase: SendAssessmentSignatureReminder;
  let timeGateway: TimeGateway;

  beforeEach(() => {
    timeGateway = new CustomTimeGateway(now);
    uow = createInMemoryUow();
    const shortLinkIdGeneratorGateway =
      new DeterministShortLinkIdGeneratorGateway();
    const uuidGenerator = new TestUuidGenerator();
    uuidGenerator.setNextUuids([
      notificationId,
      "notification-added-event-id",
      "assessment-signature-reminder-manually-sent-event-id",
    ]);

    usecase = makeSendAssessmentSignatureReminder({
      uowPerformer: new InMemoryUowPerformer(uow),
      deps: {
        saveNotificationAndRelatedEvent: makeSaveNotificationAndRelatedEvent(
          uuidGenerator,
          timeGateway,
        ),
        generateConventionMagicLinkUrl: fakeGenerateMagicLinkUrlFn,
        timeGateway,
        shortLinkIdGeneratorGateway,
        config,
        createNewEvent: makeCreateNewEvent({ uuidGenerator, timeGateway }),
      },
    });

    shortLinkIdGeneratorGateway.addMoreShortLinkIds([shortLinkId]);
    uow.conventionRepository.setConventions([convention]);
    uow.agencyRepository.agencies = [
      toAgencyWithRights(agency, {
        [connectedValidator.id]: {
          roles: ["validator"],
          isNotifiedByEmail: false,
        },
      }),
    ];
    uow.userRepository.users = [connectedValidator];
    uow.assessmentRepository.assessments = [
      createAssessmentEntity(assessmentDto, convention),
    ];
  });

  it("sends email reminder to beneficiary", async () => {
    await usecase.execute(
      { conventionId: convention.id, notificationKind: "email" },
      { userId: connectedValidator.id },
    );

    expectToEqual(uow.notificationRepository.notifications, [
      {
        id: notificationId,
        createdAt: now.toISOString(),
        kind: "email",
        followedIds: {
          conventionId: convention.id,
          agencyId: convention.agencyId,
          establishmentSiret: convention.siret,
        },
        templatedContent: {
          kind: "ASSESSMENT_NEEDS_SIGNATURE_BENEFICIARY_NOTIFICATION",
          recipients: [convention.signatories.beneficiary.email],
          params: {
            conventionId: convention.id,
            beneficiaryFirstName: getFormattedFirstnameAndLastname({
              firstname: convention.signatories.beneficiary.firstName,
            }),
            beneficiaryLastName: getFormattedFirstnameAndLastname({
              lastname: convention.signatories.beneficiary.lastName,
            }),
            businessName: convention.businessName,
            internshipKind: convention.internshipKind,
            assessmentSignatureLink: makeShortLinkUrl(config, shortLinkId),
          },
        },
      },
    ]);
    expectObjectInArrayToMatch(uow.outboxRepository.events, [
      { topic: "NotificationAdded" },
      {
        topic: "AssessmentSignatureReminderManuallySent",
        payload: {
          convention,
          transport: "email",
          triggeredBy: {
            kind: "connected-user",
            userId: connectedValidator.id,
          },
        },
      },
    ]);
  });

  it("sends sms reminder to beneficiary", async () => {
    await usecase.execute(
      { conventionId: convention.id, notificationKind: "sms" },
      establishmentRepresentativeJwt,
    );

    expectToEqual(uow.notificationRepository.notifications, [
      {
        id: notificationId,
        createdAt: now.toISOString(),
        kind: "sms",
        followedIds: {
          conventionId: convention.id,
          agencyId: convention.agencyId,
          establishmentSiret: convention.siret,
          userId: undefined,
        },
        templatedContent: {
          recipientPhone: convention.signatories.beneficiary.phone,
          kind: "ReminderForAssessmentSignature",
          params: {
            shortLink: makeShortLinkUrl(config, shortLinkId),
          },
        },
      },
    ]);
    expectObjectInArrayToMatch(uow.outboxRepository.events, [
      { topic: "NotificationAdded" },
      { topic: "AssessmentSignatureReminderManuallySent" },
    ]);
  });

  it("throws when assessment already signed", async () => {
    const signedAssessment = createAssessmentEntity(
      { ...assessmentDto, signedAt: "2026-04-02" },
      convention,
    );
    uow.assessmentRepository.assessments = [signedAssessment];

    await expectPromiseToFailWithError(
      usecase.execute(
        { conventionId: convention.id, notificationKind: "email" },
        { userId: connectedValidator.id },
      ),
      errors.assessment.alreadySigned(convention.id),
    );
  });

  it("throws when convention status is not ACCEPTED_BY_VALIDATOR", async () => {
    uow.conventionRepository.setConventions([
      new ConventionDtoBuilder(convention).withStatus("READY_TO_SIGN").build(),
    ]);

    await expectPromiseToFailWithError(
      usecase.execute(
        { conventionId: convention.id, notificationKind: "email" },
        { userId: connectedValidator.id },
      ),
      errors.assessment.sendAssessmentSignatureReminderNotAllowedForStatus({
        status: "READY_TO_SIGN",
      }),
    );
  });

  it.each([
    "beneficiary",
    "beneficiary-current-employer",
    "beneficiary-representative",
  ] satisfies ConventionRole[])(
    "throws forbidden for %s role",
    async (role) => {
      const jwt = createConventionMagicLinkPayload({
        id: convention.id,
        role,
        email: convention.signatories.beneficiary.email,
        now,
      });
      await expectPromiseToFailWithError(
        usecase.execute(
          { conventionId: convention.id, notificationKind: "email" },
          jwt,
        ),
        errors.assessment.sendAssessmentSignatureReminderForbidden(),
      );
    },
  );

  it.each(assessmentSignatureReminderAuthorizedRoles)(
    "allows for %s role",
    async (role) => {
      await usecase.execute(
        { conventionId: convention.id, notificationKind: "email" },
        prepareAuthorizedJwtPayload(role),
      );

      expectToEqual(uow.notificationRepository.notifications.length, 1);
    },
  );

  it("throws too many requests when email was sent less than 24h ago", async () => {
    uow.notificationRepository.notifications = [
      {
        id: "past-email-notification",
        createdAt: subHours(timeGateway.now(), 2).toISOString(),
        kind: "email",
        followedIds: {
          conventionId: convention.id,
          agencyId: convention.agencyId,
          establishmentSiret: convention.siret,
        },
        templatedContent: {
          kind: "ASSESSMENT_NEEDS_SIGNATURE_BENEFICIARY_NOTIFICATION",
          recipients: [convention.signatories.beneficiary.email],
          params: {
            conventionId: convention.id,
            beneficiaryFirstName: "Jean",
            beneficiaryLastName: "Dupont",
            businessName: convention.businessName,
            internshipKind: convention.internshipKind,
            assessmentSignatureLink: "https://example.com",
          },
        },
      },
    ];

    await expectPromiseToFailWithError(
      usecase.execute(
        { conventionId: convention.id, notificationKind: "email" },
        { userId: connectedValidator.id },
      ),
      errors.assessment.assessmentLinkAlreadySent({
        notificationKind: "email",
        minHoursBetweenReminder: CONVENTION_MANUAL_REMINDER_COOLDOWN_IN_HOURS,
        timeRemaining: "22h00",
      }),
    );
  });

  it("throws too many requests when sms was sent less than 24h ago", async () => {
    uow.notificationRepository.notifications = [
      {
        id: "past-sms-notification",
        createdAt: subHours(timeGateway.now(), 2).toISOString(),
        kind: "sms",
        followedIds: {
          conventionId: convention.id,
          agencyId: convention.agencyId,
          establishmentSiret: convention.siret,
        },
        templatedContent: {
          recipientPhone: convention.signatories.beneficiary.phone,
          kind: "ReminderForAssessmentSignature",
          params: {
            shortLink: makeShortLinkUrl(config, shortLinkId),
          },
        },
      },
    ];

    await expectPromiseToFailWithError(
      usecase.execute(
        { conventionId: convention.id, notificationKind: "sms" },
        { userId: connectedValidator.id },
      ),
      errors.assessment.assessmentLinkAlreadySent({
        notificationKind: "sms",
        minHoursBetweenReminder: CONVENTION_MANUAL_REMINDER_COOLDOWN_IN_HOURS,
        timeRemaining: "22h00",
      }),
    );
  });

  const prepareAuthorizedJwtPayload = (
    role: AssessmentSignatureReminderAuthorizedRole,
  ): ConventionRelatedJwtPayload => {
    const roleTestUser = new ConnectedUserBuilder()
      .withId(`assessment-signature-reminder-${role}-user`)
      .build();

    if (role === "back-office") {
      const admin = new ConnectedUserBuilder(roleTestUser)
        .withIsAdmin(true)
        .build();
      uow.agencyRepository.agencies = [toAgencyWithRights(agency, {})];
      uow.userRepository.users = [admin];

      return { userId: admin.id };
    }

    if (role === "establishment-representative")
      return createConventionMagicLinkPayload({
        id: convention.id,
        role: "establishment-representative",
        email: convention.signatories.establishmentRepresentative.email,
        now,
      });

    if (role === "establishment-tutor")
      return createConventionMagicLinkPayload({
        id: convention.id,
        role: "establishment-tutor",
        email: convention.establishmentTutor.email,
        now,
      });

    if (role === "establishment-admin" || role === "establishment-contact") {
      uow.establishmentAggregateRepository.establishmentAggregates = [
        new EstablishmentAggregateBuilder()
          .withEstablishmentSiret(convention.siret)
          .withUserRights([
            {
              userId: roleTestUser.id,
              role,
              status: "ACCEPTED",
              job: "job",
              phone: "phone",
              shouldReceiveDiscussionNotifications: true,
              isMainContactByPhone: false,
            },
          ])
          .build(),
      ];
      uow.agencyRepository.agencies = [toAgencyWithRights(agency, {})];
      uow.userRepository.users = [roleTestUser];

      return { userId: roleTestUser.id };
    }

    uow.agencyRepository.agencies = [
      toAgencyWithRights(agency, {
        [roleTestUser.id]: {
          roles: [role as AgencyRole],
          isNotifiedByEmail: false,
        },
      }),
    ];
    uow.userRepository.users = [roleTestUser];

    return { userId: roleTestUser.id };
  };
});
