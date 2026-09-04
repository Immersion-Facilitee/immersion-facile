import axios, { isAxiosError } from "axios";
import type { Pool } from "pg";
import {
  AgencyDtoBuilder,
  type AgencyId,
  type BroadcastFeedback,
  type BroadcastFeedbackResponse,
  broadcastFeedbackSchema,
  type ConventionBroadcastRequestParams,
  ConventionDtoBuilder,
  type ConventionId,
  errors,
  expectObjectInArrayToMatch,
  expectPromiseToFailWithError,
  expectToEqual,
  type SubscriberErrorFeedback,
} from "shared";
import { v4 as uuid } from "uuid";
import {
  cast,
  jsonBuildObject,
  type KyselyDb,
  makeKyselyDb,
} from "../../../../config/pg/kysely/kyselyUtils";
import { makeTestPgPool } from "../../../../config/pg/pgPool";
import { toAgencyWithRights } from "../../../../utils/agency";
import { makeUniqueUserForTest } from "../../../../utils/user";
import { PgAgencyRepository } from "../../../agency/adapters/PgAgencyRepository";
import { PgConventionRepository } from "../../../convention/adapters/PgConventionRepository";
import { PgUserRepository } from "../../../core/authentication/connected-user/adapters/PgUserRepository";
import {
  type BroadcastFeedbacksRepository,
  broadcastToFtServiceName,
} from "../ports/BroadcastFeedbacksRepository";
import { InMemoryBroadcastFeedbacksRepository } from "./InMemoryBroadcastFeedbacksRepository";
import { PgBroadcastFeedbacksRepository } from "./PgBroadcastFeedbacksRepository";

const someConventionId: ConventionId = "a07af28e-9c7b-4845-91ee-71020860faa8";
const anotherConventionId: ConventionId =
  "b07af28e-9c7b-4845-91ee-71020860faa8";
const someAgencyId: AgencyId = "11111111-1111-4111-8111-111111111111";

