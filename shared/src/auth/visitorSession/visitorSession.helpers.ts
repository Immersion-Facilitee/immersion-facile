import { match } from "ts-pattern";
import type {
  GetVisitorSessionQueryParams,
  VisitorSessionCookieName,
} from "./visitorSession.dto";

export const makeVisitorSessionCookieName = (
  params: GetVisitorSessionQueryParams,
): VisitorSessionCookieName =>
  match(params)
    .with(
      { purpose: "manageConvention" },
      ({ conventionId }): VisitorSessionCookieName =>
        `if_visitor_${conventionId}`,
    )
    .exhaustive();
