import type { ConventionId, frontRoutes } from "shared";
import { AssessmentContent } from "src/app/components/assessment/AssessmentContent";
import { getConventionAccessFromJwt } from "src/app/hooks/jwt.hooks";
import { frontErrors } from "src/app/pages/error/front-errors";
import type { Route } from "type-route";

type AssessmentRoute = Route<typeof frontRoutes.assessment>;

interface AssessmentPageProps {
  route: AssessmentRoute;
}

export const AssessmentPage = ({ route }: AssessmentPageProps) => {
  const jwt = route.params.jwt;
  const conventionAccess = getConventionAccessFromJwt(jwt);
  const conventionId: ConventionId | undefined =
    conventionAccess?.conventionId ?? route.params.conventionId;

  if (!conventionId) throw frontErrors.generic.pageNotFound();

  return (
    <AssessmentContent
      jwt={jwt}
      conventionId={conventionId}
      conventionRole={conventionAccess?.role}
    />
  );
};
