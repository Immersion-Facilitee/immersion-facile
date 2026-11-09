import { timingSafeEqual } from "node:crypto";
import { addMinutes } from "date-fns";
import {
  errors,
  executeInSequence,
  type OtpChallenge,
  VISITOR_SESSION_DURATION_IN_MINUTES,
  type VisitorOtpJwtPayload,
  type VisitorSession,
  verifyOtpChallengeSchema,
} from "shared";
import type { TimeGateway } from "../../../time-gateway/ports/TimeGateway";
import type { UnitOfWorkPerformer } from "../../../unit-of-work/ports/UnitOfWorkPerformer";
import { useCaseBuilder } from "../../../useCaseBuilder";
import type { UuidGenerator } from "../../../uuid-generator/ports/UuidGenerator";
import type { HashOtpCode } from "../adapters/hashOtpCode";

const MAX_OTP_CHALLENGE_ATTEMPTS = 5;

export type VerifyOtpChallengeOutput = Pick<VisitorSession, "id" | "expiresAt">;

type OtpCodeVerification =
  | { isOtpCodeValid: true; visitorSession: VisitorSession }
  | { isOtpCodeValid: false };

export type VerifyOtpChallenge = ReturnType<typeof makeVerifyOtpChallenge>;

export const makeVerifyOtpChallenge = useCaseBuilder("VerifyOtpChallenge")
  .withInput(verifyOtpChallengeSchema)
  .withCurrentUser<VisitorOtpJwtPayload>()
  .withOutput<VerifyOtpChallengeOutput>()
  .withDeps<{
    hashOtpCode: HashOtpCode;
    timeGateway: TimeGateway;
    uuidGenerator: UuidGenerator;
    uowPerformer: UnitOfWorkPerformer;
  }>()
  .notTransactional()
  .build(
    async ({
      inputParams: { otpCode },
      currentUser,
      deps,
    }): Promise<VerifyOtpChallengeOutput> => {
      const otpCodeVerification = await deps.uowPerformer.perform(
        async (uow): Promise<OtpCodeVerification> => {
          const otpChallenge =
            await uow.otpChallengeRepository.getActiveByPurposeAndSubject(
              {
                purpose: currentUser.purpose,
                subject: currentUser.subject,
              },
            );

          if (!otpChallenge) throw errors.otpChallenge.noActiveChallenge();

          const now = deps.timeGateway.now();

          throwIfOtpChallengeCannotBeVerified({ otpChallenge, now });

          if (
            !isSameHash(
              otpChallenge.codeHash,
              deps.hashOtpCode({ otpChallengeId: otpChallenge.id, otpCode }),
            )
          ) {
            await uow.otpChallengeRepository.incrementAttempts(otpChallenge.id);
            return { isOtpCodeValid: false };
          }

          await uow.otpChallengeRepository.markAsUsed({
            id: otpChallenge.id,
            usedAt: now,
          });

          const previousVisitorSessionsWithSamePurposeAndSubject =
            await uow.visitorSessionRepository.getByPurposeAndSubject({
              purpose: otpChallenge.purpose,
              subject: otpChallenge.subject,
            });

          await executeInSequence(
            previousVisitorSessionsWithSamePurposeAndSubject.filter(
              (visitorSession) => isVisitorSessionActive(visitorSession, now),
            ),
            ({ id }) =>
              uow.visitorSessionRepository.revoke({ id, revokedAt: now }),
          );

          const visitorSession: VisitorSession = {
            id: deps.uuidGenerator.new(),
            purpose: otpChallenge.purpose,
            subject: otpChallenge.subject,
            expiresAt: addMinutes(
              now,
              VISITOR_SESSION_DURATION_IN_MINUTES,
            ).toISOString(),
            revokedAt: null,
            createdAt: now.toISOString(),
          };

          await uow.visitorSessionRepository.save(visitorSession);

          return { isOtpCodeValid: true, visitorSession };
        },
      );

      if (!otpCodeVerification.isOtpCodeValid)
        throw errors.otpChallenge.invalidCode();

      return {
        id: otpCodeVerification.visitorSession.id,
        expiresAt: otpCodeVerification.visitorSession.expiresAt,
      };
    },
  );

const throwIfOtpChallengeCannotBeVerified = ({
  otpChallenge,
  now,
}: {
  otpChallenge: OtpChallenge;
  now: Date;
}): void => {
  if (new Date(otpChallenge.expiresAt) <= now)
    throw errors.otpChallenge.expired();

  if (otpChallenge.attempts >= MAX_OTP_CHALLENGE_ATTEMPTS)
    throw errors.otpChallenge.tooManyAttempts({
      maxAttempts: MAX_OTP_CHALLENGE_ATTEMPTS,
    });
};

const isSameHash = (expectedHash: string, actualHash: string): boolean =>
  expectedHash.length === actualHash.length &&
  timingSafeEqual(Buffer.from(expectedHash), Buffer.from(actualHash));

const isVisitorSessionActive = (
  { expiresAt, revokedAt }: VisitorSession,
  now: Date,
): boolean => revokedAt === null && new Date(expiresAt) > now;
