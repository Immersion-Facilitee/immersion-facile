import {
  type ActiveVisitorSession,
  errors,
  getVisitorSessionQueryParamsSchema,
  type VisitorSessionPayload,
} from "shared";
import { match } from "ts-pattern";
import { makeEmailHash } from "../../../../../utils/jwt";
import type { TimeGateway } from "../../../time-gateway/ports/TimeGateway";
import { useCaseBuilder } from "../../../useCaseBuilder";
import { getConventionActorOtpRecipients } from "../../otp-challenge/use-cases/GetMaskedOtpRecipients";

export type GetVisitorSession = ReturnType<typeof makeGetVisitorSession>;

export const makeGetVisitorSession = useCaseBuilder("GetVisitorSession")
  .withInput(getVisitorSessionQueryParamsSchema)
  .withOutput<ActiveVisitorSession>()
  .withCurrentUser<VisitorSessionPayload>()
  .withDeps<{ timeGateway: TimeGateway }>()
  .build(
    async ({
      inputParams,
      currentUser,
      uow,
      deps,
    }): Promise<ActiveVisitorSession> => {
      const visitorSession = await uow.visitorSessionRepository.getById(
        currentUser.sessionId,
      );
      const now = deps.timeGateway.now();

      if (
        !visitorSession ||
        visitorSession.revokedAt ||
        new Date(visitorSession.expiresAt) <= now
      )
        throw errors.visitorSession.unauthorized();

      return match(inputParams)
        .with(
          { purpose: "manageConvention" },
          async ({ conventionId }): Promise<ActiveVisitorSession> => {
            if (
              visitorSession.purpose !== "manageConvention" ||
              visitorSession.subject.conventionId !== conventionId
            )
              throw errors.visitorSession.unauthorized();

            const { role, emailHash } = visitorSession.subject;

            const convention =
              await uow.conventionRepository.getById(conventionId);

            if (!convention) throw errors.convention.notFound({ conventionId });

            const recipients = getConventionActorOtpRecipients({
              convention,
              role,
            });

            if (makeEmailHash(recipients.email) !== emailHash)
              throw errors.convention.forbiddenMissingRightsEmailHash({
                conventionId,
                role,
                emailHash,
              });

            return {
              purpose: "manageConvention",
              conventionId,
              role,
              expiresAt: visitorSession.expiresAt,
            };
          },
        )
        .exhaustive();
    },
  );
