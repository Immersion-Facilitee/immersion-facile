import { expectToEqual } from "../test.helpers";
import {
  makeBooleanFeatureFlag,
  makeTextImageAndRedirectFeatureFlag,
  makeTextWithSeverityFeatureFlag,
} from "./featureFlags.dto";

describe("feature flag utils tests", () => {
  it("should return a boolean feature flag", () => {
    const flag = makeBooleanFeatureFlag(true);
    expect(flag).toEqual({
      isActive: true,
      kind: "boolean",
    });
  });

  it("should return a text feature flag", () => {
    const flag = makeTextWithSeverityFeatureFlag(true, {
      message: "Maintenance message",
      severity: "warning",
    });
    expectToEqual(flag, {
      isActive: true,
      kind: "textWithSeverity",
      value: {
        message: "Maintenance message",
        severity: "warning",
      },
    });
  });

  it("should return a textImageAndRedirect feature flag", () => {
    const flag = makeTextImageAndRedirectFeatureFlag(true, {
      message: "yolo",
      imageUrl: "http://image.url",
      redirectUrl: "https://redirect.url",
      imageAlt: "YoloAlt",
      overtitle: "overtitle",
      title: "title",
    });
    expect(flag).toEqual({
      isActive: true,
      kind: "textImageAndRedirect",
      value: {
        message: "yolo",
        imageUrl: "http://image.url",
        redirectUrl: "https://redirect.url",
        imageAlt: "YoloAlt",
        overtitle: "overtitle",
        title: "title",
      },
    });
  });
});
