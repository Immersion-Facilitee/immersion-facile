import { MainWrapper } from "react-design-system";
import type { ConventionId, frontRoutes } from "shared";
import type { JwtKindProps } from "src/app/components/admin/conventions/ConventionManageActions";
import { WithFeedbackReplacer } from "src/app/components/feedback/WithFeedbackReplacer";
import { HeaderFooterLayout } from "src/app/components/layout/HeaderFooterLayout";
import { getConventionAccessFromJwt } from "src/app/hooks/jwt.hooks";
import { useAppSelector } from "src/app/hooks/reduxHooks";
import { authSelectors } from "src/core-logic/domain/auth/auth.selectors";
import { match } from "ts-pattern";
import type { Route } from "type-route";
import { ConventionManageContent } from "../../components/admin/conventions/ConventionManageContent";

type ConventionManagePageProps = {
  route:
    | Route<typeof frontRoutes.manageConvention>
    | Route<typeof frontRoutes.adminConventionDetail>;
};

type ConventionManageParams = {
  jwtParams: JwtKindProps;
  conventionId: ConventionId;
};

export const ConventionManagePage = ({ route }: ConventionManagePageProps) => {
  const connectedUserJwt = useAppSelector(authSelectors.connectedUserJwt);

  const manageParams: ConventionManageParams | undefined = match(route)
    .with(
      {
        name: "adminConventionDetail",
      },
      (route): ConventionManageParams | undefined =>
        connectedUserJwt
          ? {
              jwtParams: {
                jwt: connectedUserJwt,
                kind: "connected user backoffice",
              },
              conventionId: route.params.conventionId,
            }
          : undefined,
    )
    .with(
      {
        name: "manageConvention",
      },
      (route): ConventionManageParams | undefined => {
        const jwt = route.params.jwt;
        const conventionAccess = getConventionAccessFromJwt(jwt);
        if (!conventionAccess) return undefined;
        return {
          jwtParams: conventionAccess.isVisitorOtp
            ? { jwt, kind: "visitor session" }
            : { jwt, kind: "convention" },
          conventionId: conventionAccess.conventionId,
        };
      },
    )
    .exhaustive();

  if (!manageParams) return null;

  const { jwtParams, conventionId } = manageParams;

  return (
    <HeaderFooterLayout>
      <MainWrapper layout="default" vSpacing={8}>
        <WithFeedbackReplacer topic="transfer-convention-to-agency">
          <ConventionManageContent
            jwtParams={jwtParams}
            conventionId={conventionId}
          />
        </WithFeedbackReplacer>
      </MainWrapper>
    </HeaderFooterLayout>
  );
};
