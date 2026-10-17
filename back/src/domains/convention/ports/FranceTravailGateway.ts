import type { SubscriberErrorFeedback } from "shared";
import type { AccessTokenResponse } from "../../../config/bootstrap/appConfig";
import type { BroadcastPayload } from "../use-cases/broadcast/broadcastConvention.dto";

// This is an interface contract with France Travail (conventions broadcast).
// ! Beware of NOT breaking contract ! !
// Doc is here : https://pad.incubateur.net/6p38o0mNRfmc8WuJ77Xr0w?view

type FranceTravailBroadcastSuccessResponse = {
  status: 200 | 201 | 204;
  body: unknown;
};
type FranceTravailBroadcastErrorResponse = {
  status: Exclude<number, 200 | 201>;
  subscriberErrorFeedback: SubscriberErrorFeedback;
  body: unknown;
};

export type FranceTravailBroadcastResponse =
  | FranceTravailBroadcastSuccessResponse
  | FranceTravailBroadcastErrorResponse;

export interface FranceTravailGateway {
  notifyOnConventionUpdated: (
    params: BroadcastPayload,
  ) => Promise<FranceTravailBroadcastResponse>;

  getAccessToken: (scope: string) => Promise<AccessTokenResponse>;
}

export const isBroadcastSuccessResponse = (
  response: FranceTravailBroadcastResponse,
): response is FranceTravailBroadcastSuccessResponse =>
  [200, 201, 204].includes(response.status);
