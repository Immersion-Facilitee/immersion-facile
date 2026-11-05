import { addMinutes } from "date-fns";
import {
  ConventionDtoBuilder,
  type ConventionId,
  displayRouteName,
  errors,
  expectHttpResponseToEqual,
  expectToEqual,
  immersionFacileNoReplyEmailSender,
  OtpChallengeDtoBuilder,
  type OtpChallengeId,
  type OtpChallengeRoutes,
  otpChallengeRoutes,
} from "shared";
import type { HttpClient } from "shared-routes";
import { createSupertestSharedClient } from "shared-routes/supertest";
import { invalidTokenMessage } from "../../../../config/bootstrap/connectedUserAuthMiddleware";
import {
  type HashOtpCode,
  makeHashOtpCode,
} from "../../../../domains/core/authentication/otp-challenge/adapters/hashOtpCode";
import type { DeterministicOtpCodeGeneratorGateway } from "../../../../domains/core/authentication/otp-challenge/adapters/otp-code-generator-gateway/DeterministicOtpCodeGeneratorGateway";
import type { GenerateVisitorOtpJwt } from "../../../../domains/core/jwt";
import type { CustomTimeGateway } from "../../../../domains/core/time-gateway/adapters/CustomTimeGateway";
import type { InMemoryUnitOfWork } from "../../../../domains/core/unit-of-work/adapters/createInMemoryUow";
import type { UuidGenerator } from "../../../../domains/core/uuid-generator/ports/UuidGenerator";
import { buildTestApp } from "../../../../utils/buildTestApp";
import {
  createVisitorOtpJwtPayload,
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

  const visitorOtpJwtPayload = createVisitorOtpJwtPayload({
    purpose: "manageConvention",
    subject: {
      conventionId: convention.id,
      role: "beneficiary",
      emailHash: makeEmailHash(convention.signatories.beneficiary.email),
    },
    now: new Date(),
  });

  let httpClient: HttpClient<OtpChallengeRoutes>;
  let generateVisitorOtpJwt: GenerateVisitorOtpJwt;
  let inMemoryUow: InMemoryUnitOfWork;
  let timeGateway: CustomTimeGateway;
  let otpCodeGeneratorGateway: DeterministicOtpCodeGeneratorGateway;
  let uuidGenerator: UuidGenerator;
  let hashOtpCode: HashOtpCode;
  let expectSavedNotificationsAndEvents: ExpectSavedNotificationsAndEvents;

  beforeEach(async () => {
    const testApp = await buildTestApp();
    generateVisitorOtpJwt = testApp.generateVisitorOtpJwt;
    inMemoryUow = testApp.inMemoryUow;
    uuidGenerator = testApp.uuidGenerator;
    hashOtpCode = makeHashOtpCode(testApp.appConfig.otpCodeHmacSecret);
    timeGateway = testApp.gateways.timeGateway;
    otpCodeGeneratorGateway = testApp.gateways.otpCodeGeneratorGateway;
    expectSavedNotificationsAndEvents = makeExpectSavedNotificationsAndEvents(
      inMemoryUow.notificationRepository,
      inMemoryUow.outboxRepository,
    );
    httpClient = createSupertestSharedClient(
      otpChallengeRoutes,
      testApp.request,
    );
    inMemoryUow.conventionRepository.setConventions([convention]);
  });

  describe(`${displayRouteName(otpChallengeRoutes.getMaskedOtpRecipient)}`, () => {
    it("200 - returns the masked email and phone of the convention actor", async () => {
      const response = await httpClient.getMaskedOtpRecipient({
        headers: { authorization: generateVisitorOtpJwt(visitorOtpJwtPayload) },
      });

      expectHttpResponseToEqual(response, {
        status: 200,
        body: {
          maskedEmail: "b**********@email.fr",
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

    it("403 - email hash does not match the actor in the convention", async () => {
      const emailHash = makeEmailHash(
        convention.signatories.establishmentRepresentative.email,
      );

      const response = await httpClient.getMaskedOtpRecipient({
        headers: {
          authorization: generateVisitorOtpJwt(
            createVisitorOtpJwtPayload({
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
          authorization: generateVisitorOtpJwt(
            createVisitorOtpJwtPayload({
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
    const otpCode = "123456";
    const otpChallengeId: OtpChallengeId =
      "11111111-1111-4111-a111-111111111111";
    const authorization = () => ({
      authorization: generateVisitorOtpJwt(visitorOtpJwtPayload),
    });

    beforeEach(() => {
      timeGateway.defaultDate = now;
      otpCodeGeneratorGateway.setNextOtpCodes([otpCode]);
      const uuids = [otpChallengeId];
      uuidGenerator.new = () => uuids.shift() ?? "no-uuid-provided";
    });

    it("200 - creates otp challenge and sends email with otp code", async () => {
      const response = await httpClient.requestOtpChallenge({
        body: { channel: "email" },
        headers: authorization(),
      });

      expectHttpResponseToEqual(response, {
        status: 200,
        body: { otpChallengeId },
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

    it("200 - creates otp challenge and sends sms with otp code", async () => {
      const response = await httpClient.requestOtpChallenge({
        body: { channel: "sms" },
        headers: authorization(),
      });

      expectHttpResponseToEqual(response, {
        status: 200,
        body: { otpChallengeId },
      });
      expect(inMemoryUow.otpChallengeRepository.otpChallenges).toHaveLength(1);
      expectSavedNotificationsAndEvents({
        emails: [],
        sms: [
          {
            kind: "RequestOtpCode",
            params: { otpCode },
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
        headers: authorization(),
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

    it("403 - email hash does not match the actor in the convention", async () => {
      const emailHash = makeEmailHash(
        convention.signatories.establishmentRepresentative.email,
      );

      const response = await httpClient.requestOtpChallenge({
        body: { channel: "email" },
        headers: {
          authorization: generateVisitorOtpJwt(
            createVisitorOtpJwtPayload({
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
          authorization: generateVisitorOtpJwt(
            createVisitorOtpJwtPayload({
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
          .withSubject(visitorOtpJwtPayload.subject)
          .withRecipient(convention.signatories.beneficiary.email)
          .withCreatedAt("2026-11-02T09:59:30.000Z")
          .withExpiresAt("2026-11-02T10:29:30.000Z")
          .build(),
      ];

      const response = await httpClient.requestOtpChallenge({
        body: { channel: "email" },
        headers: authorization(),
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
  });

  describe(`${displayRouteName(otpChallengeRoutes.verifyOtpChallenge)}`, () => {
    const now = new Date();
    const otpCode = "123456";
    const otpChallengeId: OtpChallengeId =
      "11111111-1111-4111-a111-111111111111";

    beforeEach(() => {
      timeGateway.defaultDate = now;
      inMemoryUow.otpChallengeRepository.otpChallenges = [
        new OtpChallengeDtoBuilder()
          .withId(otpChallengeId)
          .withSubject(visitorOtpJwtPayload.subject)
          .withCodeHash(hashOtpCode({ otpChallengeId, otpCode }))
          .withCreatedAt(now.toISOString())
          .withExpiresAt(addMinutes(now, 30).toISOString())
          .build(),
      ];
    });

    it("204 - verifies otp code, creates visitor session and sets cookie", async () => {
      const response = await httpClient.verifyOtpChallenge({
        urlParams: { otpChallengeId },
        body: { otpCode },
        headers: {
          authorization: generateVisitorOtpJwt(visitorOtpJwtPayload),
        },
      });

      expectHttpResponseToEqual(response, {
        status: 204,
        body: {},
      });
      expect(response.headers["set-cookie"]).toEqual(
        expect.arrayContaining([
          expect.stringMatching(
            `if_visitor_${convention.id}=${inMemoryUow.visitorSessionRepository.visitorSessions[0].id};.*HttpOnly.*SameSite=Lax`,
          ),
        ]),
      );
    });

    it("401 - invalid JWT", async () => {
      const response = await httpClient.verifyOtpChallenge({
        urlParams: { otpChallengeId },
        body: { otpCode },
        headers: { authorization: "invalid-jwt" },
      });

      expectHttpResponseToEqual(response, {
        status: 401,
        body: { status: 401, message: invalidTokenMessage },
      });
    });

    it("401 - invalid otp code does not set cookie", async () => {
      const response = await httpClient.verifyOtpChallenge({
        urlParams: { otpChallengeId },
        body: { otpCode: "000000" },
        headers: {
          authorization: generateVisitorOtpJwt(visitorOtpJwtPayload),
        },
      });

      expectHttpResponseToEqual(response, {
        status: 401,
        body: {
          status: 401,
          message: errors.otpChallenge.invalidCode().message,
        },
      });
      expectToEqual(response.headers["set-cookie"], undefined);
    });

    it("404 - otp challenge not found", async () => {
      const unknownOtpChallengeId: OtpChallengeId =
        "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

      const response = await httpClient.verifyOtpChallenge({
        urlParams: { otpChallengeId: unknownOtpChallengeId },
        body: { otpCode },
        headers: {
          authorization: generateVisitorOtpJwt(visitorOtpJwtPayload),
        },
      });

      expectHttpResponseToEqual(response, {
        status: 404,
        body: {
          status: 404,
          message: errors.otpChallenge.notFound(unknownOtpChallengeId).message,
        },
      });
    });
  });
});
