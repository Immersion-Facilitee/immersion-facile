import {
  AgencyDtoBuilder,
  type BroadcastFeedback,
  ConnectedUserBuilder,
  ConventionDtoBuilder,
  conventionLastBroadcastFeedbackResponseSchema,
  errors,
  expectPromiseToFailWithError,
  expectToEqual,
} from "shared";
import { toAgencyWithRights } from "../../../utils/agency";
import {
  createInMemoryUow,
  type InMemoryUnitOfWork,
} from "../../core/unit-of-work/adapters/createInMemoryUow";
import { InMemoryUowPerformer } from "../../core/unit-of-work/adapters/InMemoryUowPerformer";
import {
  type GetLastBroadcastFeedback,
  makeGetLastBroadcastFeedback,
} from "./GetLastBroadcastFeedback";

describe("GetLastBroadcastFeedback", () => {
  const connectedUser = new ConnectedUserBuilder().build();

  const convention = new ConventionDtoBuilder().build();

  const agency = new AgencyDtoBuilder().withId(convention.agencyId).build();

  const sampleBroadcastFeedback: BroadcastFeedback = {
    serviceName: "test-service",
    consumerId: "cccccc99-9c0b-1bbb-bb6d-6bb9bd38bbbb",
    consumerName: "Test Consumer",
    conventionId: convention.id,
    agencyId: agency.id,
    subscriberErrorFeedback: {
      message: "Test error message",
      error: { code: "TEST_ERROR" },
    },
    requestParams: {
      conventionId: convention.id,
      conventionStatus: convention.status,
    },
    response: {
      httpStatus: 200,
      body: { success: true },
    },
    occurredAt: "2024-01-16T10:00:00.000Z",
    handledByAgency: true,
  };

  let getLastBroadcastFeedback: GetLastBroadcastFeedback;
  let uow: InMemoryUnitOfWork;

  beforeEach(() => {
    uow = createInMemoryUow();
    getLastBroadcastFeedback = makeGetLastBroadcastFeedback({
      uowPerformer: new InMemoryUowPerformer(uow),
    });
  });

  describe("right paths", () => {
    beforeEach(async () => {
      uow.userRepository.users = [connectedUser];
      uow.agencyRepository.agencies = [
        toAgencyWithRights(agency, {
          [connectedUser.id]: { isNotifiedByEmail: true, roles: ["validator"] },
        }),
      ];
      uow.conventionRepository.setConventions([convention]);
    });

    it("should return the last broadcast feedback when it exists", async () => {
      uow.broadcastFeedbacksRepository.broadcastFeedbacks = [
        sampleBroadcastFeedback,
      ];

      const result = await getLastBroadcastFeedback.execute(
        convention.id,
        connectedUser,
      );

      const parseResult =
        conventionLastBroadcastFeedbackResponseSchema.safeParse(result);
      expect(parseResult.success).toBeTruthy();
      expectToEqual(result, {
        lastBroadcastFeedback: sampleBroadcastFeedback,
        shouldBeHandled: false,
      });
    });

    it("rejects broadcast feedbacks with inconsistent convention ids", () => {
      const parseResult =
        conventionLastBroadcastFeedbackResponseSchema.safeParse({
          lastBroadcastFeedback: {
            ...sampleBroadcastFeedback,
            requestParams: {
              ...sampleBroadcastFeedback.requestParams,
              conventionId: "11111111-1111-4111-8111-111111111111",
            },
          },
          shouldBeHandled: false,
        });

      expect(parseResult.success).toBe(false);
    });

    it("should return null when no broadcast feedback exists", async () => {
      const result = await getLastBroadcastFeedback.execute(
        convention.id,
        connectedUser,
      );

      expectToEqual(result, {
        lastBroadcastFeedback: null,
      });
    });

    it("should return the most recent broadcast feedback when multiple exist", async () => {
      const olderFeedback: BroadcastFeedback = {
        ...sampleBroadcastFeedback,
        occurredAt: "2024-01-15T10:00:00.000Z",
        serviceName: "older-service",
      };

      const newerFeedback: BroadcastFeedback = {
        ...sampleBroadcastFeedback,
        occurredAt: "2024-01-17T10:00:00.000Z",
        serviceName: "newer-service",
      };

      uow.broadcastFeedbacksRepository.broadcastFeedbacks = [
        olderFeedback,
        newerFeedback,
      ];

      const result = await getLastBroadcastFeedback.execute(
        convention.id,
        connectedUser,
      );

      expectToEqual(result, {
        lastBroadcastFeedback: newerFeedback,
        shouldBeHandled: false,
      });
    });

    it("should handle broadcast feedback with error response", async () => {
      const errorFeedback: BroadcastFeedback = {
        serviceName: "error-service",
        consumerId: "error-consumer",
        consumerName: "Error Consumer",
        conventionId: convention.id,
        agencyId: agency.id,
        subscriberErrorFeedback: {
          message: "Connection timeout",
          error: { timeout: 5000 },
        },
        requestParams: {
          conventionId: convention.id,
          conventionStatus: "ACCEPTED_BY_VALIDATOR",
        },
        response: {
          httpStatus: 500,
          body: { error: "Internal server error" },
        },
        occurredAt: new Date("2024-01-16T10:00:00.000Z").toISOString(),
        handledByAgency: false,
      };

      uow.broadcastFeedbacksRepository.broadcastFeedbacks = [errorFeedback];

      const result = await getLastBroadcastFeedback.execute(
        convention.id,
        connectedUser,
      );

      expectToEqual(result, {
        lastBroadcastFeedback: errorFeedback,
        shouldBeHandled: false,
      });
    });
  });

  describe("wrong paths", () => {
    it("should throw convention not found error", async () => {
      await expectPromiseToFailWithError(
        getLastBroadcastFeedback.execute(convention.id, connectedUser),
        errors.convention.notFound({
          conventionId: convention.id,
        }),
      );
    });
    it("should throw no rights on agency error", async () => {
      uow.conventionRepository.setConventions([convention]);
      uow.userRepository.users = [connectedUser];
      await expectPromiseToFailWithError(
        getLastBroadcastFeedback.execute(convention.id, connectedUser),
        errors.user.forbidden({
          userId: connectedUser.id,
        }),
      );
    });
  });
});
