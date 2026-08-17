import type { IdToken } from "../../connected-user/entities/OngoingOAuth";

export type AccessTokenDto = {
  value: string;
  expiresIn: number;
  idToken: IdToken;
};
