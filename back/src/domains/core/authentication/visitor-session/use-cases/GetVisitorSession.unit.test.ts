import {
  ConventionDtoBuilder,
  errors,
  expectPromiseToFailWithError,
  expectToEqual,
  VisitorSessionDtoBuilder,
} from "shared";
import { makeEmailHash } from "../../../../../utils/jwt";
import { CustomTimeGateway } from "../../../time-gateway/adapters/CustomTimeGateway";
import {
  createInMemoryUow,
  type InMemoryUnitOfWork,
} from "../../../unit-of-work/adapters/createInMemoryUow";
import { InMemoryUowPerformer } from "../../../unit-of-work/adapters/InMemoryUowPerformer";
import {
  type GetVisitorSession,
  makeGetVisitorSession,
} from "./GetVisitorSession";

describe("GetVisitorSession", () => {
  const now = new Date("2024-04-28T11:00:00.000Z");
  const convention = new ConventionDtoBuilder().build();
  const visitorSession = new VisitorSessionDtoBuilder()
    .withSubject({
      conventionId: convention.id,
      role: "establishment-tutor",
      emailHash: makeEmailHash(convention.establishmentTutor.email),
    })
    .withExpiresAt("2024-04-28T12:00:00.000Z")
    .build();
  const getVisitorSessionQuery = {
    purpose: "manageConvention" as const,
    conventionId: convention.id,
  };
  const visitorSessionPayload = { sessionId: visitorSession.id };

  let uow: InMemoryUnitOfWork;
  let getVisitorSession: GetVisitorSession;

  beforeEach(() => {
    uow = createInMemoryUow();
    uow.conventionRepository.setConventions([convention]);
    getVisitorSession = makeGetVisitorSession({
      uowPerformer: new InMemoryUowPerformer(uow),
      deps: {
        timeGateway: new CustomTimeGateway(now),
      },
    });
  });

  it("returns the visitor session", async () => {
    uow.visitorSessionRepository.visitorSessions = [visitorSession];

    const result = await getVisitorSession.execute(
      getVisitorSessionQuery,
      visitorSessionPayload,
    );

    expectToEqual(result, {
      conventionId: convention.id,
      role: "establishment-tutor",
      purpose: "manageConvention",
      expiresAt: visitorSession.expiresAt,
    });
  });

  describe("Wrong path", () => {
    it("throws unauthorized if the session does not exist", async () => {
      await expectPromiseToFailWithError(
        getVisitorSession.execute(
          getVisitorSessionQuery,
          visitorSessionPayload,
        ),
        errors.visitorSession.unauthorized(),
      );
    });

    it("throws unauthorized if the session is revoked", async () => {
      uow.visitorSessionRepository.visitorSessions = [
        new VisitorSessionDtoBuilder(visitorSession)
          .withRevokedAt(now.toISOString())
          .build(),
      ];

      await expectPromiseToFailWithError(
        getVisitorSession.execute(
          getVisitorSessionQuery,
          visitorSessionPayload,
        ),
        errors.visitorSession.unauthorized(),
      );
    });

    it("throws unauthorized if the session is expired", async () => {
      uow.visitorSessionRepository.visitorSessions = [
        new VisitorSessionDtoBuilder(visitorSession)
          .withExpiresAt(now.toISOString())
          .build(),
      ];

      await expectPromiseToFailWithError(
        getVisitorSession.execute(
          getVisitorSessionQuery,
          visitorSessionPayload,
        ),
        errors.visitorSession.unauthorized(),
      );
    });

    it("throws unauthorized if the conventionId does not match the session", async () => {
      uow.visitorSessionRepository.visitorSessions = [visitorSession];

      await expectPromiseToFailWithError(
        getVisitorSession.execute(
          {
            ...getVisitorSessionQuery,
            conventionId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          },
          visitorSessionPayload,
        ),
        errors.visitorSession.unauthorized(),
      );
    });

    it("throws forbidden if the email hash no longer matches the convention actor", async () => {
      uow.visitorSessionRepository.visitorSessions = [visitorSession];
      uow.conventionRepository.setConventions([
        new ConventionDtoBuilder(convention)
          .withEstablishmentTutorEmail("new-tutor@email.fr")
          .build(),
      ]);

      await expectPromiseToFailWithError(
        getVisitorSession.execute(
          getVisitorSessionQuery,
          visitorSessionPayload,
        ),
        errors.convention.forbiddenMissingRightsEmailHash({
          conventionId: convention.id,
          role: "establishment-tutor",
          emailHash: visitorSession.subject.emailHash,
        }),
      );
    });
  });
});
