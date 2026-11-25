import { addMinutes } from "date-fns";
import {
  ConventionDtoBuilder,
  type ConventionId,
  currentJwtVersions,
  displayRouteName,
  errors,
  expectHttpResponseToEqual,
  expectToEqual,
  expiredJwtErrorMessage,
  type GetOtpSessionQueryParams,
  immersionFacileNoReplyEmailSender,
  type OtpChallenge,
  OtpChallengeDtoBuilder,
  type OtpChallengeId,
  type OtpChallengeRoutes,
  OtpSessionDtoBuilder,
  otpChallengeRoutes,
} from "shared";
import type { HttpClient } from "shared-routes";
import { createSupertestSharedClient } from "shared-routes/supertest";
import type { SuperTest, Test } from "supertest";
import { invalidTokenMessage } from "../../../../config/bootstrap/connectedUserAuthMiddleware";
import type { DeterministicOtpCodeGeneratorGateway } from "../../../../domains/core/authentication/otp-challenge/adapters/otp-code-generator-gateway/DeterministicOtpCodeGeneratorGateway";
import {
  type HashOtpCode,
  makeHashOtpCode,
} from "../../../../domains/core/authentication/otp-challenge/entities/otpChallenge.helper";
import type {
  GenerateConventionJwt,
  GenerateOtpJwt,
} from "../../../../domains/core/jwt";
import type { CustomTimeGateway } from "../../../../domains/core/time-gateway/adapters/CustomTimeGateway";
import type { InMemoryUnitOfWork } from "../../../../domains/core/unit-of-work/adapters/createInMemoryUow";
import type { UuidGenerator } from "../../../../domains/core/uuid-generator/ports/UuidGenerator";
import { AppConfigBuilder } from "../../../../utils/AppConfigBuilder";
import { buildTestApp } from "../../../../utils/buildTestApp";
import {
  createConventionMagicLinkPayload,
  createOtpJwtPayload,
  makeEmailHash,
} from "../../../../utils/jwt";
import {
  type ExpectSavedNotificationsAndEvents,
  makeExpectSavedNotificationsAndEvents,
} from "../../../../utils/makeExpectSavedNotificationAndEvent.helpers";

