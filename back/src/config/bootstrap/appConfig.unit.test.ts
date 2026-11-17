import { expectToEqual } from "shared";
import { AppConfig } from "./appConfig";

const createAppConfig = (configParams: any): AppConfig =>
  AppConfig.createFromEnv(/* readDotEnv= */ false, configParams);

describe("appConfig", () => {
  it("quarantinedTopics", () => {
    expectToEqual(createAppConfig({}).quarantinedTopics, []);
    expectToEqual(
      createAppConfig({ QUARANTINED_TOPICS: "" }).quarantinedTopics,
      [],
    );
    expectToEqual(
      createAppConfig({ QUARANTINED_TOPICS: ",,," }).quarantinedTopics,
      [],
    );
    expectToEqual(
      createAppConfig({
        QUARANTINED_TOPICS: "ConventionRejected,AgencyActivated",
      }).quarantinedTopics,
      ["ConventionRejected", "AgencyActivated"],
    );
  });
});
