import {
  ConventionDtoBuilder,
  errors,
  expectPromiseToFailWithError,
  expectToEqual,
  OtpSessionDtoBuilder,
} from "shared";
import { makeEmailHash } from "../../../../../utils/jwt";
import { CustomTimeGateway } from "../../../time-gateway/adapters/CustomTimeGateway";
import {
  createInMemoryUow,
  type InMemoryUnitOfWork,
} from "../../../unit-of-work/adapters/createInMemoryUow";
import { InMemoryUowPerformer } from "../../../unit-of-work/adapters/InMemoryUowPerformer";
import { type GetOtpSession, makeGetOtpSession } from "./GetOtpSession";

describe("GetOtpSession", () => {
  const now = new Date("2024-04-28T11:00:00.000Z");
  const convention = new ConventionDtoBuilder().build();
  const otpSession = new OtpSessionDtoBuilder()
    .withSubject({
      conventionId: convention.id,
      role: "establishment-tutor",
      emailHash: makeEmailHash(convention.establishmentTutor.email),
    })
    .withExpiresAt("2024-04-28T12:00:00.000Z")
    .build();
  const getOtpSessionQuery = {
    purpose: "manageConvention" as const,
    conventionId: convention.id,
  };
  const otpSessionPayload = { sessionId: otpSession.id };

  let uow: InMemoryUnitOfWork;
  let getOtpSession: GetOtpSession;

  beforeEach(() => {
    uow = createInMemoryUow();
    uow.conventionRepository.setConventions([convention]);
    getOtpSession = makeGetOtpSession({
      uowPerformer: new InMemoryUowPerformer(uow),
      deps: {
        timeGateway: new CustomTimeGateway(now),
      },
    });
  });

  it("returns the otp session", async () => {
    uow.otpSessionRepository.otpSessions = [otpSession];

    const result = await getOtpSession.execute(
      getOtpSessionQuery,
      otpSessionPayload,
    );

    expectToEqual(result, {
      conventionId: convention.id,
      role: "establishment-tutor",
      purpose: "manageConvention",
      expiresAt: otpSession.expiresAt,
    });
  });

  describe("Wrong path", () => {
    it("throws unauthorized if the session does not exist", async () => {
      await expectPromiseToFailWithError(
        getOtpSession.execute(getOtpSessionQuery, otpSessionPayload),
        errors.otpSession.unauthorized(),
      );
    });

    it("throws unauthorized if the session is revoked", async () => {
      uow.otpSessionRepository.otpSessions = [
        new OtpSessionDtoBuilder(otpSession)
          .withRevokedAt(now.toISOString())
          .build(),
      ];

      await expectPromiseToFailWithError(
        getOtpSession.execute(getOtpSessionQuery, otpSessionPayload),
        errors.otpSession.unauthorized(),
      );
    });

    it("throws unauthorized if the session is expired", async () => {
      uow.otpSessionRepository.otpSessions = [
        new OtpSessionDtoBuilder(otpSession)
          .withExpiresAt(now.toISOString())
          .build(),
      ];

      await expectPromiseToFailWithError(
        getOtpSession.execute(getOtpSessionQuery, otpSessionPayload),
        errors.otpSession.unauthorized(),
      );
    });

    it("throws unauthorized if the conventionId does not match the session", async () => {
      uow.otpSessionRepository.otpSessions = [otpSession];

      await expectPromiseToFailWithError(
        getOtpSession.execute(
          {
            ...getOtpSessionQuery,
            conventionId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          },
          otpSessionPayload,
        ),
        errors.otpSession.unauthorized(),
      );
    });

    it("throws forbidden if the email hash no longer matches the convention actor", async () => {
      uow.otpSessionRepository.otpSessions = [otpSession];
      uow.conventionRepository.setConventions([
        new ConventionDtoBuilder(convention)
          .withEstablishmentTutorEmail("new-tutor@email.fr")
          .build(),
      ]);

      await expectPromiseToFailWithError(
        getOtpSession.execute(getOtpSessionQuery, otpSessionPayload),
        errors.convention.forbiddenMissingRightsEmailHash({
          conventionId: convention.id,
          role: "establishment-tutor",
          emailHash: otpSession.subject.emailHash,
        }),
      );
    });
  });
});