describe("otp challenge router", () => {
  const convention = new ConventionDtoBuilder()
    .withBeneficiaryEmail("beneficiary@email.fr")
    .withBeneficiaryPhone("+33612345678")
    .build();

  const otpJwtPayload = createOtpJwtPayload({
    purpose: "manageConvention",
    subject: {
      conventionId: convention.id,
      role: "beneficiary",
      emailHash: makeEmailHash(convention.signatories.beneficiary.email),
    },
    now: new Date(),
  });

  let httpClient: HttpClient<OtpChallengeRoutes>;
  let request: SuperTest<Test>;
  let generateOtpJwt: GenerateOtpJwt;
  let generateConventionJwt: GenerateConventionJwt;
  let inMemoryUow: InMemoryUnitOfWork;
  let timeGateway: CustomTimeGateway;
  let otpCodeGeneratorGateway: DeterministicOtpCodeGeneratorGateway;
  let uuidGenerator: UuidGenerator;
  let hashOtpCode: HashOtpCode;
  let immersionFacileDomain: string;
  let expectSavedNotificationsAndEvents: ExpectSavedNotificationsAndEvents;

  beforeEach(async () => {
    const testApp = await buildTestApp();
    generateOtpJwt = testApp.generateOtpJwt;
    generateConventionJwt = testApp.generateConventionJwt;
    inMemoryUow = testApp.inMemoryUow;
    uuidGenerator = testApp.uuidGenerator;
    hashOtpCode = makeHashOtpCode(testApp.appConfig.otpCodeHmacSecret);
    immersionFacileDomain = testApp.appConfig.immersionFacileDomain;
    timeGateway = testApp.gateways.timeGateway;
    otpCodeGeneratorGateway = testApp.gateways.otpCodeGeneratorGateway;
    expectSavedNotificationsAndEvents = makeExpectSavedNotificationsAndEvents(
      inMemoryUow.notificationRepository,
      inMemoryUow.outboxRepository,
    );
    request = testApp.request;
    httpClient = createSupertestSharedClient(
      otpChallengeRoutes,
      testApp.request,
    );
    inMemoryUow.conventionRepository.setConventions([convention]);
  });

  describe(`${displayRouteName(otpChallengeRoutes.getMaskedOtpRecipient)}`, () => {
    it("200 - returns the masked email and phone of the convention actor", async () => {
      const response = await httpClient.getMaskedOtpRecipient({
        headers: { authorization: generateOtpJwt(otpJwtPayload) },
      });

      expectHttpResponseToEqual(response, {
        status: 200,
        body: {
          maskedEmail: "b*********y@email.fr",
          maskedPhone: "06******78",
        },
      });
    });

    it("401 - invalid JWT", async () => {
      const response = await httpClient.getMaskedOtpRecipient({
        headers: { authorization: "invalid-jwt" },
      });

      expectHttpResponseToEqual(response, {
        status: 401,
        body: { status: 401, message: invalidTokenMessage },
      });
    });

    it("401 - JWT without expiration", async () => {
      const response = await httpClient.getMaskedOtpRecipient({
        headers: {
          authorization: generateOtpJwt({
            purpose: "manageConvention",
            subject: otpJwtPayload.subject,
            version: currentJwtVersions.otp,
            iat: otpJwtPayload.iat,
          }),
        },
      });

      expectHttpResponseToEqual(response, {
        status: 401,
        body: { status: 401, message: invalidTokenMessage },
      });
    });

    it("403 - expired JWT needs a renewed link", async () => {
      const response = await httpClient.getMaskedOtpRecipient({
        headers: {
          authorization: generateOtpJwt(
            createOtpJwtPayload({
              purpose: "manageConvention",
              subject: otpJwtPayload.subject,
              now: new Date(),
              expOverride: Math.round(Date.now() / 1000) - 60,
            }),
          ),
        },
      });

      expectHttpResponseToEqual(response, {
        status: 403,
        body: { message: expiredJwtErrorMessage, needsNewMagicLink: true },
      });
    });

    it("403 - email hash does not match the actor in the convention", async () => {
      const emailHash = makeEmailHash(
        convention.signatories.establishmentRepresentative.email,
      );

      const response = await httpClient.getMaskedOtpRecipient({
        headers: {
          authorization: generateOtpJwt(
            createOtpJwtPayload({
              purpose: "manageConvention",
              subject: {
                conventionId: convention.id,
                role: "beneficiary",
                emailHash,
              },
              now: new Date(),
            }),
          ),
        },
      });

      expectHttpResponseToEqual(response, {
        status: 403,
        body: {
          status: 403,
          message: errors.convention.forbiddenMissingRightsEmailHash({
            conventionId: convention.id,
            role: "beneficiary",
            emailHash,
          }).message,
        },
      });
    });

    it("404 - convention not found", async () => {
      const unknownConventionId: ConventionId =
        "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

      const response = await httpClient.getMaskedOtpRecipient({
        headers: {
          authorization: generateOtpJwt(
            createOtpJwtPayload({
              purpose: "manageConvention",
              subject: {
                conventionId: unknownConventionId,
                role: "beneficiary",
                emailHash: makeEmailHash(
                  convention.signatories.beneficiary.email,
                ),
              },
              now: new Date(),
            }),
          ),
        },
      });

      expectHttpResponseToEqual(response, {
        status: 404,
        body: {
          status: 404,
          message: errors.convention.notFound({
            conventionId: unknownConventionId,
          }).message,
        },
      });
    });
  });

  describe(`${displayRouteName(otpChallengeRoutes.requestOtpChallenge)}`, () => {
    const now = new Date("2026-11-02T10:00:00.000Z");
    const otpCode = "1234";
    const otpChallengeId: OtpChallengeId =
      "11111111-1111-4111-a111-111111111111";

    beforeEach(() => {
      timeGateway.defaultDate = now;
      otpCodeGeneratorGateway.setNextOtpCodes([otpCode]);
      const uuids = [otpChallengeId];
      uuidGenerator.new = () => uuids.shift() ?? "no-uuid-provided";
    });

    it("201 - creates otp challenge and sends email with otp code", async () => {
      const response = await httpClient.requestOtpChallenge({
        body: { channel: "email" },
        headers: {
          authorization: generateOtpJwt(otpJwtPayload),
        },
      });

      expectHttpResponseToEqual(response, {
        status: 201,
        body: {},
      });
      expect(inMemoryUow.otpChallengeRepository.otpChallenges).toHaveLength(1);

      expectSavedNotificationsAndEvents({
        emails: [
          {
            kind: "REQUEST_OTP_CODE",
            params: { otpCode },
            recipients: [convention.signatories.beneficiary.email],
            sender: immersionFacileNoReplyEmailSender,
          },
        ],
        sms: [],
        priority: 1,
      });
    });

    it("201 - creates otp challenge and sends sms with otp code", async () => {
      const response = await httpClient.requestOtpChallenge({
        body: { channel: "sms" },
        headers: {
          authorization: generateOtpJwt(otpJwtPayload),
        },
      });

      expectHttpResponseToEqual(response, {
        status: 201,
        body: {},
      });
      expect(inMemoryUow.otpChallengeRepository.otpChallenges).toHaveLength(1);
      expectSavedNotificationsAndEvents({
        emails: [],
        sms: [
          {
            kind: "RequestOtpCode",
            params: { otpCode, domain: immersionFacileDomain },
            recipientPhone: convention.signatories.beneficiary.phone,
          },
        ],
        priority: 1,
      });
    });

    it("400 - sms requested for a non mobile phone", async () => {
      const conventionWithLandlinePhone = new ConventionDtoBuilder(convention)
        .withBeneficiaryPhone("+33123456780")
        .build();
      inMemoryUow.conventionRepository.setConventions([
        conventionWithLandlinePhone,
      ]);

      const response = await httpClient.requestOtpChallenge({
        body: { channel: "sms" },
        headers: {
          authorization: generateOtpJwt(otpJwtPayload),
        },
      });

      expectHttpResponseToEqual(response, {
        status: 400,
        body: {
          status: 400,
          message: errors.convention.invalidMobilePhoneNumber({
            conventionId: conventionWithLandlinePhone.id,
            role: "beneficiary",
          }).message,
        },
      });
      expectToEqual(inMemoryUow.otpChallengeRepository.otpChallenges, []);
      expectSavedNotificationsAndEvents({ emails: [], sms: [] });
    });

    it("401 - invalid JWT", async () => {
      const response = await httpClient.requestOtpChallenge({
        body: { channel: "email" },
        headers: { authorization: "invalid-jwt" },
      });

      expectHttpResponseToEqual(response, {
        status: 401,
        body: { status: 401, message: invalidTokenMessage },
      });
    });

    it("401 - convention magic link JWT instead of otp JWT", async () => {
      const response = await httpClient.requestOtpChallenge({
        body: { channel: "email" },
        headers: {
          authorization: generateConventionJwt(
            createConventionMagicLinkPayload({
              id: convention.id,
              role: "beneficiary",
              email: convention.signatories.beneficiary.email,
              now: new Date(),
            }),
          ),
        },
      });

      expectHttpResponseToEqual(response, {
        status: 401,
        body: { status: 401, message: invalidTokenMessage },
      });
      expectToEqual(inMemoryUow.otpChallengeRepository.otpChallenges, []);
      expectSavedNotificationsAndEvents({ emails: [], sms: [] });
    });

    it("403 - email hash does not match the actor in the convention", async () => {
      const emailHash = makeEmailHash(
        convention.signatories.establishmentRepresentative.email,
      );

      const response = await httpClient.requestOtpChallenge({
        body: { channel: "email" },
        headers: {
          authorization: generateOtpJwt(
            createOtpJwtPayload({
              purpose: "manageConvention",
              subject: {
                conventionId: convention.id,
                role: "beneficiary",
                emailHash,
              },
              now: new Date(),
            }),
          ),
        },
      });

      expectHttpResponseToEqual(response, {
        status: 403,
        body: {
          status: 403,
          message: errors.convention.forbiddenMissingRightsEmailHash({
            conventionId: convention.id,
            role: "beneficiary",
            emailHash,
          }).message,
        },
      });
    });

    it("404 - convention not found", async () => {
      const unknownConventionId: ConventionId =
        "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

      const response = await httpClient.requestOtpChallenge({
        body: { channel: "email" },
        headers: {
          authorization: generateOtpJwt(
            createOtpJwtPayload({
              purpose: "manageConvention",
              subject: {
                conventionId: unknownConventionId,
                role: "beneficiary",
                emailHash: makeEmailHash(
                  convention.signatories.beneficiary.email,
                ),
              },
              now: new Date(),
            }),
          ),
        },
      });

      expectHttpResponseToEqual(response, {
        status: 404,
        body: {
          status: 404,
          message: errors.convention.notFound({
            conventionId: unknownConventionId,
          }).message,
        },
      });
    });

    it("429 - otp challenge requested too recently", async () => {
      inMemoryUow.otpChallengeRepository.otpChallenges = [
        new OtpChallengeDtoBuilder()
          .withSubject(otpJwtPayload.subject)
          .withRecipient(convention.signatories.beneficiary.email)
          .withCreatedAt("2026-11-02T09:59:30.000Z")
          .withExpiresAt("2026-11-02T10:29:30.000Z")
          .build(),
      ];

      const response = await httpClient.requestOtpChallenge({
        body: { channel: "email" },
        headers: {
          authorization: generateOtpJwt(otpJwtPayload),
        },
      });

      expectHttpResponseToEqual(response, {
        status: 429,
        body: {
          status: 429,
          message: errors.otpChallenge.requestedTooRecently({
            minSecondsBetweenRequests: 60,
          }).message,
        },
      });
    });

    it("429 - too many otp challenges requested over the period", async () => {
      const otpChallengesRequestedWithinLastHour = [
        new OtpChallengeDtoBuilder()
          .withId("22222222-2222-4222-a222-222222222222")
          .withSubject(otpJwtPayload.subject)
          .withRecipient(convention.signatories.beneficiary.email)
          .withCreatedAt("2026-11-02T09:05:00.000Z")
          .withExpiresAt("2026-11-02T09:20:00.000Z")
          .withRevokedAt("2026-11-02T09:15:00.000Z")
          .build(),
        new OtpChallengeDtoBuilder()
          .withId("33333333-3333-4333-a333-333333333333")
          .withSubject(otpJwtPayload.subject)
          .withRecipient(convention.signatories.beneficiary.email)
          .withCreatedAt("2026-11-02T09:15:00.000Z")
          .withExpiresAt("2026-11-02T09:30:00.000Z")
          .withRevokedAt("2026-11-02T09:25:00.000Z")
          .build(),
        new OtpChallengeDtoBuilder()
          .withId("44444444-4444-4444-a444-444444444444")
          .withSubject(otpJwtPayload.subject)
          .withRecipient(convention.signatories.beneficiary.email)
          .withCreatedAt("2026-11-02T09:25:00.000Z")
          .withExpiresAt("2026-11-02T09:40:00.000Z")
          .withRevokedAt("2026-11-02T09:35:00.000Z")
          .build(),
        new OtpChallengeDtoBuilder()
          .withId("55555555-5555-4555-a555-555555555555")
          .withSubject(otpJwtPayload.subject)
          .withRecipient(convention.signatories.beneficiary.email)
          .withCreatedAt("2026-11-02T09:35:00.000Z")
          .withExpiresAt("2026-11-02T09:50:00.000Z")
          .withRevokedAt("2026-11-02T09:45:00.000Z")
          .build(),
        new OtpChallengeDtoBuilder()
          .withId("66666666-6666-4666-a666-666666666666")
          .withSubject(otpJwtPayload.subject)
          .withRecipient(convention.signatories.beneficiary.email)
          .withCreatedAt("2026-11-02T09:45:00.000Z")
          .withExpiresAt("2026-11-02T10:00:00.000Z")
          .build(),
      ];
      inMemoryUow.otpChallengeRepository.otpChallenges =
        otpChallengesRequestedWithinLastHour;

      const response = await httpClient.requestOtpChallenge({
        body: { channel: "email" },
        headers: {
          authorization: generateOtpJwt(otpJwtPayload),
        },
      });

      expectHttpResponseToEqual(response, {
        status: 429,
        body: {
          status: 429,
          message: errors.otpChallenge.tooManyRequests({
            maxRequests: 5,
            periodInMinutes: 60,
          }).message,
        },
      });
      expectToEqual(
        inMemoryUow.otpChallengeRepository.otpChallenges,
        otpChallengesRequestedWithinLastHour,
      );
      expectSavedNotificationsAndEvents({ emails: [], sms: [] });
    });
  });

  describe(`${displayRouteName(otpChallengeRoutes.verifyOtpChallenge)}`, () => {
    const now = new Date();
    const otpCode = "1234";
    const otpChallengeId: OtpChallengeId =
      "11111111-1111-4111-a111-111111111111";
    let otpChallenge: OtpChallenge;

    beforeEach(() => {
      otpChallenge = new OtpChallengeDtoBuilder()
        .withId(otpChallengeId)
        .withSubject(otpJwtPayload.subject)
        .withCodeHash(hashOtpCode({ otpChallengeId, otpCode }))
        .withCreatedAt(now.toISOString())
        .withExpiresAt(addMinutes(now, 30).toISOString())
        .build();
      timeGateway.defaultDate = now;
      inMemoryUow.otpChallengeRepository.otpChallenges = [otpChallenge];
    });

    it("200 - verifies otp code, creates otp session, sets cookie and returns the active session", async () => {
      const response = await httpClient.verifyOtpChallenge({
        body: { otpCode },
        headers: {
          authorization: generateOtpJwt(otpJwtPayload),
        },
      });

      const otpSession = inMemoryUow.otpSessionRepository.otpSessions[0];
      expectHttpResponseToEqual(response, {
        status: 200,
        body: {
          purpose: "manageConvention",
          conventionId: otpJwtPayload.subject.conventionId,
          role: otpJwtPayload.subject.role,
          expiresAt: otpSession.expiresAt,
        },
      });
      expectToEqual(response.headers["set-cookie"], [
        `if_otp_session=${otpSession.id}; Path=/; Expires=${new Date(otpSession.expiresAt).toUTCString()}; HttpOnly; SameSite=Lax`,
      ]);
    });

    it.each(["production", "staging"] as const)(
      "200 - sets a secure cookie in %s",
      async (envType) => {
        const testApp = await buildTestApp(
          new AppConfigBuilder({ ENV_TYPE: envType }).build(),
        );
        testApp.gateways.timeGateway.defaultDate = now;
        testApp.inMemoryUow.conventionRepository.setConventions([convention]);
        testApp.inMemoryUow.otpChallengeRepository.otpChallenges = [
          otpChallenge,
        ];

        const response = await createSupertestSharedClient(
          otpChallengeRoutes,
          testApp.request,
        ).verifyOtpChallenge({
          body: { otpCode },
          headers: {
            authorization: testApp.generateOtpJwt(otpJwtPayload),
          },
        });

        const otpSession =
          testApp.inMemoryUow.otpSessionRepository.otpSessions[0];
        expectHttpResponseToEqual(response, {
          status: 200,
          body: {
            purpose: "manageConvention",
            conventionId: otpJwtPayload.subject.conventionId,
            role: otpJwtPayload.subject.role,
            expiresAt: otpSession.expiresAt,
          },
        });
        expectToEqual(response.headers["set-cookie"], [
          `if_otp_session=${otpSession.id}; Path=/; Expires=${new Date(otpSession.expiresAt).toUTCString()}; HttpOnly; Secure; SameSite=Lax`,
        ]);
      },
    );

    it("200 - uses the same cookie for successive connections to different conventions", async () => {
      const firstResponse = await httpClient.verifyOtpChallenge({
        body: { otpCode },
        headers: {
          authorization: generateOtpJwt(otpJwtPayload),
        },
      });
      expect(firstResponse.status).toBe(200);
      const firstSession = inMemoryUow.otpSessionRepository.otpSessions[0];

      const otherConvention = new ConventionDtoBuilder(convention)
        .withId("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb")
        .build();
      const otherSubject = {
        ...otpJwtPayload.subject,
        conventionId: otherConvention.id,
      };
      inMemoryUow.conventionRepository.setConventions([
        convention,
        otherConvention,
      ]);
      inMemoryUow.otpChallengeRepository.otpChallenges = [
        new OtpChallengeDtoBuilder(otpChallenge)
          .withSubject(otherSubject)
          .build(),
      ];

      const secondResponse = await request
        .post(otpChallengeRoutes.verifyOtpChallenge.url)
        .set(
          "Authorization",
          generateOtpJwt({
            ...otpJwtPayload,
            subject: otherSubject,
          }),
        )
        .set("Cookie", `if_otp_session=${firstSession.id}`)
        .send({ otpCode });
      expect(secondResponse.status).toBe(200);
      const secondSession = inMemoryUow.otpSessionRepository.otpSessions.find(
        ({ subject }) => subject.conventionId === otherConvention.id,
      );
      if (!secondSession) throw new Error("Missing second otp session");
      expect(secondResponse.get("Set-Cookie")).toEqual([
        `if_otp_session=${secondSession.id}; Path=/; Expires=${new Date(secondSession.expiresAt).toUTCString()}; HttpOnly; SameSite=Lax`,
      ]);
      expect(firstResponse.headers["set-cookie"]).toEqual([
        `if_otp_session=${firstSession.id}; Path=/; Expires=${new Date(firstSession.expiresAt).toUTCString()}; HttpOnly; SameSite=Lax`,
      ]);

      for (const { conventionId, expectedStatus } of [
        { conventionId: otherConvention.id, expectedStatus: 200 },
        { conventionId: convention.id, expectedStatus: 401 },
      ]) {
        const response = await request
          .get(otpChallengeRoutes.getOtpSession.url)
          .query({ purpose: "manageConvention", conventionId })
          .set("Cookie", `if_otp_session=${secondSession.id}`);
        expect(response.status).toBe(expectedStatus);
      }
    });

    it("400 - invalid otp code does not set cookie", async () => {
      const response = await httpClient.verifyOtpChallenge({
        body: { otpCode: "0000" },
        headers: {
          authorization: generateOtpJwt(otpJwtPayload),
        },
      });

      expectHttpResponseToEqual(response, {
        status: 400,
        body: {
          status: 400,
          message: errors.otpChallenge.invalidCode().message,
        },
      });
      expectToEqual(response.headers["set-cookie"], undefined);
      expectToEqual(inMemoryUow.otpChallengeRepository.otpChallenges, [
        { ...otpChallenge, attempts: 1 },
      ]);
    });

    it("401 - invalid JWT", async () => {
      const response = await httpClient.verifyOtpChallenge({
        body: { otpCode },
        headers: { authorization: "invalid-jwt" },
      });

      expectHttpResponseToEqual(response, {
        status: 401,
        body: { status: 401, message: invalidTokenMessage },
      });
    });

    it("401 - convention magic link JWT instead of otp JWT", async () => {
      const response = await httpClient.verifyOtpChallenge({
        body: { otpCode },
        headers: {
          authorization: generateConventionJwt(
            createConventionMagicLinkPayload({
              id: convention.id,
              role: "beneficiary",
              email: convention.signatories.beneficiary.email,
              now: new Date(),
            }),
          ),
        },
      });

      expectHttpResponseToEqual(response, {
        status: 401,
        body: { status: 401, message: invalidTokenMessage },
      });
      expectToEqual(inMemoryUow.otpSessionRepository.otpSessions, []);
    });

    it("404 - no active otp challenge for the subject", async () => {
      inMemoryUow.otpChallengeRepository.otpChallenges = [
        new OtpChallengeDtoBuilder(otpChallenge)
          .withUsedAt(now.toISOString())
          .build(),
      ];

      const response = await httpClient.verifyOtpChallenge({
        body: { otpCode },
        headers: {
          authorization: generateOtpJwt(otpJwtPayload),
        },
      });

      expectHttpResponseToEqual(response, {
        status: 404,
        body: {
          status: 404,
          message: errors.otpChallenge.noActiveChallenge().message,
        },
      });
    });

    it("429 - too many attempts", async () => {
      inMemoryUow.otpChallengeRepository.otpChallenges = [
        new OtpChallengeDtoBuilder(otpChallenge).withAttempts(5).build(),
      ];

      const response = await httpClient.verifyOtpChallenge({
        body: { otpCode },
        headers: {
          authorization: generateOtpJwt(otpJwtPayload),
        },
      });

      expectHttpResponseToEqual(response, {
        status: 429,
        body: {
          status: 429,
          message: errors.otpChallenge.tooManyAttempts({ maxAttempts: 5 })
            .message,
        },
      });
      expectToEqual(response.headers["set-cookie"], undefined);
      expectToEqual(inMemoryUow.otpSessionRepository.otpSessions, []);
    });
  });

  describe(`${displayRouteName(otpChallengeRoutes.getOtpSession)}`, () => {
    const now = new Date("2026-11-05T10:00:00.000Z");
    const otpSession = new OtpSessionDtoBuilder()
      .withSubject(otpJwtPayload.subject)
      .withExpiresAt(addMinutes(now, 60).toISOString())
      .withCreatedAt(now.toISOString())
      .build();

    const manageConventionQuery: GetOtpSessionQueryParams = {
      purpose: "manageConvention",
      conventionId: convention.id,
    };

    beforeEach(() => {
      timeGateway.defaultDate = now;
      inMemoryUow.otpSessionRepository.otpSessions = [otpSession];
    });

    it("200 - returns active otp session", async () => {
      const { status, body } = await request
        .get(otpChallengeRoutes.getOtpSession.url)
        .query(manageConventionQuery)
        .set("Cookie", `if_otp_session=${otpSession.id}`);

      expectHttpResponseToEqual(
        { status, body, headers: {} },
        {
          status: 200,
          body: {
            conventionId: convention.id,
            role: "beneficiary",
            purpose: "manageConvention",
            expiresAt: otpSession.expiresAt,
          },
        },
      );
    });

    it("401 - no cookie", async () => {
      const response = await httpClient.getOtpSession({
        queryParams: manageConventionQuery,
      });

      expectHttpResponseToEqual(response, {
        status: 401,
        body: {
          status: 401,
          message: errors.otpSession.unauthorized().message,
        },
      });
    });

    it("401 - ignores legacy convention-specific cookies", async () => {
      const response = await request
        .get(otpChallengeRoutes.getOtpSession.url)
        .query(manageConventionQuery)
        .set("Cookie", `if_otp_session_${convention.id}=${otpSession.id}`);

      expect(response.status).toBe(401);
    });

    it("401 - unknown session id", async () => {
      const { status, body } = await request
        .get(otpChallengeRoutes.getOtpSession.url)
        .query(manageConventionQuery)
        .set("Cookie", "if_otp_session=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");

      expectHttpResponseToEqual(
        { status, body, headers: {} },
        {
          status: 401,
          body: {
            status: 401,
            message: errors.otpSession.unauthorized().message,
          },
        },
      );
    });

    it("401 - conventionId does not match session", async () => {
      const otherConventionId: ConventionId =
        "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

      const queryParams = {
        purpose: "manageConvention",
        conventionId: otherConventionId,
      } as const;

      const { status, body } = await request
        .get(otpChallengeRoutes.getOtpSession.url)
        .query(queryParams)
        .set("Cookie", `if_otp_session=${otpSession.id}`);

      expectHttpResponseToEqual(
        { status, body, headers: {} },
        {
          status: 401,
          body: {
            status: 401,
            message: errors.otpSession.unauthorized().message,
          },
        },
      );
    });

    it("401 - expired session", async () => {
      inMemoryUow.otpSessionRepository.otpSessions = [
        new OtpSessionDtoBuilder(otpSession)
          .withExpiresAt(now.toISOString())
          .build(),
      ];

      const { status, body } = await request
        .get(otpChallengeRoutes.getOtpSession.url)
        .query(manageConventionQuery)
        .set("Cookie", `if_otp_session=${otpSession.id}`);

      expectHttpResponseToEqual(
        { status, body, headers: {} },
        {
          status: 401,
          body: {
            status: 401,
            message: errors.otpSession.unauthorized().message,
          },
        },
      );
    });

    it("401 - revoked session", async () => {
      inMemoryUow.otpSessionRepository.otpSessions = [
        new OtpSessionDtoBuilder(otpSession)
          .withRevokedAt(now.toISOString())
          .build(),
      ];

      const { status, body } = await request
        .get(otpChallengeRoutes.getOtpSession.url)
        .query(manageConventionQuery)
        .set("Cookie", `if_otp_session=${otpSession.id}`);

      expectHttpResponseToEqual(
        { status, body, headers: {} },
        {
          status: 401,
          body: {
            status: 401,
            message: errors.otpSession.unauthorized().message,
          },
        },
      );
    });

    it("403 - email hash no longer matches convention actor", async () => {
      inMemoryUow.conventionRepository.setConventions([
        new ConventionDtoBuilder(convention)
          .withBeneficiaryEmail("changed-beneficiary@email.fr")
          .build(),
      ]);

      const { status, body } = await request
        .get(otpChallengeRoutes.getOtpSession.url)
        .query(manageConventionQuery)
        .set("Cookie", `if_otp_session=${otpSession.id}`);

      expectHttpResponseToEqual(
        { status, body, headers: {} },
        {
          status: 403,
          body: {
            status: 403,
            message: errors.convention.forbiddenMissingRightsEmailHash({
              conventionId: convention.id,
              role: "beneficiary",
              emailHash: otpSession.subject.emailHash,
            }).message,
          },
        },
      );
    });
  });
});
