import {
  type ActiveVisitorSession,
  errors,
  getVisitorSessionQueryParamsSchema,
  type VisitorSessionPayload,
} from "shared";
import { match } from "ts-pattern";
import { getConventionActorMatchingEmailHashOrThrow } from "../../../../../utils/emailHash";
import type { TimeGateway } from "../../../time-gateway/ports/TimeGateway";
import { useCaseBuilder } from "../../../useCaseBuilder";
import {
  getActiveVisitorSessionOrThrow,
  toActiveVisitorSession,
} from "../entities/visitorSession.helper";

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
      const visitorSession = await getActiveVisitorSessionOrThrow({
        uow,
        sessionId: currentUser.sessionId,
        scope: inputParams,
        now: deps.timeGateway.now(),
      });

      return match(visitorSession)
        .with(
          { purpose: "manageConvention" },
          async ({ subject }): Promise<ActiveVisitorSession> => {
            const { conventionId, role, emailHash } = subject;

            const convention =
              await uow.conventionRepository.getById(conventionId);

            if (!convention) throw errors.convention.notFound({ conventionId });

            getConventionActorMatchingEmailHashOrThrow({
              convention,
              emailHash,
              role,
            });

            return toActiveVisitorSession(visitorSession);
          },
        )
        .exhaustive();
    },
  );
