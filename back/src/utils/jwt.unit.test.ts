import {
  currentJwtVersions,
  errors,
  expectToEqual,
  type ManageConventionSubject,
} from "shared";
import { makeGenerateJwtES256, makeVerifyJwtES256 } from "../domains/core/jwt";
import { CustomTimeGateway } from "../domains/core/time-gateway/adapters/CustomTimeGateway";
import {
  createVisitorOtpJwtPayload,
  generateES256KeyPair,
  makeThrowIfIncorrectJwt,
} from "./jwt";

describe("makeThrowIfIncorrectJwt", () => {
  const { publicKey, privateKey } = generateES256KeyPair();
  const generateJwt = makeGenerateJwtES256<"convention">(privateKey, undefined);
  const verifyJwt = makeVerifyJwtES256<"convention">(publicKey);
  const timeGateway = new CustomTimeGateway(new Date());
  const throwIfIncorrect = makeThrowIfIncorrectJwt(verifyJwt, timeGateway);

  const validPayload = {
    version: currentJwtVersions.convention,
    applicationId: "test-convention-id",
    role: "beneficiary" as const,
    emailHash: "test-hash",
  };

  it("does not throw when JWT is valid", () => {
    const validJwt = generateJwt({
      ...validPayload,
      exp: Math.floor(timeGateway.now().getTime() / 1000) + 3600,
    });

    expect(() => throwIfIncorrect(validJwt)).not.toThrow();
  });

  it("throws invalidJwt error when JWT has invalid signature", () => {
    const { privateKey: otherPrivateKey } = generateES256KeyPair();
    const otherGenerateJwt = makeGenerateJwtES256<"convention">(
      otherPrivateKey,
      undefined,
    );
    const jwtWithWrongSignature = otherGenerateJwt({
      ...validPayload,
      exp: Math.floor(timeGateway.now().getTime() / 1000) + 3600,
    });

    expect(() => throwIfIncorrect(jwtWithWrongSignature)).toThrow(
      errors.user.invalidJwt(),
    );
  });

  describe("when JWT is expired", () => {
    it("throws expiredJwt error with duration since expiry", () => {
      const expiredJwt = generateJwt({
        ...validPayload,
        exp: Math.floor(timeGateway.now().getTime() / 1000) - 3600,
      });

      expect(() => throwIfIncorrect(expiredJwt)).toThrow();

      try {
        throwIfIncorrect(expiredJwt);
      } catch (error: any) {
        expect(error.message).toContain("expiré");
        expect(error.message).toContain("depuis");
        expect(error.message).toContain("minutes");
      }
    });

    it("includes duration in French format", () => {
      const expiredJwt = generateJwt({
        ...validPayload,
        exp: Math.floor(timeGateway.now().getTime() / 1000) - 7200,
      });

      try {
        throwIfIncorrect(expiredJwt);
        fail("should have thrown");
      } catch (error: any) {
        expect(error.message).toMatch(/depuis 120 minutes/);
      }
    });
  });
});

describe("createVisitorOtpJwtPayload", () => {
  it("issues a payload without expiration", () => {
    const now = new Date("2026-01-01T00:00:00Z");
    const subject = {
      conventionId: "convention-id",
      role: "beneficiary",
      emailHash: "hash",
    } satisfies ManageConventionSubject;

    expectToEqual(
      createVisitorOtpJwtPayload({
        purpose: "manageConvention",
        subject,
        now,
      }),
      {
        purpose: "manageConvention",
        subject,
        version: currentJwtVersions.visitorOtp,
        iat: now.getTime() / 1000,
      },
    );
  });
});
