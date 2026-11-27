import { expectToEqual } from "../test.helpers";
import { smsTemplatesByName } from "./smsTemplateByName";

describe("smsTemplatesByName", () => {
  describe("RequestOtpCode", () => {
    it("should end the sms content with the WebOTP domain", () => {
      const smsContent = smsTemplatesByName.RequestOtpCode.createContent({
        otpCode: "1234",
        domain: "immersion-facile.beta.gouv.fr",
      });

      expectToEqual(
        smsContent.split("\n").at(-1),
        "@immersion-facile.beta.gouv.fr #1234",
      );
    });
  });
});
