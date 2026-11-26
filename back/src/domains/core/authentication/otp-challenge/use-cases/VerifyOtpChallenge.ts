import { timingSafeEqual } from "node:crypto";
import { addMinutes } from "date-fns";
import {
  errors,
  executeInSequence,
  OTP_SESSION_DURATION_IN_MINUTES,
  type OtpChallenge,
  type OtpJwtPayload,
  type OtpSession,
  verifyOtpChallengeSchema,
} from "shared";
import type { TimeGateway } from "../../../time-gateway/ports/TimeGateway";
import type { UnitOfWorkPerformer } from "../../../unit-of-work/ports/UnitOfWorkPerformer";
import { useCaseBuilder } from "../../../useCaseBuilder";
import type { UuidGenerator } from "../../../uuid-generator/ports/UuidGenerator";
import type { HashOtpCode } from "../entities/otpChallenge.helper";

const MAX_OTP_CHALLENGE_ATTEMPTS = 5;

export type VerifyOtpChallengeOutput = Pick<OtpSession, "id" | "expiresAt">;

export type VerifyOtpChallenge = ReturnType<typeof makeVerifyOtpChallenge>;

export const makeVerifyOtpChallenge = useCaseBuilder("VerifyOtpChallenge")
  .withInput(verifyOtpChallengeSchema)
  .withCurrentUser<OtpJwtPayload>()
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
      const now = deps.timeGateway.now();

      const otpChallenge = await deps.uowPerformer.perform(
        async (uow): Promise<OtpChallenge> => {
          const activeOtpChallenge =
            await uow.otpChallengeRepository.getActiveByPurposeAndSubject({
              purpose: currentUser.purpose,
              subject: currentUser.subject,
            });

          if (!activeOtpChallenge)
            throw errors.otpChallenge.noActiveChallenge();

          throwIfOtpChallengeCannotBeVerified({
            otpChallenge: activeOtpChallenge,
            now,
          });

          await uow.otpChallengeRepository.incrementAttempts(
            activeOtpChallenge.id,
          );

          return activeOtpChallenge;
        },
      );

      if (
        !isSameHash(
          otpChallenge.codeHash,
          deps.hashOtpCode({ otpChallengeId: otpChallenge.id, otpCode }),
        )
      )
        throw errors.otpChallenge.invalidCode();

      return deps.uowPerformer.perform(
        async (uow): Promise<VerifyOtpChallengeOutput> => {
          const activeOtpChallenge =
            await uow.otpChallengeRepository.getActiveByPurposeAndSubject({
              purpose: otpChallenge.purpose,
              subject: otpChallenge.subject,
            });

          if (activeOtpChallenge?.id !== otpChallenge.id)
            throw errors.otpChallenge.noActiveChallenge();

          await uow.otpChallengeRepository.markAsUsed({
            id: otpChallenge.id,
            usedAt: now,
          });

          const previousOtpSessionsWithSamePurposeAndSubject =
            await uow.otpSessionRepository.getByPurposeAndSubject({
              purpose: otpChallenge.purpose,
              subject: otpChallenge.subject,
            });

          await executeInSequence(
            previousOtpSessionsWithSamePurposeAndSubject.filter((otpSession) =>
              isOtpSessionActive(otpSession, now),
            ),
            ({ id }) => uow.otpSessionRepository.revoke({ id, revokedAt: now }),
          );

          const otpSession: OtpSession = {
            id: deps.uuidGenerator.new(),
            purpose: otpChallenge.purpose,
            subject: otpChallenge.subject,
            expiresAt: addMinutes(
              now,
              OTP_SESSION_DURATION_IN_MINUTES,
            ).toISOString(),
            revokedAt: null,
            createdAt: now.toISOString(),
          };

          await uow.otpSessionRepository.save(otpSession);

          return { id: otpSession.id, expiresAt: otpSession.expiresAt };
        },
      );
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

const isOtpSessionActive = (
  { expiresAt, revokedAt }: OtpSession,
  now: Date,
): boolean => revokedAt === null && new Date(expiresAt) > now;
