import {
  type ActiveOtpSession,
  errors,
  getOtpSessionQueryParamsSchema,
  type OtpSessionPayload,
} from "shared";
import { match } from "ts-pattern";
import { getConventionActorMatchingEmailHashOrThrow } from "../../../../../utils/emailHash";
import type { TimeGateway } from "../../../time-gateway/ports/TimeGateway";
import { useCaseBuilder } from "../../../useCaseBuilder";
import {
  getActiveOtpSessionOrThrow,
  toActiveOtpSession,
} from "../entities/otpSession.helper";

export type GetOtpSession = ReturnType<typeof makeGetOtpSession>;

export const makeGetOtpSession = useCaseBuilder("GetOtpSession")
  .withInput(getOtpSessionQueryParamsSchema)
  .withOutput<ActiveOtpSession>()
  .withCurrentUser<OtpSessionPayload>()
  .withDeps<{ timeGateway: TimeGateway }>()
  .build(
    async ({
      inputParams,
      currentUser,
      uow,
      deps,
    }): Promise<ActiveOtpSession> => {
      const otpSession = await getActiveOtpSessionOrThrow({
        uow,
        sessionId: currentUser.sessionId,
        scope: inputParams,
        now: deps.timeGateway.now(),
      });

      return match(otpSession)
        .with(
          { purpose: "manageConvention" },
          async ({ subject }): Promise<ActiveOtpSession> => {
            const { conventionId, role, emailHash } = subject;

            const convention =
              await uow.conventionRepository.getById(conventionId);

            if (!convention) throw errors.convention.notFound({ conventionId });

            getConventionActorMatchingEmailHashOrThrow({
              convention,
              emailHash,
              role,
            });

            return toActiveOtpSession(otpSession);
          },
        )
        .exhaustive();
    },
  );
