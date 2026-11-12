import {
  type AppSupportedJwtPayload,
  type ConventionActorRole,
  type ConventionId,
  type ConventionSupportedJwt,
  decodeMagicLinkJwtWithoutSignatureCheck,
  type frontRoutes,
  type VisitorOtpJwt,
} from "shared";
import { useAppSelector } from "src/app/hooks/reduxHooks";
import { authSelectors } from "src/core-logic/domain/auth/auth.selectors";
import type { Route } from "type-route";

type ConventionAccess = {
  isVisitorOtp: boolean;
  conventionId: ConventionId;
  role: ConventionActorRole;
};

export const getConventionAccessFromJwt = (
  jwt: ConventionSupportedJwt,
): ConventionAccess | undefined => {
  const payload =
    decodeMagicLinkJwtWithoutSignatureCheck<AppSupportedJwtPayload>(jwt);

  if ("purpose" in payload)
    return {
      isVisitorOtp: true,
      conventionId: payload.subject.conventionId,
      role: payload.subject.role,
    };

  if ("applicationId" in payload)
    return {
      isVisitorOtp: false,
      conventionId: payload.applicationId,
      role: payload.role,
    };

  return undefined;
};

export const isVisitorOtpJwt = (
  jwt: ConventionSupportedJwt,
): jwt is VisitorOtpJwt =>
  getConventionAccessFromJwt(jwt)?.isVisitorOtp ?? false;

export const useJwt = (
  route: Route<
    | typeof frontRoutes.conventionDocument
    | typeof frontRoutes.assessmentDocument
  >,
): {
  jwt: ConventionSupportedJwt | undefined;
  conventionAccess: ConventionAccess | undefined;
} => {
  const jwtQueryParam: ConventionSupportedJwt | undefined = route.params?.jwt;
  const connectedUserJwt = useAppSelector(authSelectors.connectedUserJwt);
  const jwt: ConventionSupportedJwt | undefined =
    jwtQueryParam ?? connectedUserJwt;

  return {
    jwt,
    conventionAccess: jwt ? getConventionAccessFromJwt(jwt) : undefined,
  };
};
