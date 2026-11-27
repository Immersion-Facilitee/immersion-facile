import type { ConventionId, frontRoutes } from "shared";
import { ConventionDocumentContent } from "src/app/components/convention/ConventionDocumentContent";
import { useJwt } from "src/app/hooks/jwt.hooks";
import { frontErrors } from "src/app/pages/error/front-errors";
import type { Route } from "type-route";

type ConventionDocumentPageProps = {
  route: Route<typeof frontRoutes.conventionDocument>;
};

export const ConventionDocumentPage = ({
  route,
}: ConventionDocumentPageProps) => {
  const { jwt, conventionAccess } = useJwt(route);
  const conventionId: ConventionId | undefined =
    route.params.conventionId ?? conventionAccess?.conventionId;

  if (!jwt || !conventionId) throw frontErrors.generic.pageNotFound();

  return (
    <ConventionDocumentContent
      jwt={jwt}
      conventionId={conventionId}
      conventionRole={conventionAccess?.role}
    />
  );
};
