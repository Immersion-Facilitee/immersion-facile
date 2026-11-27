import {
  type AppSupportedJwtPayload,
  type ConventionActorRole,
  type ConventionId,
  type ConventionSupportedJwt,
  decodeMagicLinkJwtWithoutSignatureCheck,
  type frontRoutes,
  isConventionJwtPayload,
  isOtpJwtPayload,
  type OtpJwt,
} from "shared";
import { useAppSelector } from "src/app/hooks/reduxHooks";
import { authSelectors } from "src/core-logic/domain/auth/auth.selectors";
import type { Route } from "type-route";

export type ConventionAccess = {
  kind: "otp" | "convention";
  conventionId: ConventionId;
  role: ConventionActorRole;
};

export const getConventionAccessFromJwt = (
  jwt: ConventionSupportedJwt,
): ConventionAccess | undefined => {
  const payload =
    decodeMagicLinkJwtWithoutSignatureCheck<AppSupportedJwtPayload>(jwt);

  if (isOtpJwtPayload(payload))
    return {
      kind: "otp",
      conventionId: payload.subject.conventionId,
      role: payload.subject.role,
    };

  if (isConventionJwtPayload(payload))
    return {
      kind: "convention",
      conventionId: payload.applicationId,
      role: payload.role,
    };

  return undefined;
};

export const isOtpJwt = (jwt: ConventionSupportedJwt): jwt is OtpJwt =>
  getConventionAccessFromJwt(jwt)?.kind === "otp";

export const useJwt = (
  route: Route<
    | typeof frontRoutes.conventionDocument
    | typeof frontRoutes.assessmentDocument
  >,
): {
  jwt: ConventionSupportedJwt | undefined;
  isJwtFromUrl: boolean;
  conventionAccess: ConventionAccess | undefined;
} => {
  const jwtQueryParam: ConventionSupportedJwt | undefined = route.params?.jwt;
  const connectedUserJwt = useAppSelector(authSelectors.connectedUserJwt);
  const jwt: ConventionSupportedJwt | undefined =
    jwtQueryParam ?? connectedUserJwt;

  return {
    jwt,
    isJwtFromUrl: jwtQueryParam !== undefined,
    conventionAccess: jwt ? getConventionAccessFromJwt(jwt) : undefined,
  };
};
