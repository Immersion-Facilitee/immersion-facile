import type { ConnectedUser, ConventionTemplate } from "shared";
import z from "zod";
import { useCaseBuilder } from "../../core/useCaseBuilder";

export const makeGetConventionTemplatesForCurrentUser = useCaseBuilder(
  "GetConventionTemplatesForCurrentUser",
)
  .withInput<void>(z.void())
  .withOutput<ConventionTemplate[]>()
  .withCurrentUser<ConnectedUser>()
  .build(async ({ uow, currentUser }) =>
    uow.conventionTemplateQueries.get({
      userIds: [currentUser.id],
    }),
  );
