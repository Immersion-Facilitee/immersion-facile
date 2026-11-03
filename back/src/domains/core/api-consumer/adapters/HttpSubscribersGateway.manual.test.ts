import MockAdapter from "axios-mock-adapter";
import {
  type AbsoluteUrl,
  AgencyDtoBuilder,
  ConventionDtoBuilder,
  expectToEqual,
  makeEmptyLastReminders,
  type SubscriptionParams,
} from "shared";
import { AppConfig } from "../../../../config/bootstrap/appConfig";

import { makeAxiosInstances } from "../../../../utils/axiosUtils";
import { toBroadcastConvention } from "../../../convention/use-cases/broadcast/toBroadcastConvention";
import type { ConventionUpdatedSubscriptionCallbackBody } from "../ports/SubscribersGateway";
import { HttpSubscribersGateway } from "./HttpSubscribersGateway";

describe("HttpSubscribersGateway", () => {
  let httpSubscribersGateway: HttpSubscribersGateway;
  let mock: MockAdapter;

  const agency = new AgencyDtoBuilder()
    .withName("Agence de test")
    .withKind("mission-locale")
    .withAgencySiret("11112222000033")
    .withCodeSafir(null)
    .withValidatorEmails(["validator@mail.com"])
    .build();

  const convention = new ConventionDtoBuilder().build();

  const subscriptionBody: ConventionUpdatedSubscriptionCallbackBody = {
    payload: {
      convention: toBroadcastConvention(
        {
          ...convention,
          agencyName: agency.name,
          agencyDepartment: agency.address.departmentCode,
          agencyKind: agency.kind,
          agencySiret: agency.agencySiret,
          agencyContactEmail: agency.contactEmail,
          agencyValidationSteps: "validator-only",
          assessment: null,
          isEstablishmentBanned: false,
          lastReminders: makeEmptyLastReminders(),
        },
        agency,
        null,
      ),
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
