import {
  ConventionDtoBuilder,
  type ConventionId,
  displayRouteName,
  errors,
  expectHttpResponseToEqual,
  type OtpChallengeRoutes,
  otpChallengeRoutes,
} from "shared";
import type { HttpClient } from "shared-routes";
import { createSupertestSharedClient } from "shared-routes/supertest";
import { invalidTokenMessage } from "../../../../config/bootstrap/connectedUserAuthMiddleware";
import type { GenerateVisitorOtpJwt } from "../../../../domains/core/jwt";
import type { InMemoryUnitOfWork } from "../../../../domains/core/unit-of-work/adapters/createInMemoryUow";
import { buildTestApp } from "../../../../utils/buildTestApp";
import {
  createVisitorOtpJwtPayload,
  makeEmailHash,
} from "../../../../utils/jwt";

describe("otp challenge router", () => {
  const convention = new ConventionDtoBuilder()
    .withBeneficiaryEmail("beneficiary@email.fr")
    .withBeneficiaryPhone("+33612345678")
    .build();

  const visitorOtpJwtPayload = createVisitorOtpJwtPayload({
    purpose: "manageConvention",
    subject: {
      conventionId: convention.id,
      role: "beneficiary",
      emailHash: makeEmailHash(convention.signatories.beneficiary.email),
    },
    now: new Date(),
  });

  let httpClient: HttpClient<OtpChallengeRoutes>;
  let generateVisitorOtpJwt: GenerateVisitorOtpJwt;
  let inMemoryUow: InMemoryUnitOfWork;

  beforeEach(async () => {
    const testApp = await buildTestApp();
    generateVisitorOtpJwt = testApp.generateVisitorOtpJwt;
    inMemoryUow = testApp.inMemoryUow;
    httpClient = createSupertestSharedClient(
      otpChallengeRoutes,
      testApp.request,
    );
    inMemoryUow.conventionRepository.setConventions([convention]);
  });

  describe(`${displayRouteName(otpChallengeRoutes.getMaskedOtpRecipient)}`, () => {
    it("200 - returns the masked email and phone of the convention actor", async () => {
      const response = await httpClient.getMaskedOtpRecipient({
        headers: { authorization: generateVisitorOtpJwt(visitorOtpJwtPayload) },
      });

      expectHttpResponseToEqual(response, {
        status: 200,
        body: {
          maskedEmail: "b**********@email.fr",
          maskedPhone: "06******78",
        },
      });
    });

    it("401 - invalid JWT", async () => {
      const response = await httpClient.getMaskedOtpRecipient({
        headers: { authorization: "invalid-jwt" },
      });

      expectHttpResponseToEqual(response, {
        status: 401,
        body: { status: 401, message: invalidTokenMessage },
      });
    });

    it("403 - email hash does not match the actor in the convention", async () => {
      const emailHash = makeEmailHash(
        convention.signatories.establishmentRepresentative.email,
      );

      const response = await httpClient.getMaskedOtpRecipient({
        headers: {
          authorization: generateVisitorOtpJwt(
            createVisitorOtpJwtPayload({
              purpose: "manageConvention",
              subject: {
                conventionId: convention.id,
                role: "beneficiary",
                emailHash,
              },
              now: new Date(),
            }),
          ),
        },
      });

      expectHttpResponseToEqual(response, {
        status: 403,
        body: {
          status: 403,
          message: errors.convention.forbiddenMissingRightsEmailHash({
            conventionId: convention.id,
            role: "beneficiary",
            emailHash,
          }).message,
        },
      });
    });

    it("404 - convention not found", async () => {
      const unknownConventionId: ConventionId =
        "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

      const response = await httpClient.getMaskedOtpRecipient({
        headers: {
          authorization: generateVisitorOtpJwt(
            createVisitorOtpJwtPayload({
              purpose: "manageConvention",
              subject: {
                conventionId: unknownConventionId,
                role: "beneficiary",
                emailHash: makeEmailHash(
                  convention.signatories.beneficiary.email,
                ),
              },
              now: new Date(),
            }),
          ),
        },
      });

      expectHttpResponseToEqual(response, {
        status: 404,
        body: {
          status: 404,
          message: errors.convention.notFound({
            conventionId: unknownConventionId,
          }).message,
        },
      });
    });
  });
});
