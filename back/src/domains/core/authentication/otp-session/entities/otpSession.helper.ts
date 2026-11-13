import {
  type ActiveOtpSession,
  errors,
  type GetOtpSessionQueryParams,
  type OtpSession,
  type OtpSessionId,
} from "shared";
import { match } from "ts-pattern";
import type { UnitOfWork } from "../../../unit-of-work/ports/UnitOfWork";

export const getActiveOtpSessionOrThrow = async ({
  uow,
  sessionId,
  scope,
  now,
}: {
  uow: UnitOfWork;
  sessionId: OtpSessionId;
  scope: GetOtpSessionQueryParams;
  now: Date;
}): Promise<OtpSession> => {
  const otpSession = await uow.otpSessionRepository.getById(sessionId);

  if (
    !otpSession ||
    otpSession.revokedAt ||
    new Date(otpSession.expiresAt) <= now
  )
    throw errors.otpSession.unauthorized();

  return match(scope)
    .with({ purpose: "manageConvention" }, ({ conventionId }): OtpSession => {
      if (
        otpSession.purpose !== "manageConvention" ||
        otpSession.subject.conventionId !== conventionId
      )
        throw errors.otpSession.unauthorized();

      return otpSession;
    })
    .exhaustive();
};

export const toActiveOtpSession = (otpSession: OtpSession): ActiveOtpSession =>
  match(otpSession)
    .with(
      { purpose: "manageConvention" },
      ({ subject, expiresAt }): ActiveOtpSession => ({
        purpose: "manageConvention",
        conventionId: subject.conventionId,
        role: subject.role,
        expiresAt,
      }),
    )
    .exhaustive();
