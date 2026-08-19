import { Router } from "express";
import { errors, formCompletionRoutes } from "shared";
import { createExpressSharedRouter } from "shared-routes/express";
import type { AppDependencies } from "../../../../config/bootstrap/createAppDependencies";
import { sendHttpResponse } from "../../../../config/helpers/sendHttpResponse";

export const createFormCompletionRouter = (deps: AppDependencies) => {
  const expressFormCompletionRouter = Router();

  const formCompletionRouter = createExpressSharedRouter(
    formCompletionRoutes,
    expressFormCompletionRouter,
  );

  formCompletionRouter.appellation((req, res) =>
    sendHttpResponse(req, res, () =>
      deps.useCases.appellationSearch.execute(req.query),
    ),
  );

  formCompletionRouter.getSiretEstablishmentDto((req, res) =>
    sendHttpResponse(req, res, () =>
      deps.useCases.getSiretEstablishmentDto
        .execute(req.params)
        .then((result) => {
          if (result) return result;
          throw errors.siretApi.notFound({ siret: req.params.siret });
        }),
    ),
  );

  return expressFormCompletionRouter;
};
