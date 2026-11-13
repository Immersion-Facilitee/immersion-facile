import {
  type ActiveVisitorSession,
  errors,
  type GetVisitorSessionQueryParams,
  type VisitorSession,
  type VisitorSessionId,
} from "shared";
import { match } from "ts-pattern";
import type { UnitOfWork } from "../../../unit-of-work/ports/UnitOfWork";

export const getActiveVisitorSessionOrThrow = async ({
  uow,
  sessionId,
  scope,
  now,
}: {
  uow: UnitOfWork;
  sessionId: VisitorSessionId;
  scope: GetVisitorSessionQueryParams;
  now: Date;
}): Promise<VisitorSession> => {
  const visitorSession = await uow.visitorSessionRepository.getById(sessionId);

  if (
    !visitorSession ||
    visitorSession.revokedAt ||
    new Date(visitorSession.expiresAt) <= now
  )
    throw errors.visitorSession.unauthorized();

  return match(scope)
    .with(
      { purpose: "manageConvention" },
      ({ conventionId }): VisitorSession => {
        if (
          visitorSession.purpose !== "manageConvention" ||
          visitorSession.subject.conventionId !== conventionId
        )
          throw errors.visitorSession.unauthorized();

        return visitorSession;
      },
    )
    .exhaustive();
};

export const toActiveVisitorSession = (
  visitorSession: VisitorSession,
): ActiveVisitorSession =>
  match(visitorSession)
    .with(
      { purpose: "manageConvention" },
      ({ subject, expiresAt }): ActiveVisitorSession => ({
        purpose: "manageConvention",
        conventionId: subject.conventionId,
        role: subject.role,
        expiresAt,
      }),
    )
    .exhaustive();
