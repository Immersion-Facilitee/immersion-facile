import { type AbsoluteUrl, errors, queryParamsAsString } from "shared";
import type {
  GetAccessTokenParams,
  GetAccessTokenResult,
  GetLoginUrlParams,
  GetLogoutUrlParams,
} from "../../../connected-user/port/OAuthGateway";
import type { AccessTokenDto } from "../../dto/AccessToken.dto";
import type { FtConnectAdvisorDto } from "../../dto/FtConnectAdvisor.dto";
import type { FtConnectUserDto } from "../../dto/FtConnectUserDto";
import type { FtConnectGateway } from "../../port/FtConnectGateway";

export class InMemoryFtConnectGateway implements FtConnectGateway {
  #accessToken: GetAccessTokenResult | undefined = undefined;

  #advisors: FtConnectAdvisorDto[] = [];

  #user: FtConnectUserDto | undefined = undefined;

  #userAndAdvisorsError: Error | undefined = undefined;

  public async getLoginUrl(params: GetLoginUrlParams): Promise<AbsoluteUrl> {
    return `https://fake-ft-connect-login-url?${queryParamsAsString(params)}`;
  }

  public async getAccessToken(
    _: GetAccessTokenParams,
  ): Promise<GetAccessTokenResult> {
    if (this.#accessToken) return this.#accessToken;
    throw errors.generic.fakeError("No access token provided (in memory)");
  }

  public async getUserAndAdvisors(_accessToken: AccessTokenDto): Promise<
    | {
        user: FtConnectUserDto;
        advisors: FtConnectAdvisorDto[];
      }
    | undefined
  > {
    if (this.#userAndAdvisorsError) throw this.#userAndAdvisorsError;
    if (!this.#user) return undefined;
    return {
      advisors: this.#advisors,
      user: this.#user,
    };
  }

  public async getLogoutUrl({
    state: _,
    idToken,
  }: GetLogoutUrlParams): Promise<AbsoluteUrl> {
    return `https://fake-ft-connect-logout-url?${queryParamsAsString({
      id_token_hint: idToken,
      redirect_uri: "fake-redirect-uri",
    })}`;
  }

  public setAccessTokenResult(accessTokenResult: GetAccessTokenResult) {
    this.#accessToken = accessTokenResult;
  }

  public setAdvisors(advisors: FtConnectAdvisorDto[]) {
    this.#advisors = advisors;
  }

  public setUserAndAdvisorsError(error: Error): void {
    this.#userAndAdvisorsError = error;
  }

  // test
  public setUser(user: FtConnectUserDto | undefined) {
    this.#user = user;
  }
}
