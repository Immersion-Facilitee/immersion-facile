import type { ConventionId, frontRoutes } from "shared";
import { AssessmentDocumentContent } from "src/app/components/assessment/AssessmentDocumentContent";
import { useJwt } from "src/app/hooks/jwt.hooks";
import { frontErrors } from "src/app/pages/error/front-errors";
import type { Route } from "type-route";

type AssessmentDocumentPageProps = {
  route: Route<typeof frontRoutes.assessmentDocument>;
};

export const AssessmentDocumentPage = ({
  route,
}: AssessmentDocumentPageProps) => {
  const { jwt, isJwtFromUrl, conventionAccess } = useJwt(route);
  const conventionId: ConventionId | undefined =
    conventionAccess?.conventionId ?? route.params.conventionId;

  if (!jwt || !conventionId) throw frontErrors.generic.pageNotFound();

  return (
    <AssessmentDocumentContent
      jwt={jwt}
      conventionId={conventionId}
      conventionRole={conventionAccess?.role}
      isAccessedWithJwtInUrl={isJwtFromUrl}
    />
  );
};