describe("PgBroadcastFeedbacksRepository", () => {
  let pool: Pool;
  let pgBroadcastFeedbacksRepository: PgBroadcastFeedbacksRepository;
  let kyselyDb: KyselyDb;

  beforeAll(() => {
    pool = makeTestPgPool();
  });

  beforeEach(async () => {
    kyselyDb = makeKyselyDb(pool);
    pgBroadcastFeedbacksRepository = new PgBroadcastFeedbacksRepository(
      kyselyDb,
    );
    await kyselyDb.deleteFrom("broadcast_feedbacks").execute();
    await kyselyDb.deleteFrom("conventions").execute();
    await kyselyDb.deleteFrom("actors").execute();
    await kyselyDb.deleteFrom("users__agencies").execute();
    await kyselyDb.deleteFrom("agencies").execute();
  });

  afterAll(async () => {
    await pool.end();
  });

  it("saves an axios response error in the repository", async () => {
    const conventionId = someConventionId;
    const broadcastFeedback = await makeBroadcastFeedback({
      conventionId,
      serviceName: "osef",
      kind: "error",
      errorMode: "response-error",
    });
    await pgBroadcastFeedbacksRepository.save(broadcastFeedback);

    const response = await kyselyDb
      .selectFrom("broadcast_feedbacks")
      .selectAll()
      .execute();

    expectObjectInArrayToMatch(response, [
      {
        handled_by_agency: broadcastFeedback.handledByAgency,
        ...(broadcastFeedback.subscriberErrorFeedback
          ? {
              subscriber_error_feedback: {
                message: broadcastFeedback.subscriberErrorFeedback.message,
                error: JSON.parse(
                  JSON.stringify(
                    broadcastFeedback.subscriberErrorFeedback.error,
                  ),
                ),
              },
            }
          : {}),
        occurred_at: new Date(broadcastFeedback.occurredAt),
        request_params: broadcastFeedback.requestParams,
        ...(broadcastFeedback.response
          ? { response: { httpStatus: broadcastFeedback.response.httpStatus } }
          : {}),
        service_name: broadcastFeedback.serviceName,
      },
    ]);
  });

  it("saves an axios response success in the repository", async () => {
    const conventionId = someConventionId;
    const broadcastFeedback = await makeBroadcastFeedback({
      conventionId,
      serviceName: "osef",
      kind: "success",
    });
    await pgBroadcastFeedbacksRepository.save(broadcastFeedback);

    const response = await kyselyDb
      .selectFrom("broadcast_feedbacks")
      .selectAll()
      .execute();

    expectObjectInArrayToMatch(response, [
      {
        handled_by_agency: broadcastFeedback.handledByAgency,
        occurred_at: new Date(broadcastFeedback.occurredAt),
        request_params: broadcastFeedback.requestParams,
        convention_id: broadcastFeedback.conventionId,
        agency_id: broadcastFeedback.agencyId,
        ...(broadcastFeedback.response
          ? {
              response: {
                httpStatus: broadcastFeedback.response.httpStatus,
                body: JSON.parse(
                  JSON.stringify(broadcastFeedback.response.body),
                ),
              },
            }
          : {}),
        service_name: broadcastFeedback.serviceName,
      },
    ]);
  });

  it("writes convention_id and agency_id columns on save", async () => {
    const conventionId = someConventionId;
    const agencyId: AgencyId = "22222222-2222-4222-8222-222222222222";
    const broadcastFeedback = await makeBroadcastFeedback({
      conventionId,
      agencyId,
      serviceName: "osef",
      kind: "success",
    });
    await pgBroadcastFeedbacksRepository.save(broadcastFeedback);

    const rows = await kyselyDb
      .selectFrom("broadcast_feedbacks")
      .select(["convention_id", "agency_id"])
      .execute();

    expectToEqual(rows, [{ convention_id: conventionId, agency_id: agencyId }]);
  });

  it("saves an axios timeout error in the repository", async () => {
    const conventionId = someConventionId;
    const broadcastFeedback = await makeBroadcastFeedback({
      conventionId,
      serviceName: "osef",
      kind: "error",
      errorMode: "timeout",
    });
    await pgBroadcastFeedbacksRepository.save(broadcastFeedback);

    const response = await kyselyDb
      .selectFrom("broadcast_feedbacks")
      .selectAll()
      .execute();

    expectObjectInArrayToMatch(response, [
      {
        handled_by_agency: broadcastFeedback.handledByAgency,
        ...(broadcastFeedback.subscriberErrorFeedback
          ? {
              subscriber_error_feedback: {
                message: broadcastFeedback.subscriberErrorFeedback.message,
                error: JSON.parse(
                  JSON.stringify(
                    broadcastFeedback.subscriberErrorFeedback.error,
                  ),
                ),
              },
            }
          : {}),
        occurred_at: new Date(broadcastFeedback.occurredAt),
        request_params: broadcastFeedback.requestParams,
        ...(broadcastFeedback.response
          ? {
              response: {
                httpStatus: broadcastFeedback.response.httpStatus,
              },
            }
          : {}),

        service_name: broadcastFeedback.serviceName,
      },
    ]);
  });

  it("saves a not axios error in the repository", async () => {
    const conventionId = someConventionId;
    const broadcastFeedback = await makeBroadcastFeedback({
      conventionId,
      serviceName: "osef",
      kind: "error",
      errorMode: "not-axios-error",
    });
    await pgBroadcastFeedbacksRepository.save(broadcastFeedback);

    const response = await kyselyDb
      .selectFrom("broadcast_feedbacks")
      .selectAll()
      .execute();

    expectObjectInArrayToMatch(response, [
      {
        handled_by_agency: broadcastFeedback.handledByAgency,
        ...(broadcastFeedback.subscriberErrorFeedback
          ? {
              subscriber_error_feedback: {
                message: broadcastFeedback.subscriberErrorFeedback.message,
                error: JSON.parse(
                  JSON.stringify(
                    broadcastFeedback.subscriberErrorFeedback.error,
                  ),
                ),
              },
            }
          : {}),
        occurred_at: new Date(broadcastFeedback.occurredAt),
        request_params: broadcastFeedback.requestParams,
        ...(broadcastFeedback.response
          ? { response: { httpStatus: broadcastFeedback.response.httpStatus } }
          : {}),
        service_name: broadcastFeedback.serviceName,
      },
    ]);
  });

  describe("markPartnersErroredConventionAsHandled", () => {
    const conventionId1 = someConventionId;

    it("mark errored convention as handle when convention exist", async () => {
      const conventionId2 = anotherConventionId;
      const broadcastFeedback1 = await makeBroadcastFeedback({
        conventionId: conventionId1,
        serviceName: broadcastToFtServiceName,
        kind: "error",
        errorMode: "response-error",
      });
      const broadcastFeedback2 = await makeBroadcastFeedback({
        conventionId: conventionId1,
        serviceName: broadcastToFtServiceName,
        kind: "error",
        errorMode: "response-error",
      });
      const broadcastFeedback3 = await makeBroadcastFeedback({
        conventionId: conventionId1,
        serviceName: "osef",
        kind: "error",
        errorMode: "response-error",
      });
      const broadcastFeedback4 = await makeBroadcastFeedback({
        conventionId: conventionId2,
        serviceName: broadcastToFtServiceName,
        kind: "error",
        errorMode: "response-error",
      });

      await pgBroadcastFeedbacksRepository.save(broadcastFeedback1);
      await pgBroadcastFeedbacksRepository.save(broadcastFeedback2);
      await pgBroadcastFeedbacksRepository.save(broadcastFeedback3);
      await pgBroadcastFeedbacksRepository.save(broadcastFeedback4);

      await pgBroadcastFeedbacksRepository.markPartnersErroredConventionAsHandled(
        conventionId1,
      );

      const pgbroadcastFeedbacks = await kyselyDb
        .selectFrom("broadcast_feedbacks as bf")
        .select((qb) =>
          jsonBuildObject({
            serviceName: qb.ref("bf.service_name"),
            subscriberErrorFeedback: cast<SubscriberErrorFeedback>(
              qb.ref("bf.subscriber_error_feedback"),
            ),
            requestParams: cast<ConventionBroadcastRequestParams>(
              qb.ref("bf.request_params"),
            ),
            response: cast<BroadcastFeedbackResponse>(qb.ref("bf.response")),
            occurredAt: qb.ref("bf.occurred_at"),
            handledByAgency: qb.ref("bf.handled_by_agency"),
            consumerName: qb.ref("bf.consumer_name"),
            consumerId: qb.ref("bf.consumer_id"),
            conventionId: cast<ConventionId>(qb.ref("bf.convention_id")),
            agencyId: cast<AgencyId>(qb.ref("bf.agency_id")),
          }).as("broacastFeedback"),
        )
        .orderBy("id")
        .execute();

      expectToEqual(
        pgbroadcastFeedbacks.map(
          (pgBroadcastFeedback): BroadcastFeedback => ({
            serviceName: pgBroadcastFeedback.broacastFeedback.serviceName,
            conventionId: pgBroadcastFeedback.broacastFeedback.conventionId,
            agencyId: pgBroadcastFeedback.broacastFeedback.agencyId,
            subscriberErrorFeedback:
              pgBroadcastFeedback.broacastFeedback.subscriberErrorFeedback,
            requestParams: pgBroadcastFeedback.broacastFeedback.requestParams,
            response: pgBroadcastFeedback.broacastFeedback.response,
            occurredAt: new Date(
              pgBroadcastFeedback.broacastFeedback.occurredAt,
            ).toISOString(),
            handledByAgency:
              pgBroadcastFeedback.broacastFeedback.handledByAgency,
            consumerName: pgBroadcastFeedback.broacastFeedback.consumerName,
            consumerId: pgBroadcastFeedback.broacastFeedback.consumerId,
          }),
        ),
        [
          { ...broadcastFeedback1, handledByAgency: true },
          { ...broadcastFeedback2, handledByAgency: true },
          { ...broadcastFeedback3, handledByAgency: true },
          broadcastFeedback4,
        ].map(({ subscriberErrorFeedback, ...rest }) => ({
          ...rest,
          ...(subscriberErrorFeedback
            ? {
                subscriberErrorFeedback: {
                  message: subscriberErrorFeedback.message,
                  error: JSON.parse(
                    JSON.stringify(subscriberErrorFeedback.error),
                  ),
                },
              }
            : {}),
        })),
      );
    });

    it("Throw when there is no error for convention", async () => {
      await expectPromiseToFailWithError(
        pgBroadcastFeedbacksRepository.markPartnersErroredConventionAsHandled(
          conventionId1,
        ),
        errors.broadcastFeedback.notFound({
          conventionId: conventionId1,
        }),
      );
    });

    it("Throw when the saved error is already mark as handle", async () => {
      const broadcastFeedback1 = await makeBroadcastFeedback({
        conventionId: conventionId1,
        serviceName: broadcastToFtServiceName,
        kind: "error",
        errorMode: "response-error",
        handledByAgency: true,
      });
      await pgBroadcastFeedbacksRepository.save(broadcastFeedback1);

      await expectPromiseToFailWithError(
        pgBroadcastFeedbacksRepository.markPartnersErroredConventionAsHandled(
          conventionId1,
        ),
        errors.broadcastFeedback.notFound({ conventionId: conventionId1 }),
      );
    });
  });

  describe("getLastBroadcastFeedback", () => {
    it("retrieve nothing if there is not last broadcast feedback", async () => {
      const conventionId = someConventionId;

      const result =
        await pgBroadcastFeedbacksRepository.getLastBroadcastFeedback(
          conventionId,
        );

      expect(result).toBeNull();
    });

    it("falls back to legacy fields when columns are null (legacy rows pre-backfill)", async () => {
      const conventionId = someConventionId;
      const agencyId = someAgencyId;
      const validator = makeUniqueUserForTest(uuid());
      await new PgUserRepository(kyselyDb).save(validator);
      await new PgAgencyRepository(kyselyDb).insert(
        toAgencyWithRights(new AgencyDtoBuilder().withId(agencyId).build(), {
          [validator.id]: { isNotifiedByEmail: true, roles: ["validator"] },
        }),
      );
      await new PgConventionRepository(kyselyDb).save(
        new ConventionDtoBuilder()
          .withId(conventionId)
          .withAgencyId(agencyId)
          .build(),
      );

      await kyselyDb
        .insertInto("broadcast_feedbacks")
        .values({
          service_name: broadcastToFtServiceName,
          consumer_name: "my-consumer",
          consumer_id: null,
          request_params: JSON.stringify({ conventionId }),
          response: JSON.stringify({ httpStatus: 500 }),
          occurred_at: new Date("2024-07-31").toISOString(),
          handled_by_agency: false,
          convention_id: null,
          agency_id: null,
        })
        .execute();

      const result =
        await pgBroadcastFeedbacksRepository.getLastBroadcastFeedback(
          conventionId,
        );

      expect(result).not.toBeNull();
      expectToEqual(result?.conventionId, conventionId);
      expectToEqual(result?.agencyId, agencyId);
    });

    it("retrieve a broadcast feedback", async () => {
      const conventionId = someConventionId;

      const firstBroadcast = await makeBroadcastFeedback({
        conventionId,
        serviceName: broadcastToFtServiceName,
        kind: "error",
        occurredAt: new Date("2024-07-01"),
      });
      const lastBroadcast = await makeBroadcastFeedback({
        conventionId,
        serviceName: broadcastToFtServiceName,
        kind: "error",
        occurredAt: new Date("2024-07-31"),
      });
      await pgBroadcastFeedbacksRepository.save(firstBroadcast);
      await pgBroadcastFeedbacksRepository.save(lastBroadcast);

      const result =
        await pgBroadcastFeedbacksRepository.getLastBroadcastFeedback(
          conventionId,
        );

      expect(broadcastFeedbackSchema.safeParse(result).success).toBeTruthy();
      expectToEqual(result, {
        ...lastBroadcast,
        ...(result?.subscriberErrorFeedback
          ? {
              subscriberErrorFeedback: {
                message: result.subscriberErrorFeedback.message,
                error: JSON.parse(
                  JSON.stringify(result.subscriberErrorFeedback.error),
                ),
              },
            }
          : {}),
      });
    });
  });

  describe.each([
    "Pg",
    "InMemory",
  ] as const)("%s getBroadcastFeedbacksByConventionId", (adapter) => {
    let repository: BroadcastFeedbacksRepository;

    beforeEach(() => {
      repository =
        adapter === "Pg"
          ? pgBroadcastFeedbacksRepository
          : new InMemoryBroadcastFeedbacksRepository();
    });

    it("returns an empty array when there is no broadcast feedback", async () => {
      const result =
        await repository.getBroadcastFeedbacksByConventionId(someConventionId);

      expectToEqual(result, []);
    });

    it("returns all feedbacks for a convention ordered by occurredAt ascending", async () => {
      const conventionId = someConventionId;

      const firstBroadcast = await makeBroadcastFeedback({
        conventionId,
        serviceName: broadcastToFtServiceName,
        kind: "success",
        occurredAt: new Date("2024-07-01"),
      });
      const secondBroadcast = await makeBroadcastFeedback({
        conventionId,
        serviceName: broadcastToFtServiceName,
        kind: "error",
        occurredAt: new Date("2024-07-15"),
      });
      const thirdBroadcast = await makeBroadcastFeedback({
        conventionId,
        serviceName: broadcastToFtServiceName,
        kind: "error",
        occurredAt: new Date("2024-07-31"),
      });

      await repository.save(thirdBroadcast);
      await repository.save(firstBroadcast);
      await repository.save(secondBroadcast);

      const result =
        await repository.getBroadcastFeedbacksByConventionId(conventionId);

      expectToEqual(
        result.map(({ occurredAt, serviceName, conventionId: id }) => ({
          occurredAt,
          serviceName,
          conventionId: id,
        })),
        [
          {
            occurredAt: firstBroadcast.occurredAt,
            serviceName: firstBroadcast.serviceName,
            conventionId,
          },
          {
            occurredAt: secondBroadcast.occurredAt,
            serviceName: secondBroadcast.serviceName,
            conventionId,
          },
          {
            occurredAt: thirdBroadcast.occurredAt,
            serviceName: thirdBroadcast.serviceName,
            conventionId,
          },
        ],
      );
    });

    it("isolates feedbacks by conventionId", async () => {
      const broadcastForConvention1 = await makeBroadcastFeedback({
        conventionId: someConventionId,
        serviceName: broadcastToFtServiceName,
        kind: "success",
        occurredAt: new Date("2024-07-01"),
      });
      const broadcastForConvention2 = await makeBroadcastFeedback({
        conventionId: anotherConventionId,
        serviceName: broadcastToFtServiceName,
        kind: "error",
        occurredAt: new Date("2024-07-15"),
      });

      await repository.save(broadcastForConvention1);
      await repository.save(broadcastForConvention2);

      const result =
        await repository.getBroadcastFeedbacksByConventionId(someConventionId);

      expectToEqual(result.length, 1);
      expectToEqual(result[0]?.conventionId, someConventionId);
      expectToEqual(result[0]?.occurredAt, broadcastForConvention1.occurredAt);
    });
  });
});

