import { addDays, subDays, subHours } from "date-fns";
import {
  AgencyDtoBuilder,
  type AgencyRole,
  CONVENTION_MANUAL_REMINDER_COOLDOWN_IN_HOURS,
  ConnectedUserBuilder,
  type ConnectedUserDomainJwtPayload,
  ConventionDtoBuilder,
  type ConventionRole,
  defaultPhoneNumber,
  type EstablishmentRole,
  errors,
  expectObjectInArrayToMatch,
  expectPromiseToFailWithError,
  expectToEqual,
  type Notification,
  reasonableSchedule,
  type SignatoryRole,
  UserBuilder,
} from "shared";
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
import { UuidV4Generator } from "../../core/uuid-generator/adapters/UuidGeneratorImplementations";
import { EstablishmentAggregateBuilder } from "../../establishment/helpers/EstablishmentBuilders";
import {
  makeSendAssessmentLink,
  type SendAssessmentLink,
} from "./SendAssessmentLink";

describe("SendAssessmentLink", () => {
  const config = new AppConfigBuilder().build();
  let uow: InMemoryUnitOfWork;
  let usecase: SendAssessmentLink;
  let timeGateway: TimeGateway;

  const now = new Date();
  const signedAt = subDays(now, 10).toISOString();
  const dateStart = subDays(now, 5).toISOString();
  const dateEnd = now.toISOString();

  const shortLinkId = "link1";

  const convention = new ConventionDtoBuilder()
    .withId("add5c20e-6dd2-45af-affe-927358005251")
    .withStatus("ACCEPTED_BY_VALIDATOR")
    .withDateStart(dateStart)
    .withDateEnd(dateEnd)
    .withSchedule(reasonableSchedule)
    .withBeneficiaryEmail("beneficiary@mail.com")
    .withBeneficiaryRepresentative({
      email: "beneficiary-representative@mail.com",
      firstName: "Robert",
      lastName: "Thénardier",
      phone: "+33601010101",
      role: "beneficiary-representative",
      signedAt,
    })
    .withBeneficiaryCurrentEmployer({
      email: "beneficiary-current-employer@mail.com",
      firstName: "Robert",
      lastName: "Thénardier",
      phone: "+33601010102",
      role: "beneficiary-current-employer",
      businessName: "Current Employer SARL",
      businessSiret: "12345678901234",
      job: "Manager",
      signedAt,
      businessAddress: "Rue des Bouchers 67065 Strasbourg",
    })
    .withEstablishmentRepresentative({
      email: "establishment-representative@mail.com",
      firstName: "Robert",
      lastName: "Thénardier",
      phone: "+33602010203",
      role: "establishment-representative",
      signedAt,
    })
    .withEstablishmentTutor({
      email: "tutor@mail.com",
      firstName: "Robert",
      lastName: "Thénardier",
      phone: "+33612345679",
      role: "establishment-tutor",
      job: "Tutor",
    })
    .build();

  const agency = new AgencyDtoBuilder().withId(convention.agencyId).build();

  const notConnectedUser = new UserBuilder()
    .withEmail("validator@mail.com")
    .build();

  const connectedUser = new ConnectedUserBuilder()
    .withId("bcc5c20e-6dd2-45cf-affe-927358005262")
    .build();

  const connectedBeneficiaryUser = new ConnectedUserBuilder()
    .withId("bcc5c20e-6dd2-45cf-affe-927358005264")
    .withEmail(convention.signatories.beneficiary.email)
    .build();

  const backofficeAdmin = new ConnectedUserBuilder()
    .withId("bcc5c20e-6dd2-45cf-affe-927358005263")
    .withIsAdmin(true)
    .build();

  const validatorJwtPayload = createConventionMagicLinkPayload({
    id: convention.id,
    role: "validator",
    email: notConnectedUser.email,
    now: new Date(),
  });

  const counsellorJwtPayload = createConventionMagicLinkPayload({
    id: convention.id,
    role: "counsellor",
    email: notConnectedUser.email,
    now: new Date(),
  });

  beforeEach(() => {
    timeGateway = new CustomTimeGateway(now);
    uow = createInMemoryUow();
    const shortLinkIdGeneratorGateway =
      new DeterministShortLinkIdGeneratorGateway();
    const uuidGenerator = new UuidV4Generator();

    usecase = makeSendAssessmentLink({
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
    uow.userRepository.users = [
      notConnectedUser,
      connectedUser,
      backofficeAdmin,
    ];
  });

  describe("wrong paths", () => {
    it("throws bad request if requested convention does not match the one in jwt", async () => {
      const wrongConventionId = "1dd5c20e-6dd2-45af-affe-927358005250";

      uow.agencyRepository.agencies = [toAgencyWithRights(agency, {})];

      await expectPromiseToFailWithError(
        usecase.execute(
          {
            conventionId: convention.id,
            notificationKind: "sms",
          },
          { ...validatorJwtPayload, applicationId: wrongConventionId },
        ),
        errors.convention.forbiddenConventionIdMismatch({
          jwtConventionId: wrongConventionId,
          jwtRole: validatorJwtPayload.role,
          requestedConventionId: convention.id,
        }),
      );
    });

    it("throws not found if convention does not exist", async () => {
      uow.conventionRepository.setConventions([]);

      await expectPromiseToFailWithError(
        usecase.execute(
          {
            conventionId: convention.id,
            notificationKind: "sms",
          },
          validatorJwtPayload,
        ),
        errors.convention.notFound({
          conventionId: convention.id,
        }),
      );
    });

    it("throws bad request if status is not ACCEPTED_BY_VALIDATOR", async () => {
      const conventionWithWrongStatus = new ConventionDtoBuilder(convention)
        .withStatus("IN_REVIEW")
        .build();

      uow.agencyRepository.agencies = [
        toAgencyWithRights(agency, {
          [notConnectedUser.id]: {
            roles: ["validator"],
            isNotifiedByEmail: true,
          },
        }),
      ];
      uow.conventionRepository.setConventions([conventionWithWrongStatus]);

      await expectPromiseToFailWithError(
        usecase.execute(
          {
            conventionId: conventionWithWrongStatus.id,
            notificationKind: "sms",
          },
          validatorJwtPayload,
        ),
        errors.assessment.sendAssessmentLinkNotAllowedForStatus({
          status: "IN_REVIEW",
        }),
      );
    });

    it("throws bad request if immersion ends in more than 1 day", async () => {
      const today = timeGateway.now();
      const conventionWithDateEndInMoreThan1Days = new ConventionDtoBuilder(
        convention,
      )
        .withDateEnd(addDays(today, 2).toISOString())
        .withSchedule(reasonableSchedule, ["samedi", "dimanche"])
        .build();

      uow.agencyRepository.agencies = [
        toAgencyWithRights(agency, {
          [notConnectedUser.id]: {
            roles: ["validator"],
            isNotifiedByEmail: true,
          },
        }),
      ];
      uow.conventionRepository.setConventions([
        conventionWithDateEndInMoreThan1Days,
      ]);

      await expectPromiseToFailWithError(
        usecase.execute(
          {
            conventionId: conventionWithDateEndInMoreThan1Days.id,
            notificationKind: "sms",
          },
          validatorJwtPayload,
        ),
        errors.assessment.conventionEndingInMoreThanOneDay(),
      );
    });

    it("throws bad request if assessment is already filled", async () => {
      uow.agencyRepository.agencies = [
        toAgencyWithRights(agency, {
          [notConnectedUser.id]: {
            roles: ["validator"],
            isNotifiedByEmail: true,
          },
        }),
      ];

      uow.assessmentRepository.save({
        conventionId: convention.id,
        status: "COMPLETED",
        endedWithAJob: false,
        establishmentFeedback: "establishmentFeedback",
        establishmentAdvices: "establishmentAdvices",
        numberOfHoursActuallyMade: 10,
        beneficiaryAgreement: null,
        beneficiaryFeedback: null,
        signedAt: null,
        createdAt: new Date().toISOString(),
        _entityName: "Assessment",
      });

      await expectPromiseToFailWithError(
        usecase.execute(
          {
            conventionId: convention.id,
            notificationKind: "sms",
          },
          validatorJwtPayload,
        ),
        errors.assessment.assessmentAlreadyFullfilled(convention.id),
      );
    });

    describe("from connected user", () => {
      it("throws not found if connected user id does not exist", async () => {
        const unexistingUserPayload: ConnectedUserDomainJwtPayload = {
          userId: "bcc5c20e-6dd2-45cf-affe-927358005267",
        };
        uow.agencyRepository.agencies = [toAgencyWithRights(agency, {})];

        await expectPromiseToFailWithError(
          usecase.execute(
            {
              conventionId: convention.id,
              notificationKind: "sms",
            },
            unexistingUserPayload,
          ),
          errors.user.notFound(unexistingUserPayload),
        );
      });

      it.each(["agency-admin", "agency-viewer", "to-review"] as AgencyRole[])(
        "throws unauthorized if agency user has not enough rights on convention",
        async (role) => {
          uow.agencyRepository.agencies = [
            toAgencyWithRights(agency, {
              [connectedUser.id]: { roles: [role], isNotifiedByEmail: true },
            }),
          ];

          await expectPromiseToFailWithError(
            usecase.execute(
              {
                conventionId: convention.id,
                notificationKind: "sms",
              },
              { userId: connectedUser.id },
            ),
            errors.assessment.sendAssessmentLinkForbidden(),
          );
        },
      );

      it("throws unauthorized if connected user email is not linked to the convention", async () => {
        const unrelatedUser = new ConnectedUserBuilder()
          .withId("bcc5c20e-6dd2-45cf-affe-927358005265")
          .withEmail("unrelated@mail.com")
          .build();

        uow.agencyRepository.agencies = [toAgencyWithRights(agency, {})];
        uow.userRepository.users = [unrelatedUser];

        await expectPromiseToFailWithError(
          usecase.execute(
            {
              conventionId: convention.id,
              notificationKind: "sms",
            },
            { userId: unrelatedUser.id },
          ),
          errors.assessment.sendAssessmentLinkForbidden(),
        );
      });

      it.each([
        "establishment-admin",
        "establishment-contact",
      ] as EstablishmentRole[])(
        "throws unauthorized if establishment user has not enough rights on convention",
        async (role) => {
          await uow.establishmentAggregateRepository.insertEstablishmentAggregate(
            new EstablishmentAggregateBuilder()
              .withUserRights([
                {
                  userId: connectedUser.id,
                  role,
                  status: "ACCEPTED",
                  job: "job",
                  phone: "phone",
                  shouldReceiveDiscussionNotifications: true,
                  isMainContactByPhone: false,
                },
              ])
              .build(),
          );
          uow.agencyRepository.agencies = [toAgencyWithRights(agency, {})];

          await expectPromiseToFailWithError(
            usecase.execute(
              {
                conventionId: convention.id,
                notificationKind: "sms",
              },
              { userId: connectedUser.id },
            ),
            errors.assessment.sendAssessmentLinkForbidden(),
          );
        },
      );
    });

    describe("from magiclink", () => {
      it.each(["agency-admin", "agency-viewer", "to-review"] as AgencyRole[])(
        "throws unauthorized if user has not enough rights on agency",
        async (role) => {
          uow.agencyRepository.agencies = [
            toAgencyWithRights(agency, {
              [notConnectedUser.id]: {
                roles: [role],
                isNotifiedByEmail: true,
              },
            }),
          ];

          const notConnectedUserJwtPayload = createConventionMagicLinkPayload({
            id: convention.id,
            role: role as ConventionRole,
            email: notConnectedUser.email,
            now: new Date(),
          });

          await expectPromiseToFailWithError(
            usecase.execute(
              {
                conventionId: convention.id,
                notificationKind: "sms",
              },
              notConnectedUserJwtPayload,
            ),
            errors.assessment.sendAssessmentLinkForbidden(),
          );
        },
      );

      it.each([
        "beneficiary-representative",
        "beneficiary-current-employer",
        "beneficiary",
        "establishment-representative",
      ] as SignatoryRole[])(
        "throws unauthorized if signatory has no rights on convention",
        async (role) => {
          uow.agencyRepository.agencies = [toAgencyWithRights(agency, {})];

          await expectPromiseToFailWithError(
            usecase.execute(
              {
                conventionId: convention.id,
                notificationKind: "sms",
              },
              {
                applicationId: convention.id,
                role,
                emailHash: "emailHash",
              },
            ),
            errors.convention.emailNotLinkedToConvention(role),
          );
        },
      );

      it(`throws too many requests if there was already a assessment link sent less than ${CONVENTION_MANUAL_REMINDER_COOLDOWN_IN_HOURS} hours before`, async () => {
        uow.agencyRepository.agencies = [
          toAgencyWithRights(agency, {
            [notConnectedUser.id]: {
              roles: ["validator"],
              isNotifiedByEmail: true,
            },
          }),
        ];
        uow.notificationRepository.notifications = [
          {
            id: "past-notification-id",
            createdAt: subHours(timeGateway.now(), 2).toISOString(),
            kind: "sms",
            followedIds: {
              conventionId: convention.id,
              agencyId: convention.agencyId,
              establishmentSiret: convention.siret,
              userId: undefined,
            },
            templatedContent: {
              recipientPhone: convention.establishmentTutor.phone,
              kind: "ReminderForAssessment",
              params: {
                shortLink: makeShortLinkUrl(config, "shortLink"),
              },
            },
          },
        ];

        await expectPromiseToFailWithError(
          usecase.execute(
            {
              conventionId: convention.id,
              notificationKind: "sms",
            },
            validatorJwtPayload,
          ),
          errors.assessment.assessmentLinkAlreadySent({
            notificationKind: "sms",
            minHoursBetweenReminder:
              CONVENTION_MANUAL_REMINDER_COOLDOWN_IN_HOURS,
            timeRemaining: "22h00",
          }),
        );
      });

      it(`throws too many requests if there was already an assessment email sent less than ${CONVENTION_MANUAL_REMINDER_COOLDOWN_IN_HOURS} hours before`, async () => {
        uow.agencyRepository.agencies = [
          toAgencyWithRights(agency, {
            [notConnectedUser.id]: {
              roles: ["validator"],
              isNotifiedByEmail: true,
            },
          }),
        ];
        uow.notificationRepository.notifications = [
          {
            id: "past-email-notification-id",
            createdAt: subHours(timeGateway.now(), 2).toISOString(),
            kind: "email",
            followedIds: {
              conventionId: convention.id,
              agencyId: convention.agencyId,
              establishmentSiret: convention.siret,
              userId: undefined,
            },
            templatedContent: {
              kind: "ASSESSMENT_ESTABLISHMENT_NOTIFICATION",
              recipients: [convention.establishmentTutor.email],
              sender: {
                name: "Immersion Facilitée",
                email: "contact@immersion-facile.beta.gouv.fr",
              },
              params: {
                agencyLogoUrl: undefined,
                beneficiaryFirstName:
                  convention.signatories.beneficiary.firstName,
                beneficiaryLastName:
                  convention.signatories.beneficiary.lastName,
                conventionId: convention.id,
                establishmentTutorName: convention.establishmentTutor.lastName,
                assessmentCreationLink: makeShortLinkUrl(config, "shortLink"),
                internshipKind: convention.internshipKind,
              },
            },
          },
        ];

        await expectPromiseToFailWithError(
          usecase.execute(
            {
              conventionId: convention.id,
              notificationKind: "email",
            },
            validatorJwtPayload,
          ),
          errors.assessment.assessmentLinkAlreadySent({
            notificationKind: "email",
            minHoursBetweenReminder:
              CONVENTION_MANUAL_REMINDER_COOLDOWN_IN_HOURS,
            timeRemaining: "22h00",
          }),
        );
      });
    });
  });

  describe("right paths: send assessment link", () => {
    describe("from connected user", () => {
      it.each(["validator", "counsellor"] as const)(
        "When pro connected %s triggers it",
        async (role) => {
          uow.agencyRepository.agencies = [
            toAgencyWithRights(agency, {
              [connectedUser.id]: {
                roles: [role],
                isNotifiedByEmail: false,
              },
            }),
          ];

          await usecase.execute(
            {
              conventionId: convention.id,
              notificationKind: "sms",
            },
            { userId: connectedUser.id },
          );

          expectToEqual(uow.shortLinkQuery.getShortLinks(), [
            {
              id: shortLinkId,
              url: fakeGenerateMagicLinkUrlFn({
                id: convention.id,
                role: convention.establishmentTutor.role,
                email: convention.establishmentTutor.email,
                now: timeGateway.now(),
                targetRoute: "assessment",
                lifetime: "2Days",
                extraQueryParams: { at_campaign: "sms-assessment-link" },
              }),
              lastUsedAt: null,
            },
          ]);

          expectObjectInArrayToMatch(uow.outboxRepository.events, [
            { topic: "NotificationAdded" },
            {
              topic: "AssessmentReminderManuallySent",
              payload: {
                convention,
                transport: "sms",
                triggeredBy: {
                  kind: "connected-user",
                  userId: connectedUser.id,
                },
              },
            },
          ]);
          expectObjectInArrayToMatch(uow.notificationRepository.notifications, [
            {
              kind: "sms",
              followedIds: {
                conventionId: convention.id,
                agencyId: convention.agencyId,
                establishmentSiret: convention.siret,
                userId: connectedUser.id,
              },
              templatedContent: {
                recipientPhone: convention.establishmentTutor.phone,
                kind: "ReminderForAssessment",
                params: {
                  shortLink: makeShortLinkUrl(config, shortLinkId),
                },
              },
            },
          ]);
        },
      );

      it("When connected beneficiary triggers it", async () => {
        uow.agencyRepository.agencies = [toAgencyWithRights(agency, {})];
        uow.userRepository.users = [connectedBeneficiaryUser];

        await usecase.execute(
          {
            conventionId: convention.id,
            notificationKind: "sms",
          },
          { userId: connectedBeneficiaryUser.id },
        );

        expectToEqual(uow.shortLinkQuery.getShortLinks(), [
          {
            id: shortLinkId,
            url: fakeGenerateMagicLinkUrlFn({
              id: convention.id,
              role: convention.establishmentTutor.role,
              email: convention.establishmentTutor.email,
              now: timeGateway.now(),
              targetRoute: "assessment",
              lifetime: "2Days",
              extraQueryParams: { at_campaign: "sms-assessment-link" },
            }),
            lastUsedAt: null,
          },
        ]);

        expectObjectInArrayToMatch(uow.outboxRepository.events, [
          { topic: "NotificationAdded" },
          {
            topic: "AssessmentReminderManuallySent",
            payload: {
              convention,
              transport: "sms",
              triggeredBy: {
                kind: "connected-user",
                userId: connectedBeneficiaryUser.id,
              },
            },
          },
        ]);
        expectObjectInArrayToMatch(uow.notificationRepository.notifications, [
          {
            kind: "sms",
            followedIds: {
              conventionId: convention.id,
              agencyId: convention.agencyId,
              establishmentSiret: convention.siret,
              userId: connectedBeneficiaryUser.id,
            },
            templatedContent: {
              recipientPhone: convention.establishmentTutor.phone,
              kind: "ReminderForAssessment",
              params: {
                shortLink: makeShortLinkUrl(config, shortLinkId),
              },
            },
          },
        ]);
      });

      it("When backoffice admin triggers it", async () => {
        uow.agencyRepository.agencies = [toAgencyWithRights(agency, {})];

        await usecase.execute(
          {
            conventionId: convention.id,
            notificationKind: "sms",
          },
          { userId: backofficeAdmin.id },
        );

        expectObjectInArrayToMatch(uow.outboxRepository.events, [
          { topic: "NotificationAdded" },
          { topic: "AssessmentReminderManuallySent" },
        ]);
        expectObjectInArrayToMatch(uow.notificationRepository.notifications, [
          {
            kind: "sms",
            followedIds: {
              conventionId: convention.id,
              agencyId: convention.agencyId,
              establishmentSiret: convention.siret,
              userId: backofficeAdmin.id,
            },
            templatedContent: {
              recipientPhone: convention.establishmentTutor.phone,
              kind: "ReminderForAssessment",
              params: {
                shortLink: makeShortLinkUrl(config, shortLinkId),
              },
            },
          },
        ]);
      });

      it(`send signature link if last signature link was sent more than ${CONVENTION_MANUAL_REMINDER_COOLDOWN_IN_HOURS} hours ago`, async () => {
        const pastSmsNotification: Notification = {
          id: "past-notification-id",
          createdAt: subDays(timeGateway.now(), 2).toISOString(),
          kind: "sms",
          followedIds: {
            conventionId: convention.id,
            agencyId: convention.agencyId,
            establishmentSiret: convention.siret,
            userId: connectedUser.id,
          },
          templatedContent: {
            recipientPhone: convention.establishmentTutor.phone,
            kind: "ReminderForAssessment",
            params: {
              shortLink: makeShortLinkUrl(config, shortLinkId),
            },
          },
        };

        uow.agencyRepository.agencies = [
          toAgencyWithRights(agency, {
            [connectedUser.id]: {
              roles: ["validator"],
              isNotifiedByEmail: false,
            },
          }),
        ];
        uow.notificationRepository.notifications = [pastSmsNotification];

        await usecase.execute(
          {
            conventionId: convention.id,
            notificationKind: "sms",
          },
          { userId: connectedUser.id },
        );

        expectObjectInArrayToMatch(uow.outboxRepository.events, [
          { topic: "NotificationAdded" },
          { topic: "AssessmentReminderManuallySent" },
        ]);
        expectObjectInArrayToMatch(uow.notificationRepository.notifications, [
          pastSmsNotification,
          {
            kind: "sms",
            followedIds: {
              conventionId: convention.id,
              agencyId: convention.agencyId,
              establishmentSiret: convention.siret,
              userId: connectedUser.id,
            },
            templatedContent: {
              recipientPhone: convention.establishmentTutor.phone,
              kind: "ReminderForAssessment",
              params: {
                shortLink: makeShortLinkUrl(config, shortLinkId),
              },
            },
          },
        ]);
      });

      it("sends assessment link by email", async () => {
        uow.agencyRepository.agencies = [
          toAgencyWithRights(agency, {
            [connectedUser.id]: {
              roles: ["validator"],
              isNotifiedByEmail: false,
            },
          }),
        ];

        await usecase.execute(
          {
            conventionId: convention.id,
            notificationKind: "email",
          },
          { userId: connectedUser.id },
        );

        expectObjectInArrayToMatch(uow.outboxRepository.events, [
          { topic: "NotificationAdded" },
          {
            topic: "AssessmentReminderManuallySent",
            payload: {
              convention,
              transport: "email",
              triggeredBy: {
                kind: "connected-user",
                userId: connectedUser.id,
              },
            },
          },
        ]);
        expectObjectInArrayToMatch(uow.notificationRepository.notifications, [
          {
            kind: "email",
            followedIds: {
              conventionId: convention.id,
              agencyId: convention.agencyId,
              establishmentSiret: convention.siret,
            },
            templatedContent: {
              kind: "ASSESSMENT_ESTABLISHMENT_NOTIFICATION",
              recipients: [convention.establishmentTutor.email],
              params: {
                agencyLogoUrl: undefined,
                beneficiaryFirstName:
                  convention.signatories.beneficiary.firstName,
                beneficiaryLastName: "OCON",
                conventionId: convention.id,
                establishmentTutorName: "Robert THÉNARDIER",
                assessmentCreationLink: makeShortLinkUrl(config, shortLinkId),
                internshipKind: convention.internshipKind,
              },
            },
          },
        ]);
        expectToEqual(uow.shortLinkQuery.getShortLinks().length, 1);
      });
    });

    describe("from magiclink", () => {
      it.each(["validator", "counsellor"] as const)(
        "When not connected agency user %s triggers it",
        async (role) => {
          const agencyWithEmails = toAgencyWithRights(
            new AgencyDtoBuilder().withId(convention.agencyId).build(),
            {
              [notConnectedUser.id]: {
                roles: [role],
                isNotifiedByEmail: true,
              },
            },
          );

          uow.agencyRepository.agencies = [agencyWithEmails];

          await usecase.execute(
            {
              conventionId: convention.id,
              notificationKind: "sms",
            },
            role === "validator" ? validatorJwtPayload : counsellorJwtPayload,
          );

          expectObjectInArrayToMatch(uow.outboxRepository.events, [
            { topic: "NotificationAdded" },
            {
              topic: "AssessmentReminderManuallySent",
              payload: {
                convention,
                transport: "sms",
                triggeredBy: {
                  kind: "convention-magic-link",
                  role,
                },
              },
            },
          ]);
          expectObjectInArrayToMatch(uow.notificationRepository.notifications, [
            {
              kind: "sms",
              followedIds: {
                conventionId: convention.id,
                agencyId: convention.agencyId,
                establishmentSiret: convention.siret,
                userId: undefined,
              },
              templatedContent: {
                recipientPhone: convention.establishmentTutor.phone,
                kind: "ReminderForAssessment",
                params: {
                  shortLink: makeShortLinkUrl(config, shortLinkId),
                },
              },
            },
          ]);
        },
      );

      it.each([
        "beneficiary",
        "beneficiary-representative",
        "beneficiary-current-employer",
        "establishment-representative",
      ] as SignatoryRole[])(
        "When not connected signatory %s triggers it",
        async (role) => {
          const signatoryEmail = `${role}@mail.com`;
          const signatoryJwtPayload = createConventionMagicLinkPayload({
            id: convention.id,
            role: role,
            email: signatoryEmail,
            now: new Date(),
          });

          uow.agencyRepository.agencies = [toAgencyWithRights(agency, {})];

          await usecase.execute(
            {
              conventionId: convention.id,
              notificationKind: "sms",
            },
            signatoryJwtPayload,
          );

          expectObjectInArrayToMatch(uow.outboxRepository.events, [
            { topic: "NotificationAdded" },
            {
              topic: "AssessmentReminderManuallySent",
              payload: {
                convention,
                transport: "sms",
                triggeredBy: {
                  kind: "convention-magic-link",
                  role,
                },
              },
            },
          ]);
          expectObjectInArrayToMatch(uow.notificationRepository.notifications, [
            {
              kind: "sms",
              followedIds: {
                conventionId: convention.id,
                agencyId: convention.agencyId,
                establishmentSiret: convention.siret,
                userId: undefined,
              },
              templatedContent: {
                recipientPhone: convention.establishmentTutor.phone,
                kind: "ReminderForAssessment",
                params: {
                  shortLink: makeShortLinkUrl(config, shortLinkId),
                },
              },
            },
          ]);
        },
      );

      it.each([
        "+33611111111", // métropole
        "+33785689727", // métropole
        "+262639000001", // Mayotte
        "+590690000001", // Guadeloupe
        "+590691282545", // Guadeloupe
        "+594694000001", // Guyane
        "+596696000001", // Martinique
        "+262692000001", // Réunion
        "+262693000001", // Réunion
        "+68987770076", // polynesie française
        "+687751234", // nouvelle calédonie
        "+681821234", // wallis et futuna
        "+508551234", // saint pierre et miquelon
      ])("for phone number %s", async (phoneNumber) => {
        const conventionWithCustomPhoneNumer = new ConventionDtoBuilder(
          convention,
        )
          .withBeneficiaryPhone(phoneNumber)
          .build();

        const agencyWithValidatorEmails = toAgencyWithRights(agency, {
          [notConnectedUser.id]: {
            roles: ["validator"],
            isNotifiedByEmail: true,
          },
        });

        uow.conventionRepository.setConventions([
          conventionWithCustomPhoneNumer,
        ]);
        uow.agencyRepository.agencies = [agencyWithValidatorEmails];

        await usecase.execute(
          {
            conventionId: conventionWithCustomPhoneNumer.id,
            notificationKind: "sms",
          },
          validatorJwtPayload,
        );

        expectObjectInArrayToMatch(uow.outboxRepository.events, [
          { topic: "NotificationAdded" },
          { topic: "AssessmentReminderManuallySent" },
        ]);
        expectObjectInArrayToMatch(uow.notificationRepository.notifications, [
          {
            kind: "sms",
            followedIds: {
              conventionId: conventionWithCustomPhoneNumer.id,
              agencyId: conventionWithCustomPhoneNumer.agencyId,
              establishmentSiret: conventionWithCustomPhoneNumer.siret,
              userId: undefined,
            },
            templatedContent: {
              recipientPhone:
                conventionWithCustomPhoneNumer.establishmentTutor.phone,
              kind: "ReminderForAssessment",
              params: {
                shortLink: makeShortLinkUrl(config, shortLinkId),
              },
            },
          },
        ]);
      });

      it("throws bad request when tutor phone is default phone number", async () => {
        const conventionWithDefaultTutorPhone = new ConventionDtoBuilder(
          convention,
        )
          .withEstablishmentTutor({
            ...convention.establishmentTutor,
            phone: defaultPhoneNumber,
          })
          .build();

        uow.conventionRepository.setConventions([
          conventionWithDefaultTutorPhone,
        ]);
        uow.agencyRepository.agencies = [
          toAgencyWithRights(agency, {
            [notConnectedUser.id]: {
              roles: ["validator"],
              isNotifiedByEmail: true,
            },
          }),
        ];

        await expectPromiseToFailWithError(
          usecase.execute(
            {
              conventionId: conventionWithDefaultTutorPhone.id,
              notificationKind: "sms",
            },
            validatorJwtPayload,
          ),
          errors.convention.invalidMobilePhoneNumber({
            conventionId: conventionWithDefaultTutorPhone.id,
            role: "establishment-tutor",
          }),
        );
      });
    });
  });
});
