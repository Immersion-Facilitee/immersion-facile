import { type AbsoluteUrl, type ConnectedUser, errors } from "shared";
import { useCaseBuilder } from "../../../useCaseBuilder";
import type { OAuthGateway } from "../port/OAuthGateway";

export type GetOAuthLogoutUrl = ReturnType<typeof makeGetOAuthLogoutUrl>;

export const makeGetOAuthLogoutUrl = useCaseBuilder("GetOAuthLogoutUrl")
  .withOutput<AbsoluteUrl>()
  .withCurrentUser<ConnectedUser | undefined>()
  .withDeps<{
    proConnectOAuthGateway: OAuthGateway;
  }>()
  .build(async ({ uow, deps: { proConnectOAuthGateway }, currentUser }) => {
    if (!currentUser) throw errors.user.unauthorized();

    const ongoingOAuth = await uow.ongoingOAuthRepository.findByUserId(
      currentUser.id,
    );
    if (!ongoingOAuth) throw errors.auth.missingOAuth({});
    if (ongoingOAuth.provider !== "proConnect")
      throw errors.auth.accessTokenErrorType({
        actualType: ongoingOAuth.provider,
        expectedType: "proConnect",
      });
    if (!ongoingOAuth.idToken)
      throw errors.auth.missingIdToken(ongoingOAuth.state);
    return proConnectOAuthGateway.getLogoutUrl({
      idToken: ongoingOAuth.idToken,
      state: ongoingOAuth.state,
    });
  });
