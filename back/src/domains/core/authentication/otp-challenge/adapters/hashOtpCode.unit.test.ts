import { makeHashOtpCode } from "./hashOtpCode";

describe("hashOtpCode", () => {
  const hashOtpCode = makeHashOtpCode("test-otp-code-hmac-secret");

  it("is deterministic for the same challenge and code", () => {
    expect(
      hashOtpCode({ otpChallengeId: "challenge-1", otpCode: "123456" }),
    ).toBe(hashOtpCode({ otpChallengeId: "challenge-1", otpCode: "123456" }));
  });

  it("differs for the same code on another challenge", () => {
    expect(
      hashOtpCode({ otpChallengeId: "challenge-1", otpCode: "123456" }),
    ).not.toBe(
      hashOtpCode({ otpChallengeId: "challenge-2", otpCode: "123456" }),
    );
  });

  it("differs for the same challenge and code with another secret", () => {
    expect(
      hashOtpCode({ otpChallengeId: "challenge-1", otpCode: "123456" }),
    ).not.toBe(
      makeHashOtpCode("other-secret")({
        otpChallengeId: "challenge-1",
        otpCode: "123456",
      }),
    );
  });
});
