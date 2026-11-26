import type { Builder, ProcessEnv } from "shared";
import { AppConfig } from "../config/bootstrap/appConfig";

const defaultConfigParams = {
  DOMAIN: "localhost",
  NODE_ENV: "test",
  LA_BONNE_BOITE_GATEWAY: "IN_MEMORY",
  PASS_EMPLOI_GATEWAY: "IN_MEMORY",
  POLE_EMPLOI_GATEWAY: "IN_MEMORY",

  // Test-only keys, do not use in production environments!
  JWT_PRIVATE_KEY:
    "-----BEGIN EC PRIVATE KEY-----\nMHcCAQEEIEUlP92zWRVJTz5bxyP57npwsPCi0lh5C/uxX5ZuJn6OoAoGCCqGSM49\nAwEHoUQDQgAEF0O2Llia9pN283L4DYrVUgIQrqPduq+gkqPLDn9OoVYcbRdeKqCe\n53195KiTm0aSOw/mgml9SVt+Rs4t60Ubkw==\n-----END EC PRIVATE KEY-----",
  JWT_PUBLIC_KEY:
    "-----BEGIN PUBLIC KEY-----\nMFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEF0O2Llia9pN283L4DYrVUgIQrqPd\nuq+gkqPLDn9OoVYcbRdeKqCe53195KiTm0aSOw/mgml9SVt+Rs4t60Ubkw==\n-----END PUBLIC KEY-----",
  API_JWT_PRIVATE_KEY:
    "-----BEGIN EC PRIVATE KEY-----\nMHcCAQEEIPnK7kOKC6VqJwmsXCcCgNfVEAMyt0IFm68g/dwg3/iVoAoGCCqGSM49\nAwEHoUQDQgAEXNo97BD4w2huuAYsmINnn/+TPolxYUexkcD49YyxsjJPA2d91B2r\nDzteUKnEsloNYDTeYW88oLPMdgmbzm+sQg==\n-----END EC PRIVATE KEY-----",
  API_JWT_PUBLIC_KEY:
    "-----BEGIN PUBLIC KEY-----\nMFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEXNo97BD4w2huuAYsmINnn/+TPolx\nYUexkcD49YyxsjJPA2d91B2rDzteUKnEsloNYDTeYW88oLPMdgmbzm+sQg==\n-----END PUBLIC KEY-----",
  OTP_CODE_HMAC_SECRET:
    "221eb0fd65081da2029f75dbf635a38b1c62c48bcb377debdd2efe55aa10baed",

  BACKOFFICE_USERNAME: "e2e_tests",
  BACKOFFICE_PASSWORD: "e2e",
  ADMIN_EMAIL: "myAdmin@mail.com",
  REPORTING_GATEWAY: "EXCEL",
  STORAGE_ROOT: "NOT PROVIDED",
  CORS_ALLOWED_ORIGINS: "http://localhost:3000",
};
// See "Working with AppConfig" in back/README.md for more details.
export class AppConfigBuilder implements Builder<AppConfig> {
  readonly #configParams: ProcessEnv;

  constructor(configParams: ProcessEnv = {}) {
    this.#configParams = { ...defaultConfigParams, ...configParams };
  }

  public build() {
    return AppConfig.createFromEnv(/* readDotEnv= */ false, this.#configParams);
  }

  public withAuthorizedApiKeyIds(authorizedApiKeyIds: string[]) {
    return new AppConfigBuilder({
      ...this.#configParams,
      AUTHORIZED_API_KEY_IDS: authorizedApiKeyIds.join(","),
    });
  }

  public withConfigParams(configParams: ProcessEnv) {
    return new AppConfigBuilder({
      ...this.#configParams,
      ...configParams,
    });
  }

  public withRepositories(REPOSITORIES: string) {
    return new AppConfigBuilder({
      ...this.#configParams,
      REPOSITORIES,
    });
  }

  public withTestPresetPreviousKeys() {
    return new AppConfigBuilder({
      ...this.#configParams,
      JWT_PREVIOUS_PUBLIC_KEY:
        "-----BEGIN PUBLIC KEY-----\nMFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEXM1fwl4kRy3ivmtJt2CdLTDx/HgS\nOeLqLQ+q+pqjLnsCJaQtiiy7kceujtxAhZcJBSh0QFBoq8JsuaZxNrrBpg==\n-----END PUBLIC KEY-----",

      JWT_PREVIOUS_PRIVATE_KEY:
        "-----BEGIN EC PRIVATE KEY-----\nMHcCAQEEIOgvkzcTPgVdse0fey6Lix4M6mywCpuWbdjFVj23OA2YoAoGCCqGSM49\nAwEHoUQDQgAEXM1fwl4kRy3ivmtJt2CdLTDx/HgSOeLqLQ+q+pqjLnsCJaQtiiy7\nkceujtxAhZcJBSh0QFBoq8JsuaZxNrrBpg==\n-----END EC PRIVATE KEY-----",
    });
  }
}
