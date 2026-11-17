import Bottleneck from "bottleneck";
import type { ValidateEmailFeedback } from "shared";
import type { HttpClient } from "shared-routes";
import { createLogger } from "../../../../utils/logger";
import type { WithCache } from "../../caching-gateway/port/WithCache";
import type { EmailValidationGetaway } from "../ports/EmailValidationGateway";
import type { EmailableApiKey } from "./EmailableEmailValidationGateway.dto";
import {
  type EmailableValidationRoutes,
  emailableValidationRoutes,
} from "./EmailableEmailValidationGateway.routes";

const logger = createLogger(__filename);

const emailableVerifyEmailMaxRatePerSeconds = 25;

const sevenDaysInHours = 24 * 7;

export class EmailableEmailValidationGateway implements EmailValidationGetaway {
  #limiter = new Bottleneck({
    reservoir: emailableVerifyEmailMaxRatePerSeconds,
    reservoirRefreshInterval: 1000, // number of ms
    reservoirRefreshAmount: emailableVerifyEmailMaxRatePerSeconds,
  });

  constructor(
    private readonly httpClient: HttpClient<EmailableValidationRoutes>,
    private readonly emailableApiKey: EmailableApiKey,
    private readonly withCache: WithCache,
  ) {}

  public async validateEmail(
    emailInParams: string,
  ): Promise<ValidateEmailFeedback> {
    const sanitizedEmail = emailInParams.toLowerCase().trim();

    return this.withCache({
      logParams: {
        partner: "emailable",
        route: emailableValidationRoutes.validateEmail,
      },
      overrideCacheDurationInHours: sevenDaysInHours,
      getCacheKey: (email) => `emailable_${email}`,
      cb: (email) =>
        this.#limiter.schedule(() =>
          this.httpClient
            .validateEmail({
              queryParams: {
                email,
                api_key: this.emailableApiKey,
              },
            })
            .then((response): ValidateEmailFeedback => {
              if (response.status === 200)
                return {
                  status: response.body.reason ?? "unexpected_error",
                  proposal: response.body.did_you_mean ?? null,
                };

              return {
                status: "service_unavailable",
                proposal: null,
              };
            })
            .catch((error): ValidateEmailFeedback => {
              logger.error({
                error,
                message: `validateEmail => Error while calling emailable API : ${error.message}`,
              });

              return {
                status: "service_unavailable",
                proposal: null,
              };
            }),
        ),
    })(sanitizedEmail);
  }
}
