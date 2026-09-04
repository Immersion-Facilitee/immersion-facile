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
  broadcastToFtConsumerName,
  broadcastToFtServiceName,
  broadcastToPartnersServiceName,
} from "../../core/saved-errors/ports/BroadcastFeedbacksRepository";
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
  const backofficeAdmin = new ConnectedUserBuilder()
    .withId("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb")
    .withIsAdmin(true)
    .build();

  const convention = new ConventionDtoBuilder()
    .withStatus("ACCEPTED_BY_VALIDATOR")
    .withDateSubmission("2025-01-02T00:00:00.000Z")
    .build();

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
    occurredAt: "2025-01-16T10:00:00.000Z",
    handledByAgency: true,
  };

  const unhandledErrorFeedback: BroadcastFeedback = {
    ...sampleBroadcastFeedback,
    handledByAgency: false,
    occurredAt: "2025-01-16T10:00:00.000Z",
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
      uow.userRepository.users = [connectedUser, backofficeAdmin];
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
        broadcastFeedback: sampleBroadcastFeedback,
        shouldBeHandled: false,
      });
    });

    it("rejects broadcast feedbacks with inconsistent convention ids", () => {
      const parseResult =
        conventionLastBroadcastFeedbackResponseSchema.safeParse({
          broadcastFeedback: {
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
        broadcastFeedback: null,
      });
    });

    it("should return the most recent broadcast feedback when multiple exist", async () => {
      const olderFeedback: BroadcastFeedback = {
        ...sampleBroadcastFeedback,
        occurredAt: "2025-01-15T10:00:00.000Z",
        serviceName: "older-service",
      };

      const newerFeedback: BroadcastFeedback = {
        ...sampleBroadcastFeedback,
        occurredAt: "2025-01-17T10:00:00.000Z",
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
        broadcastFeedback: newerFeedback,
        shouldBeHandled: false,
      });
    });

    it("should return shouldBeHandled false when last feedback is a success", async () => {
      const successFeedback: BroadcastFeedback = {
        ...sampleBroadcastFeedback,
        subscriberErrorFeedback: undefined,
        handledByAgency: false,
        response: {
          httpStatus: 201,
          body: { success: true },
        },
      };

      uow.broadcastFeedbacksRepository.broadcastFeedbacks = [successFeedback];

      const result = await getLastBroadcastFeedback.execute(
        convention.id,
        connectedUser,
      );

      expectToEqual(result, {
        broadcastFeedback: successFeedback,
        shouldBeHandled: false,
      });
    });

    it("should return shouldBeHandled true for unhandled error on validated convention when submission is on or after 2025-01-01", async () => {
      uow.broadcastFeedbacksRepository.broadcastFeedbacks = [
        unhandledErrorFeedback,
      ];

      const result = await getLastBroadcastFeedback.execute(
        convention.id,
        connectedUser,
      );

      expectToEqual(result, {
        broadcastFeedback: unhandledErrorFeedback,
        shouldBeHandled: true,
      });
    });

    it("should return shouldBeHandled false when error is already handled", async () => {
      const handledErrorFeedback: BroadcastFeedback = {
        ...unhandledErrorFeedback,
        handledByAgency: true,
      };

      uow.broadcastFeedbacksRepository.broadcastFeedbacks = [
        handledErrorFeedback,
      ];

      const result = await getLastBroadcastFeedback.execute(
        convention.id,
        connectedUser,
      );

      expectToEqual(result, {
        broadcastFeedback: handledErrorFeedback,
        shouldBeHandled: false,
      });
    });

    it("should return shouldBeHandled false when submission is before 2025-01-01", async () => {
      const conventionSubmittedBefore2025 = new ConventionDtoBuilder(convention)
        .withDateSubmission("2024-12-31T23:59:59.000Z")
        .build();
      uow.conventionRepository.setConventions([conventionSubmittedBefore2025]);
      uow.broadcastFeedbacksRepository.broadcastFeedbacks = [
        unhandledErrorFeedback,
      ];

      const result = await getLastBroadcastFeedback.execute(
        convention.id,
        connectedUser,
      );

      expectToEqual(result, {
        broadcastFeedback: unhandledErrorFeedback,
        shouldBeHandled: false,
      });
    });
  });

  describe("shouldBeHandled for unvalidated convention status", () => {
    const cancelledConvention = new ConventionDtoBuilder(convention)
      .withStatus("CANCELLED")
      .withDateSubmission("2025-01-02T00:00:00.000Z")
      .build();

    const cancelledErrorFeedback: BroadcastFeedback = {
      ...unhandledErrorFeedback,
      requestParams: {
        conventionId: convention.id,
        conventionStatus: "CANCELLED",
      },
      serviceName: broadcastToFtServiceName,
      occurredAt: "2025-01-16T14:00:00.000Z",
    };

    beforeEach(() => {
      uow.userRepository.users = [connectedUser];
      uow.agencyRepository.agencies = [
        toAgencyWithRights(agency, {
          [connectedUser.id]: { isNotifiedByEmail: true, roles: ["validator"] },
        }),
      ];
      uow.conventionRepository.setConventions([cancelledConvention]);
    });

    it("should return shouldBeHandled false for CANCELLED without prior success", async () => {
      uow.broadcastFeedbacksRepository.broadcastFeedbacks = [
        cancelledErrorFeedback,
      ];

      const result = await getLastBroadcastFeedback.execute(
        convention.id,
        connectedUser,
      );

      expectToEqual(result, {
        broadcastFeedback: cancelledErrorFeedback,
        shouldBeHandled: false,
      });
    });

    it("should return shouldBeHandled true for CANCELLED with prior FT httpStatus 201", async () => {
      const priorFtSuccess: BroadcastFeedback = {
        consumerId: null,
        consumerName: broadcastToFtConsumerName,
        conventionId: convention.id,
        agencyId: agency.id,
        serviceName: broadcastToFtServiceName,
        occurredAt: "2025-01-16T08:00:00.000Z",
        handledByAgency: false,
        requestParams: {
          conventionId: convention.id,
          conventionStatus: "ACCEPTED_BY_VALIDATOR",
        },
        response: {
          httpStatus: 201,
        },
      };

      uow.broadcastFeedbacksRepository.broadcastFeedbacks = [
        priorFtSuccess,
        cancelledErrorFeedback,
      ];

      const result = await getLastBroadcastFeedback.execute(
        convention.id,
        connectedUser,
      );

      expectToEqual(result, {
        broadcastFeedback: cancelledErrorFeedback,
        shouldBeHandled: true,
      });
    });

    it("should return shouldBeHandled false for CANCELLED when prior FT has httpStatus 200 only", async () => {
      const priorFtHttp200: BroadcastFeedback = {
        consumerId: null,
        consumerName: broadcastToFtConsumerName,
        conventionId: convention.id,
        agencyId: agency.id,
        serviceName: broadcastToFtServiceName,
        occurredAt: "2025-01-16T08:00:00.000Z",
        handledByAgency: false,
        requestParams: {
          conventionId: convention.id,
          conventionStatus: "ACCEPTED_BY_VALIDATOR",
        },
        response: {
          httpStatus: 200,
        },
      };

      uow.broadcastFeedbacksRepository.broadcastFeedbacks = [
        priorFtHttp200,
        cancelledErrorFeedback,
      ];

      const result = await getLastBroadcastFeedback.execute(
        convention.id,
        connectedUser,
      );

      expectToEqual(result, {
        broadcastFeedback: cancelledErrorFeedback,
        shouldBeHandled: false,
      });
    });

    it("should return shouldBeHandled true for CANCELLED with prior partner broadcast without error", async () => {
      const partnerError: BroadcastFeedback = {
        ...cancelledErrorFeedback,
        consumerId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        consumerName: "partner-consumer",
        serviceName: broadcastToPartnersServiceName,
      };

      const priorPartnerSuccess: BroadcastFeedback = {
        consumerId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        consumerName: "partner-consumer",
        conventionId: convention.id,
        agencyId: agency.id,
        serviceName: broadcastToPartnersServiceName,
        occurredAt: "2025-01-16T08:00:00.000Z",
        handledByAgency: false,
        requestParams: {
          conventionId: convention.id,
          conventionStatus: "ACCEPTED_BY_VALIDATOR",
        },
        response: {
          httpStatus: 200,
        },
      };

      uow.broadcastFeedbacksRepository.broadcastFeedbacks = [
        priorPartnerSuccess,
        partnerError,
      ];

      const result = await getLastBroadcastFeedback.execute(
        convention.id,
        connectedUser,
      );

      expectToEqual(result, {
        broadcastFeedback: partnerError,
        shouldBeHandled: true,
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
