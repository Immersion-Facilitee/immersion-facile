import MockAdapter from "axios-mock-adapter";
import {
  type AbsoluteUrl,
  ConventionDtoBuilder,
  type ConventionReadDto,
  expectToEqual,
  makeEmptyLastReminders,
  type SubscriptionParams,
} from "shared";
import { AppConfig } from "../../../../config/bootstrap/appConfig";

import { toPartnerAgencyKind } from "../../../../utils/agency";
import { makeAxiosInstances } from "../../../../utils/axiosUtils";
import type { ConventionUpdatedSubscriptionCallbackBody } from "../ports/SubscribersGateway";
import { HttpSubscribersGateway } from "./HttpSubscribersGateway";

describe("HttpSubscribersGateway", () => {
  let httpSubscribersGateway: HttpSubscribersGateway;
  let mock: MockAdapter;

  const conventionReadDto: ConventionReadDto = {
    ...new ConventionDtoBuilder().build(),
    agencyName: "Agence de test",
    agencyDepartment: "75",
    agencyContactEmail: "contact@mail.com",
    agencyKind: "mission-locale",
    agencySiret: "11112222000033",
    agencyValidationSteps: "validator-only",
    agencyRefersTo: undefined,
    assessment: null,
    isEstablishmentBanned: false,
    lastReminders: makeEmptyLastReminders(),
  };

  const { agencyKind, agencyRefersTo, ...conventionWithoutAgencyKinds } =
    conventionReadDto;

  const subscriptionBody: ConventionUpdatedSubscriptionCallbackBody = {
    payload: {
      convention: {
        ...conventionWithoutAgencyKinds,
        agencyKind: toPartnerAgencyKind(agencyKind),
        ...(agencyRefersTo
          ? {
              agencyRefersTo: {
                ...agencyRefersTo,
                kind: toPartnerAgencyKind(agencyRefersTo.kind),
              },
            }
          : {}),
      },
    },
    subscribedEvent: "convention.updated",
  };

  const makeSubscriptionParams = (
    callbackUrl: AbsoluteUrl,
  ): SubscriptionParams => ({
    callbackUrl,
    callbackHeaders: {
      authorization: "my-cb-auth-header",
    },
  });

  beforeEach(() => {
    const config = AppConfig.createFromEnv();
    const { axiosWithoutValidateStatus } = makeAxiosInstances(
      config.externalAxiosTimeout,
    );
    httpSubscribersGateway = new HttpSubscribersGateway(
      axiosWithoutValidateStatus,
    );
    mock = new MockAdapter(axiosWithoutValidateStatus);
  });

  it("send notification", async () => {
    const callbackUrl = "https://jsonplaceholder.typicode.com/posts";

    const response = await httpSubscribersGateway.notify(
      subscriptionBody,
      makeSubscriptionParams(callbackUrl),
    );

    expectToEqual(response, {
      callbackUrl,
      status: 201,
      title: "Partner subscription notified successfully",
      body: { success: true },
    });
  });

  it("throws error axios timeout", async () => {
    const callbackUrl = "https://fake-callback-url.fr";

    mock.onPost(callbackUrl).timeout();

    const response = await httpSubscribersGateway.notify(
      subscriptionBody,
      makeSubscriptionParams(callbackUrl),
    );

    expectToEqual(response, {
      callbackUrl,
      status: undefined,
      title: "Partner subscription errored",
      subscriberErrorFeedback: {
        message: "timeout of 0ms exceeded",
        error: new Error("timeout of 0ms exceeded"),
      },
      body: undefined,
    });
  });

  it("consumer api returns an string error", async () => {
    const callbackUrl = "https://fake-callback-url.fr";

    mock.onPost(callbackUrl).reply(500, "Custom server error");

    const response = await httpSubscribersGateway.notify(
      subscriptionBody,
      makeSubscriptionParams(callbackUrl),
    );

    expectToEqual(response, {
      callbackUrl,
      status: 500,
      title: "Partner subscription errored",
      subscriberErrorFeedback: {
        message: "Custom server error",
        error: new Error("Request failed with status code 500"),
      },
      body: undefined,
    });
  });

  it("consumer api returns an object error with message property", async () => {
    const callbackUrl = "https://fake-callback-url.fr";

    mock.onPost(callbackUrl).reply(500, { message: "Custom server error" });

    const response = await httpSubscribersGateway.notify(
      subscriptionBody,
      makeSubscriptionParams(callbackUrl),
    );

    expectToEqual(response, {
      callbackUrl,
      status: 500,
      title: "Partner subscription errored",
      subscriberErrorFeedback: {
        message: "Custom server error",
        error: new Error("Request failed with status code 500"),
      },
      body: undefined,
    });
  });

  it("consumer api returns an object error with no message property", async () => {
    const callbackUrl = "https://fake-callback-url.fr";

    mock.onPost(callbackUrl).reply(500, { msg: "Custom server error" });

    const response = await httpSubscribersGateway.notify(
      subscriptionBody,
      makeSubscriptionParams(callbackUrl),
    );

    expectToEqual(response, {
      callbackUrl,
      status: 500,
      title: "Partner subscription errored",
      subscriberErrorFeedback: {
        message: "Pas d'informations mais des données techniques disponibles",
        error: new Error("Request failed with status code 500"),
      },
      body: undefined,
    });
  });

  it("consumer api returns no response body", async () => {
    const callbackUrl = "https://fake-callback-url.fr";

    mock.onPost(callbackUrl).reply(500);

    const response = await httpSubscribersGateway.notify(
      subscriptionBody,
      makeSubscriptionParams(callbackUrl),
    );

    expectToEqual(response, {
      callbackUrl,
      status: 500,
      title: "Partner subscription errored",
      subscriberErrorFeedback: {
        message: "Pas d'informations mais des données techniques disponibles",
        error: new Error("Request failed with status code 500"),
      },
      body: undefined,
    });
  });
});