const makeBroadcastFeedback = async (params: {
  kind: "error" | "success";
  serviceName: string;
  conventionId: ConventionId;
  agencyId?: AgencyId;
  occurredAt?: Date;
  errorMode?: "timeout" | "response-error" | "not-axios-error";
  handledByAgency?: boolean;
}): Promise<BroadcastFeedback> => {
  const agencyId = params.agencyId ?? someAgencyId;
  if (params.kind === "error") {
    const error = await axios
      .get(
        params.errorMode === "timeout"
          ? "http://sdlmfhjsdflmsdhfmsldjfhsd.com"
          : "https://www.google.com/yolo?hl=fr&tab=ww",
      )
      .then(() => {
        throw errors.generic.testError("Should not occurs");
      })
      .catch((error) => {
        if (isAxiosError(error)) return error;
        throw error;
      });

    return {
      consumerId: null,
      consumerName: "my-consumer",
      conventionId: params.conventionId,
      agencyId,
      serviceName: params.serviceName,
      subscriberErrorFeedback: {
        message: "Some message",
        error:
          params.errorMode === "not-axios-error"
            ? errors.generic.testError("Not axios error")
            : error,
      },
      requestParams: { conventionId: params.conventionId },
      response: { httpStatus: 500 },
      occurredAt: params.occurredAt
        ? params.occurredAt.toISOString()
        : new Date().toISOString(),
      handledByAgency: params.handledByAgency ? params.handledByAgency : false,
    };
  }

  return {
    consumerId: null,
    consumerName: "my-consumer",
    conventionId: params.conventionId,
    agencyId,
    serviceName: params.serviceName,
    requestParams: { conventionId: params.conventionId },
    response: { httpStatus: 200, body: { status: 200, title: "blabla" } },
    occurredAt: params.occurredAt
      ? params.occurredAt.toISOString()
      : new Date().toISOString(),
    handledByAgency: params.handledByAgency ?? false,
  };
};
