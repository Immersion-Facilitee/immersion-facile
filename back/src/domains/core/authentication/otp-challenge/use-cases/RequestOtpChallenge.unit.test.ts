import {
  type ConventionDto,
  ConventionDtoBuilder,
  currentJwtVersions,
  errors,
  expectPromiseToFailWithError,
  expectToEqual,
  immersionFacileNoReplyEmailSender,
  OtpChallengeDtoBuilder,
  type VisitorOtpJwtPayload,
} from "shared";
import { makeEmailHash } from "../../../../../utils/jwt";
import {
  type ExpectSavedNotificationsAndEvents,
  makeExpectSavedNotificationsAndEvents,
} from "../../../../../utils/makeExpectSavedNotificationAndEvent.helpers";
import { makeSaveNotificationAndRelatedEvent } from "../../../notifications/helpers/Notification";
import { CustomTimeGateway } from "../../../time-gateway/adapters/CustomTimeGateway";
import {
  createInMemoryUow,
  type InMemoryUnitOfWork,
} from "../../../unit-of-work/adapters/createInMemoryUow";
import { InMemoryUowPerformer } from "../../../unit-of-work/adapters/InMemoryUowPerformer";
import { TestUuidGenerator } from "../../../uuid-generator/adapters/UuidGeneratorImplementations";
import { makeHashOtpCode } from "../adapters/hashOtpCode";
import { DeterministicOtpCodeGeneratorGateway } from "../adapters/otp-code-generator-gateway/DeterministicOtpCodeGeneratorGateway";
import {
  makeRequestOtpChallenge,
  type RequestOtpChallenge,
} from "./RequestOtpChallenge";

