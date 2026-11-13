import { addMinutes } from "date-fns";
import {
  currentJwtVersions,
  errors,
  expectPromiseToFailWithError,
  expectToEqual,
  OTP_SESSION_DURATION_IN_MINUTES,
  OtpChallengeDtoBuilder,
  type OtpJwtPayload,
  OtpSessionDtoBuilder,
} from "shared";
import { CustomTimeGateway } from "../../../time-gateway/adapters/CustomTimeGateway";
import {
  createInMemoryUow,
  type InMemoryUnitOfWork,
} from "../../../unit-of-work/adapters/createInMemoryUow";
import { InMemoryUowPerformer } from "../../../unit-of-work/adapters/InMemoryUowPerformer";
import { TestUuidGenerator } from "../../../uuid-generator/adapters/UuidGeneratorImplementations";
import { makeHashOtpCode } from "../entities/otpChallenge.helper";
import {
  makeVerifyOtpChallenge,
  type VerifyOtpChallenge,
} from "./VerifyOtpChallenge";

describe("VerifyOtpChallenge", () => {
  const hashOtpCode = makeHashOtpCode("test-otp-code-hmac-secret");
  const now = new Date("2024-04-28T11:00:00.000Z");
  const otpChallengeId = "11111111-1111-4111-a111-111111111111";
  const otpCode = "1234";
  const otpSessionId = "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa";
  const otpChallenge = new OtpChallengeDtoBuilder()
    .withId(otpChallengeId)
    .withCodeHash(hashOtpCode({ otpChallengeId, otpCode }))
    .withExpiresAt("2024-04-28T12:00:00.000Z")
    .withCreatedAt("2024-04-28T10:00:00.000Z")
    .build();
  const otpJwtPayload: OtpJwtPayload = {
    purpose: otpChallenge.purpose,
    subject: otpChallenge.subject,
    version: currentJwtVersions.otp,
    iat: now.getTime() / 1000,
    exp: addMinutes(now, 60).getTime() / 1000,
  };

  let uow: InMemoryUnitOfWork;
  let verifyOtpChallenge: VerifyOtpChallenge;
  let uuidGenerator: TestUuidGenerator;

  beforeEach(() => {
    uow = createInMemoryUow();
    uuidGenerator = new TestUuidGenerator();
    const timeGateway = new CustomTimeGateway(now);
    const uowPerformer = new InMemoryUowPerformer(uow);

    verifyOtpChallenge = makeVerifyOtpChallenge({
      deps: {
        hashOtpCode,
        timeGateway,
        uuidGenerator,
        uowPerformer,
      },
    });
  });

  describe("Wrong path", () => {
    it("throws if there is no otp challenge for the subject", async () => {
      await expectPromiseToFailWithError(
        verifyOtpChallenge.execute({ otpCode }, otpJwtPayload),
        errors.otpChallenge.noActiveChallenge(),
      );
      expectToEqual(uow.otpChallengeRepository.otpChallenges, []);
      expectToEqual(uow.otpSessionRepository.otpSessions, []);
    });

    it("throws if the only active otp challenge belongs to another subject", async () => {
      const otherSubjectOtpChallenge = new OtpChallengeDtoBuilder(otpChallenge)
        .withSubject({ ...otpChallenge.subject, role: "beneficiary" })
        .build();
      uow.otpChallengeRepository.otpChallenges = [otherSubjectOtpChallenge];

      await expectPromiseToFailWithError(
        verifyOtpChallenge.execute({ otpCode }, otpJwtPayload),
        errors.otpChallenge.noActiveChallenge(),
      );
      expectToEqual(uow.otpChallengeRepository.otpChallenges, [
        otherSubjectOtpChallenge,
      ]);
      expectToEqual(uow.otpSessionRepository.otpSessions, []);
    });

    it("throws if the otp challenge expires", async () => {
      const expiredOtpChallenge = new OtpChallengeDtoBuilder(otpChallenge)
        .withExpiresAt(now.toISOString())
        .build();
      uow.otpChallengeRepository.otpChallenges = [expiredOtpChallenge];

      await expectPromiseToFailWithError(
        verifyOtpChallenge.execute({ otpCode }, otpJwtPayload),
        errors.otpChallenge.expired(),
      );
      expectToEqual(uow.otpChallengeRepository.otpChallenges, [
        expiredOtpChallenge,
      ]);
      expectToEqual(uow.otpSessionRepository.otpSessions, []);
    });

    it("throws if the otp challenge of the subject is already used", async () => {
      const usedOtpChallenge = new OtpChallengeDtoBuilder(otpChallenge)
        .withUsedAt("2024-04-28T10:50:00.000Z")
        .build();
      uow.otpChallengeRepository.otpChallenges = [usedOtpChallenge];

      await expectPromiseToFailWithError(
        verifyOtpChallenge.execute({ otpCode }, otpJwtPayload),
        errors.otpChallenge.noActiveChallenge(),
      );
      expectToEqual(uow.otpChallengeRepository.otpChallenges, [
        usedOtpChallenge,
      ]);
      expectToEqual(uow.otpSessionRepository.otpSessions, []);
    });

    it("throws if the otp challenge of the subject is revoked", async () => {
      const revokedOtpChallenge = new OtpChallengeDtoBuilder(otpChallenge)
        .withRevokedAt("2024-04-28T10:50:00.000Z")
        .build();
      uow.otpChallengeRepository.otpChallenges = [revokedOtpChallenge];

      await expectPromiseToFailWithError(
        verifyOtpChallenge.execute({ otpCode }, otpJwtPayload),
        errors.otpChallenge.noActiveChallenge(),
      );
      expectToEqual(uow.otpChallengeRepository.otpChallenges, [
        revokedOtpChallenge,
      ]);
      expectToEqual(uow.otpSessionRepository.otpSessions, []);
    });

    it("throws if the max number of attempts is already reached, even with the correct code", async () => {
      const lockedOtpChallenge = new OtpChallengeDtoBuilder(otpChallenge)
        .withAttempts(5)
        .build();
      uow.otpChallengeRepository.otpChallenges = [lockedOtpChallenge];

      await expectPromiseToFailWithError(
        verifyOtpChallenge.execute({ otpCode }, otpJwtPayload),
        errors.otpChallenge.tooManyAttempts({ maxAttempts: 5 }),
      );
      expectToEqual(uow.otpChallengeRepository.otpChallenges, [
        lockedOtpChallenge,
      ]);
      expectToEqual(uow.otpSessionRepository.otpSessions, []);
    });

    it("increments attempts up to the max and throws if the code is invalid", async () => {
      const lastAttemptOtpChallenge = new OtpChallengeDtoBuilder(otpChallenge)
        .withAttempts(4)
        .build();
      uow.otpChallengeRepository.otpChallenges = [lastAttemptOtpChallenge];

      await expectPromiseToFailWithError(
        verifyOtpChallenge.execute({ otpCode: "0000" }, otpJwtPayload),
        errors.otpChallenge.invalidCode(),
      );
      expectToEqual(uow.otpChallengeRepository.otpChallenges, [
        { ...lastAttemptOtpChallenge, attempts: 5 },
      ]);
      expectToEqual(uow.otpSessionRepository.otpSessions, []);
    });

    it("throws and consumes an attempt of the active otp challenge if the code only matches a revoked otp challenge of the subject", async () => {
      const revokedOtpChallengeId = "22222222-2222-4222-a222-222222222222";
      const revokedOtpChallenge = new OtpChallengeDtoBuilder(otpChallenge)
        .withId(revokedOtpChallengeId)
        .withCodeHash(
          hashOtpCode({ otpChallengeId: revokedOtpChallengeId, otpCode }),
        )
        .withRevokedAt("2024-04-28T10:30:00.000Z")
        .build();
      const activeOtpChallengeId = "33333333-3333-4333-a333-333333333333";
      const activeOtpChallenge = new OtpChallengeDtoBuilder(otpChallenge)
        .withId(activeOtpChallengeId)
        .withCodeHash(
          hashOtpCode({
            otpChallengeId: activeOtpChallengeId,
            otpCode: "4321",
          }),
        )
        .withCreatedAt("2024-04-28T10:30:00.000Z")
        .build();
      uow.otpChallengeRepository.otpChallenges = [
        revokedOtpChallenge,
        activeOtpChallenge,
      ];

      await expectPromiseToFailWithError(
        verifyOtpChallenge.execute({ otpCode }, otpJwtPayload),
        errors.otpChallenge.invalidCode(),
      );
      expectToEqual(uow.otpChallengeRepository.otpChallenges, [
        revokedOtpChallenge,
        { ...activeOtpChallenge, attempts: 1 },
      ]);
      expectToEqual(uow.otpSessionRepository.otpSessions, []);
    });
  });

  describe("Right path", () => {
    it("marks the otp challenge as used, revokes active previous sessions and creates a otp session", async () => {
      const previousOtpSession = new OtpSessionDtoBuilder()
        .withId("bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb")
        .withSubject(otpChallenge.subject)
        .withCreatedAt("2024-04-28T10:00:00.000Z")
        .build();
      const alreadyRevokedOtpSession = new OtpSessionDtoBuilder()
        .withId("cccccccc-cccc-4ccc-cccc-cccccccccccc")
        .withSubject(otpChallenge.subject)
        .withRevokedAt("2024-04-28T10:30:00.000Z")
        .build();
      const expiredOtpSession = new OtpSessionDtoBuilder()
        .withId("eeeeeeee-eeee-4eee-aeee-eeeeeeeeeeee")
        .withSubject(otpChallenge.subject)
        .withExpiresAt("2024-04-28T10:30:00.000Z")
        .build();
      const otherSubjectOtpSession = new OtpSessionDtoBuilder()
        .withId("dddddddd-dddd-4ddd-dddd-dddddddddddd")
        .withSubject({
          ...otpChallenge.subject,
          role: "beneficiary",
        })
        .build();

      uow.otpChallengeRepository.otpChallenges = [otpChallenge];
      uow.otpSessionRepository.otpSessions = [
        previousOtpSession,
        alreadyRevokedOtpSession,
        expiredOtpSession,
        otherSubjectOtpSession,
      ];
      uuidGenerator.setNextUuids([otpSessionId]);

      const expiresAt = addMinutes(
        now,
        OTP_SESSION_DURATION_IN_MINUTES,
      ).toISOString();

      expectToEqual(
        await verifyOtpChallenge.execute({ otpCode }, otpJwtPayload),
        {
          otpSessionId,
          activeOtpSession: {
            purpose: "manageConvention",
            conventionId: otpChallenge.subject.conventionId,
            role: otpChallenge.subject.role,
            expiresAt,
          },
        },
      );

      expectToEqual(uow.otpChallengeRepository.otpChallenges, [
        { ...otpChallenge, attempts: 1, usedAt: now.toISOString() },
      ]);
      expectToEqual(uow.otpSessionRepository.otpSessions, [
        { ...previousOtpSession, revokedAt: now.toISOString() },
        alreadyRevokedOtpSession,
        expiredOtpSession,
        otherSubjectOtpSession,
        new OtpSessionDtoBuilder()
          .withId(otpSessionId)
          .withSubject(otpChallenge.subject)
          .withExpiresAt(expiresAt)
          .withCreatedAt(now.toISOString())
          .build(),
      ]);
    });

    it("verifies the code against the active otp challenge of the subject only", async () => {
      const revokedOtpChallengeId = "22222222-2222-4222-a222-222222222222";
      const revokedOtpChallenge = new OtpChallengeDtoBuilder(otpChallenge)
        .withId(revokedOtpChallengeId)
        .withCodeHash(
          hashOtpCode({ otpChallengeId: revokedOtpChallengeId, otpCode }),
        )
        .withRevokedAt("2024-04-28T10:30:00.000Z")
        .build();
      const activeOtpChallengeId = "33333333-3333-4333-a333-333333333333";
      const activeOtpCode = "4321";
      const activeOtpChallenge = new OtpChallengeDtoBuilder(otpChallenge)
        .withId(activeOtpChallengeId)
        .withCodeHash(
          hashOtpCode({
            otpChallengeId: activeOtpChallengeId,
            otpCode: activeOtpCode,
          }),
        )
        .withCreatedAt("2024-04-28T10:30:00.000Z")
        .build();
      uow.otpChallengeRepository.otpChallenges = [
        revokedOtpChallenge,
        activeOtpChallenge,
      ];
      uuidGenerator.setNextUuids([otpSessionId]);

      const expiresAt = addMinutes(
        now,
        OTP_SESSION_DURATION_IN_MINUTES,
      ).toISOString();

      expectToEqual(
        await verifyOtpChallenge.execute(
          { otpCode: activeOtpCode },
          otpJwtPayload,
        ),
        {
          otpSessionId,
          activeOtpSession: {
            purpose: "manageConvention",
            conventionId: otpChallenge.subject.conventionId,
            role: otpChallenge.subject.role,
            expiresAt,
          },
        },
      );
      expectToEqual(uow.otpChallengeRepository.otpChallenges, [
        revokedOtpChallenge,
        { ...activeOtpChallenge, attempts: 1, usedAt: now.toISOString() },
      ]);
      expectToEqual(uow.otpSessionRepository.otpSessions, [
        new OtpSessionDtoBuilder()
          .withId(otpSessionId)
          .withSubject(otpChallenge.subject)
          .withExpiresAt(expiresAt)
          .withCreatedAt(now.toISOString())
          .build(),
      ]);
    });

    it("accepts the correct code on the last allowed attempt", async () => {
      const lastAttemptOtpChallenge = new OtpChallengeDtoBuilder(otpChallenge)
        .withAttempts(4)
        .build();
      uow.otpChallengeRepository.otpChallenges = [lastAttemptOtpChallenge];
      uuidGenerator.setNextUuids([otpSessionId]);

      const expiresAt = addMinutes(
        now,
        OTP_SESSION_DURATION_IN_MINUTES,
      ).toISOString();

      expectToEqual(
        await verifyOtpChallenge.execute({ otpCode }, otpJwtPayload),
        {
          otpSessionId,
          activeOtpSession: {
            purpose: "manageConvention",
            conventionId: otpChallenge.subject.conventionId,
            role: otpChallenge.subject.role,
            expiresAt,
          },
        },
      );

      expectToEqual(uow.otpChallengeRepository.otpChallenges, [
        { ...lastAttemptOtpChallenge, attempts: 5, usedAt: now.toISOString() },
      ]);
      expectToEqual(uow.otpSessionRepository.otpSessions, [
        new OtpSessionDtoBuilder()
          .withId(otpSessionId)
          .withSubject(otpChallenge.subject)
          .withExpiresAt(expiresAt)
          .withCreatedAt(now.toISOString())
          .build(),
      ]);
    });
  });
});
