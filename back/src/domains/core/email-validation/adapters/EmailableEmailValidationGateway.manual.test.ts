import { expectToEqual, type ValidateEmailFeedback } from "shared";
import { createFetchSharedClient } from "shared-routes/fetch";
import { AppConfig } from "../../../../config/bootstrap/appConfig";
import { withNoCache } from "../../caching-gateway/adapters/withNoCache";
import type { EmailValidationGetaway } from "../ports/EmailValidationGateway";
import { EmailableEmailValidationGateway } from "./EmailableEmailValidationGateway";
import { emailableValidationRoutes } from "./EmailableEmailValidationGateway.routes";

describe("EmailableEmailValidationGateway", () => {
  let emailableEmailValidationGateway: EmailValidationGetaway;

  beforeEach(() => {
    emailableEmailValidationGateway = new EmailableEmailValidationGateway(
      createFetchSharedClient(emailableValidationRoutes, fetch, {
        // biome-ignore lint/suspicious/noConsole: debug purpose
        onResponseSideEffect: console.log,
      }),
      AppConfig.createFromEnv().emailableApiKey,
      withNoCache,
    );
  });

  describe("Emailable validateEmail", () => {
    const candidates: {
      candidateEmail: string;
      expectedStatus: ValidateEmailFeedback | Error;
    }[] = [
      {
        candidateEmail: "enguerran.weiss@beta.gouv.fr",
        expectedStatus: {
          status: "accepted_email",
          proposal: null,
        },
      },
      {
        candidateEmail: "enguerranweiss@beta.gouv.fr",
        expectedStatus: {
          status: "rejected_email",
          proposal: null,
        },
      },
      {
        candidateEmail: "this-email-doesnt-exist@gamil.com",
        expectedStatus: {
          status: "rejected_email",
          proposal: "this-email-doesnt-exist@gmail.com",
        },
      },
    ];

    it.each(candidates)(
      "Candidate email '$candidateEmail' should match expected given status",
      async ({ candidateEmail, expectedStatus }) => {
        expectToEqual(
          await emailableEmailValidationGateway.validateEmail(candidateEmail),
          expectedStatus,
        );
      },
      10000,
    );
  });
});