describe("RequestOtpChallenge", () => {
  const hashOtpCode = makeHashOtpCode("test-otp-code-hmac-secret");

  let uow: InMemoryUnitOfWork;
  let requestOtpChallenge: RequestOtpChallenge;
  let expectSavedNotificationsAndEvents: ExpectSavedNotificationsAndEvents;
  let uuidGenerator: TestUuidGenerator;
  let timeGateway: CustomTimeGateway;
  let otpCodeGeneratorGateway: DeterministicOtpCodeGeneratorGateway;

  beforeEach(() => {
    uow = createInMemoryUow();
    uuidGenerator = new TestUuidGenerator();
    timeGateway = new CustomTimeGateway();
    otpCodeGeneratorGateway = new DeterministicOtpCodeGeneratorGateway();

    requestOtpChallenge = makeRequestOtpChallenge({
      uowPerformer: new InMemoryUowPerformer(uow),
      deps: {
        hashOtpCode,
        otpCodeGeneratorGateway,
        saveNotificationAndRelatedEvent: makeSaveNotificationAndRelatedEvent(
          uuidGenerator,
          timeGateway,
        ),
        timeGateway,
        uuidGenerator,
      },
    });
    expectSavedNotificationsAndEvents = makeExpectSavedNotificationsAndEvents(
      uow.notificationRepository,
      uow.outboxRepository,
    );
  });

  describe("manageConvention", () => {
    const visitorOtpJwtPayload: VisitorOtpJwtPayload = {
      purpose: "manageConvention",
      subject: {
        conventionId: "someConventionId",
        role: "beneficiary",
        emailHash: "someEmailHash",
      },
      version: currentJwtVersions.visitorOtp,
      iat: Date.now(),
      exp: Date.now() + 60 * 60,
    };

    describe("Wrong path", () => {
      it("should throw if the convention does not exist", async () => {
        const visitorOtpJwtPayloadWithNonExistingConvention: VisitorOtpJwtPayload =
          {
            ...visitorOtpJwtPayload,
            subject: {
              ...visitorOtpJwtPayload.subject,
              conventionId: "nonExistingConventionId",
            },
          };

        await expectPromiseToFailWithError(
          requestOtpChallenge.execute(
            { channel: "email" },
            visitorOtpJwtPayloadWithNonExistingConvention,
          ),
          errors.convention.notFound({
            conventionId:
              visitorOtpJwtPayloadWithNonExistingConvention.subject
                .conventionId,
          }),
        );
      });

      it.each([
        { role: "beneficiary-current-employer" as const },
        { role: "beneficiary-representative" as const },
      ])(
        "should throw if the role $role is not present in the convention",
        async ({ role }) => {
          const conventionWithoutOptionalSignatories: ConventionDto =
            new ConventionDtoBuilder().build();

          uow.conventionRepository.setConventions([
            conventionWithoutOptionalSignatories,
          ]);

          const visitorOtpJwtPayloadWithMissingRole: VisitorOtpJwtPayload = {
            ...visitorOtpJwtPayload,
            subject: {
              conventionId: conventionWithoutOptionalSignatories.id,
              role,
              emailHash: "someEmailHash",
            },
          };

          await expectPromiseToFailWithError(
            requestOtpChallenge.execute(
              { channel: "email" },
              visitorOtpJwtPayloadWithMissingRole,
            ),
            errors.convention.missingActor({
              conventionId: conventionWithoutOptionalSignatories.id,
              role,
            }),
          );
        },
      );

      it("should throw if the emailHash does not match the mail with the given role in the convention", async () => {
        const convention: ConventionDto = new ConventionDtoBuilder().build();

        uow.conventionRepository.setConventions([convention]);

        const visitorOtpJwtPayloadWithOtherActorEmailHash: VisitorOtpJwtPayload =
          {
            ...visitorOtpJwtPayload,
            subject: {
              conventionId: convention.id,
              role: "beneficiary",
              emailHash: makeEmailHash(
                convention.signatories.establishmentRepresentative.email,
              ),
            },
          };

        await expectPromiseToFailWithError(
          requestOtpChallenge.execute(
            { channel: "email" },
            visitorOtpJwtPayloadWithOtherActorEmailHash,
          ),
          errors.convention.forbiddenMissingRightsEmailHash({
            conventionId: convention.id,
            role: "beneficiary",
            emailHash: makeEmailHash(
              convention.signatories.establishmentRepresentative.email,
            ),
          }),
        );
      });

      it("should throw and not create otp challenge if sms is requested for a non mobile phone", async () => {
        const conventionWithLandlinePhone: ConventionDto =
          new ConventionDtoBuilder()
            .withBeneficiaryPhone("+33123456780")
            .build();

        uow.conventionRepository.setConventions([conventionWithLandlinePhone]);
        uuidGenerator.setNextUuids(["otp-challenge-id"]);
        otpCodeGeneratorGateway.setNextOtpCodes(["123456"]);

        await expectPromiseToFailWithError(
          requestOtpChallenge.execute(
            { channel: "sms" },
            {
              ...visitorOtpJwtPayload,
              subject: {
                conventionId: conventionWithLandlinePhone.id,
                role: "beneficiary",
                emailHash: makeEmailHash(
                  conventionWithLandlinePhone.signatories.beneficiary.email,
                ),
              },
            },
          ),
          errors.convention.invalidMobilePhoneNumber({
            conventionId: conventionWithLandlinePhone.id,
            role: "beneficiary",
          }),
        );

        expectToEqual(uow.otpChallengeRepository.otpChallenges, []);
        expectSavedNotificationsAndEvents({ emails: [], sms: [] });
      });

      it("should throw and not create otp challenge if an otp challenge was requested too recently for the same subject", async () => {
        const convention: ConventionDto = new ConventionDtoBuilder().build();
        const subject: VisitorOtpJwtPayload["subject"] = {
          conventionId: convention.id,
          role: "beneficiary",
          emailHash: makeEmailHash(convention.signatories.beneficiary.email),
        };
        const otpChallengeRequestedThirtySecondsAgo =
          new OtpChallengeDtoBuilder()
            .withId("recent-otp-challenge-id")
            .withSubject(subject)
            .withRecipient(convention.signatories.beneficiary.email)
            .withCreatedAt("2026-11-02T09:59:30.000Z")
            .withExpiresAt("2026-11-02T10:29:30.000Z")
            .build();

        uow.conventionRepository.setConventions([convention]);
        uow.otpChallengeRepository.otpChallenges = [
          otpChallengeRequestedThirtySecondsAgo,
        ];

        timeGateway.defaultDate = new Date("2026-11-02T10:00:00.000Z");
        uuidGenerator.setNextUuids(["otp-challenge-id"]);
        otpCodeGeneratorGateway.setNextOtpCodes(["123456"]);

        await expectPromiseToFailWithError(
          requestOtpChallenge.execute(
            { channel: "email" },
            {
              ...visitorOtpJwtPayload,
              subject,
            },
          ),
          errors.otpChallenge.requestedTooRecently({
            minSecondsBetweenRequests: 60,
          }),
        );

        expectToEqual(uow.otpChallengeRepository.otpChallenges, [
          otpChallengeRequestedThirtySecondsAgo,
        ]);
        expectSavedNotificationsAndEvents({ emails: [], sms: [] });
      });

      it("should throw and not create otp challenge if the maximum number of otp challenges over the period is reached for the same subject", async () => {
        const convention: ConventionDto = new ConventionDtoBuilder().build();
        const subject: VisitorOtpJwtPayload["subject"] = {
          conventionId: convention.id,
          role: "beneficiary",
          emailHash: makeEmailHash(convention.signatories.beneficiary.email),
        };
        const otpChallengesRequestedWithinLastHour = [
          "2026-11-02T09:05:00.000Z",
          "2026-11-02T09:15:00.000Z",
          "2026-11-02T09:25:00.000Z",
          "2026-11-02T09:35:00.000Z",
          "2026-11-02T09:45:00.000Z",
        ].map((createdAt, index) =>
          new OtpChallengeDtoBuilder()
            .withId(`previous-otp-challenge-id-${index}`)
            .withSubject(subject)
            .withRecipient(convention.signatories.beneficiary.email)
            .withCreatedAt(createdAt)
            .withExpiresAt(createdAt)
            .build(),
        );

        uow.conventionRepository.setConventions([convention]);
        uow.otpChallengeRepository.otpChallenges =
          otpChallengesRequestedWithinLastHour;
        timeGateway.defaultDate = new Date("2026-11-02T10:00:00.000Z");
        uuidGenerator.setNextUuids(["otp-challenge-id"]);
        otpCodeGeneratorGateway.setNextOtpCodes(["123456"]);

        await expectPromiseToFailWithError(
          requestOtpChallenge.execute(
            { channel: "email" },
            {
              ...visitorOtpJwtPayload,
              subject,
            },
          ),
          errors.otpChallenge.tooManyRequests({
            maxRequests: 5,
            periodInMinutes: 60,
          }),
        );

        expectToEqual(
          uow.otpChallengeRepository.otpChallenges,
          otpChallengesRequestedWithinLastHour,
        );
        expectSavedNotificationsAndEvents({ emails: [], sms: [] });
      });
    });

    describe("Right path", () => {
      const now = new Date("2026-11-02T10:00:00.000Z");
      const otpChallengeId = "otp-challenge-id";
      const otpCode = "123456";

      const convention: ConventionDto = new ConventionDtoBuilder()
        .withBeneficiaryEmail("beneficiary@email.fr")
        .withBeneficiaryPhone("+33612345678")
        .withEstablishmentRepresentativeEmail("patron@email.com")
        .withEstablishmentRepresentativePhone("+33623456789")
        .withEstablishmentTutorEmail("tuteur@email.com")
        .withEstablishmentTutorPhone("+33634567891")
        .withBeneficiaryRepresentative({
          role: "beneficiary-representative",
          email: "parent@email.com",
          phone: "+33645678912",
          firstName: "Bob",
          lastName: "L'éponge",
        })
        .withBeneficiaryCurrentEmployer({
          role: "beneficiary-current-employer",
          email: "employeur@email.com",
          phone: "+33656789123",
          firstName: "Jean",
          lastName: "Employeur",
          job: "Boss",
          businessSiret: "01234567891234",
          businessName: "business",
          businessAddress: "Rue des Bouchers 67065 Strasbourg",
        })
        .build();

      const recipientsByRole = [
        {
          role: "beneficiary" as const,
          email: "beneficiary@email.fr",
          phone: "+33612345678",
        },
        {
          role: "establishment-representative" as const,
          email: "patron@email.com",
          phone: "+33623456789",
        },
        {
          role: "establishment-tutor" as const,
          email: "tuteur@email.com",
          phone: "+33634567891",
        },
        {
          role: "beneficiary-representative" as const,
          email: "parent@email.com",
          phone: "+33645678912",
        },
        {
          role: "beneficiary-current-employer" as const,
          email: "employeur@email.com",
          phone: "+33656789123",
        },
      ];

      it.each(recipientsByRole)(
        "should create otp challenge and send email with otp code to $role",
        async ({ role, email }) => {
          uow.conventionRepository.setConventions([convention]);
          timeGateway.defaultDate = now;
          uuidGenerator.setNextUuids([otpChallengeId]);
          otpCodeGeneratorGateway.setNextOtpCodes([otpCode]);

          const validVisitorOtpJwtPayload: VisitorOtpJwtPayload = {
            ...visitorOtpJwtPayload,
            subject: {
              role,
              conventionId: convention.id,
              emailHash: makeEmailHash(email),
            },
          };

          await requestOtpChallenge.execute(
            { channel: "email" },
            validVisitorOtpJwtPayload,
          );

          expectToEqual(uow.otpChallengeRepository.otpChallenges, [
            {
              id: otpChallengeId,
              purpose: "manageConvention",
              subject: validVisitorOtpJwtPayload.subject,
              channel: "email",
              recipient: email,
              codeHash: hashOtpCode({ otpChallengeId, otpCode }),
              attempts: 0,
              expiresAt: "2026-11-02T10:30:00.000Z",
              usedAt: null,
              revokedAt: null,
              createdAt: now.toISOString(),
            },
          ]);

          expectSavedNotificationsAndEvents({
            emails: [
              {
                kind: "REQUEST_OTP_CODE",
                params: { otpCode },
                recipients: [email],
                sender: immersionFacileNoReplyEmailSender,
              },
            ],
            sms: [],
            priority: 1,
          });

          expectToEqual(
            uow.notificationRepository.notifications.map(
              ({ followedIds }) => followedIds,
            ),
            [
              {
                conventionId: convention.id,
                agencyId: convention.agencyId,
                establishmentSiret: convention.siret,
              },
            ],
          );
        },
      );

      it.each(recipientsByRole)(
        "should create otp challenge and send sms with otp code to $role",
        async ({ role, email, phone }) => {
          uow.conventionRepository.setConventions([convention]);
          timeGateway.defaultDate = now;
          uuidGenerator.setNextUuids([otpChallengeId]);
          otpCodeGeneratorGateway.setNextOtpCodes([otpCode]);

          const validVisitorOtpJwtPayload: VisitorOtpJwtPayload = {
            ...visitorOtpJwtPayload,
            subject: {
              role,
              conventionId: convention.id,
              emailHash: makeEmailHash(email),
            },
          };

          await requestOtpChallenge.execute(
            { channel: "sms" },
            validVisitorOtpJwtPayload,
          );

          expectToEqual(uow.otpChallengeRepository.otpChallenges, [
            {
              id: otpChallengeId,
              purpose: "manageConvention",
              subject: validVisitorOtpJwtPayload.subject,
              channel: "sms",
              recipient: phone,
              codeHash: hashOtpCode({ otpChallengeId, otpCode }),
              attempts: 0,
              expiresAt: "2026-11-02T10:30:00.000Z",
              usedAt: null,
              revokedAt: null,
              createdAt: now.toISOString(),
            },
          ]);

          expectSavedNotificationsAndEvents({
            emails: [],
            sms: [
              {
                kind: "RequestOtpCode",
                params: { otpCode },
                recipientPhone: phone,
              },
            ],
            priority: 1,
          });

          expectToEqual(
            uow.notificationRepository.notifications.map(
              ({ followedIds }) => followedIds,
            ),
            [
              {
                conventionId: convention.id,
                agencyId: convention.agencyId,
                establishmentSiret: convention.siret,
              },
            ],
          );
        },
      );

      it("should create otp challenge when the maximum number of otp challenges was reached before the period", async () => {
        const subject: VisitorOtpJwtPayload["subject"] = {
          conventionId: convention.id,
          role: "beneficiary",
          emailHash: makeEmailHash("beneficiary@email.fr"),
        };
        const otpChallengesRequestedMoreThanOneHourAgo = [
          "2026-11-02T08:10:00.000Z",
          "2026-11-02T08:20:00.000Z",
          "2026-11-02T08:30:00.000Z",
          "2026-11-02T08:40:00.000Z",
          "2026-11-02T08:50:00.000Z",
        ].map((createdAt, index) =>
          new OtpChallengeDtoBuilder()
            .withId(`previous-otp-challenge-id-${index}`)
            .withSubject(subject)
            .withRecipient("beneficiary@email.fr")
            .withCreatedAt(createdAt)
            .withExpiresAt(createdAt)
            .build(),
        );

        uow.conventionRepository.setConventions([convention]);
        uow.otpChallengeRepository.otpChallenges =
          otpChallengesRequestedMoreThanOneHourAgo;
        timeGateway.defaultDate = now;
        uuidGenerator.setNextUuids([otpChallengeId]);
        otpCodeGeneratorGateway.setNextOtpCodes([otpCode]);

        await requestOtpChallenge.execute(
          { channel: "email" },
          {
            ...visitorOtpJwtPayload,
            subject,
          },
        );

        expectToEqual(uow.otpChallengeRepository.otpChallenges, [
          ...otpChallengesRequestedMoreThanOneHourAgo.map((otpChallenge) => ({
            ...otpChallenge,
            revokedAt: now.toISOString(),
          })),
          {
            id: otpChallengeId,
            purpose: "manageConvention",
            subject,
            channel: "email",
            recipient: "beneficiary@email.fr",
            codeHash: hashOtpCode({ otpChallengeId, otpCode }),
            attempts: 0,
            expiresAt: "2026-11-02T10:30:00.000Z",
            usedAt: null,
            revokedAt: null,
            createdAt: now.toISOString(),
          },
        ]);
      });

      it("should revoke the previous active otp challenge of the same subject when a new one is requested", async () => {
        const subject: VisitorOtpJwtPayload["subject"] = {
          conventionId: convention.id,
          role: "beneficiary",
          emailHash: makeEmailHash("beneficiary@email.fr"),
        };
        const previousActiveOtpChallenge = new OtpChallengeDtoBuilder()
          .withId("previous-otp-challenge-id")
          .withSubject(subject)
          .withRecipient("beneficiary@email.fr")
          .withCreatedAt("2026-11-02T09:50:00.000Z")
          .withExpiresAt("2026-11-02T10:20:00.000Z")
          .build();
        const otherSubjectActiveOtpChallenge = new OtpChallengeDtoBuilder()
          .withId("other-subject-otp-challenge-id")
          .withSubject({
            conventionId: convention.id,
            role: "establishment-tutor",
            emailHash: makeEmailHash("tuteur@email.com"),
          })
          .withRecipient("tuteur@email.com")
          .withCreatedAt("2026-11-02T09:50:00.000Z")
          .withExpiresAt("2026-11-02T10:20:00.000Z")
          .build();

        uow.conventionRepository.setConventions([convention]);
        uow.otpChallengeRepository.otpChallenges = [
          previousActiveOtpChallenge,
          otherSubjectActiveOtpChallenge,
        ];
        timeGateway.defaultDate = now;
        uuidGenerator.setNextUuids([otpChallengeId]);
        otpCodeGeneratorGateway.setNextOtpCodes([otpCode]);

        await requestOtpChallenge.execute(
          { channel: "email" },
          {
            ...visitorOtpJwtPayload,
            subject,
          },
        );

        expectToEqual(uow.otpChallengeRepository.otpChallenges, [
          { ...previousActiveOtpChallenge, revokedAt: now.toISOString() },
          otherSubjectActiveOtpChallenge,
          {
            id: otpChallengeId,
            purpose: "manageConvention",
            subject,
            channel: "email",
            recipient: "beneficiary@email.fr",
            codeHash: hashOtpCode({ otpChallengeId, otpCode }),
            attempts: 0,
            expiresAt: "2026-11-02T10:30:00.000Z",
            usedAt: null,
            revokedAt: null,
            createdAt: now.toISOString(),
          },
        ]);
      });

      it("should revoke expired otp challenges not yet revoked and keep used or already revoked ones of the same subject", async () => {
        const subject: VisitorOtpJwtPayload["subject"] = {
          conventionId: convention.id,
          role: "beneficiary",
          emailHash: makeEmailHash("beneficiary@email.fr"),
        };
        const usedOtpChallenge = new OtpChallengeDtoBuilder()
          .withId("used-otp-challenge-id")
          .withSubject(subject)
          .withRecipient("beneficiary@email.fr")
          .withCreatedAt("2026-11-02T09:20:00.000Z")
          .withExpiresAt("2026-11-02T09:50:00.000Z")
          .withUsedAt("2026-11-02T09:25:00.000Z")
          .build();
        const expiredOtpChallenge = new OtpChallengeDtoBuilder()
          .withId("expired-otp-challenge-id")
          .withSubject(subject)
          .withRecipient("beneficiary@email.fr")
          .withCreatedAt("2026-11-02T09:30:00.000Z")
          .withExpiresAt("2026-11-02T09:50:00.000Z")
          .build();
        const alreadyRevokedOtpChallenge = new OtpChallengeDtoBuilder()
          .withId("already-revoked-otp-challenge-id")
          .withSubject(subject)
          .withRecipient("beneficiary@email.fr")
          .withCreatedAt("2026-11-02T09:40:00.000Z")
          .withExpiresAt("2026-11-02T10:10:00.000Z")
          .withRevokedAt("2026-11-02T09:45:00.000Z")
          .build();

        uow.conventionRepository.setConventions([convention]);
        uow.otpChallengeRepository.otpChallenges = [
          usedOtpChallenge,
          expiredOtpChallenge,
          alreadyRevokedOtpChallenge,
        ];
        timeGateway.defaultDate = now;
        uuidGenerator.setNextUuids([otpChallengeId]);
        otpCodeGeneratorGateway.setNextOtpCodes([otpCode]);

        await requestOtpChallenge.execute(
          { channel: "email" },
          {
            ...visitorOtpJwtPayload,
            subject,
          },
        );

        expectToEqual(uow.otpChallengeRepository.otpChallenges, [
          usedOtpChallenge,
          { ...expiredOtpChallenge, revokedAt: now.toISOString() },
          alreadyRevokedOtpChallenge,
          {
            id: otpChallengeId,
            purpose: "manageConvention",
            subject,
            channel: "email",
            recipient: "beneficiary@email.fr",
            codeHash: hashOtpCode({ otpChallengeId, otpCode }),
            attempts: 0,
            expiresAt: "2026-11-02T10:30:00.000Z",
            usedAt: null,
            revokedAt: null,
            createdAt: now.toISOString(),
          },
        ]);
      });
    });
  });
});
