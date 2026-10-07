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
import { ApiConsumerBuilder } from "../../core/api-consumer/adapters/InMemoryApiConsumerRepository";
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

const siMiloProductionConsumerName = "si-milo-production";

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

  const ftAgency = new AgencyDtoBuilder()
    .withId(convention.agencyId)
    .withKind("france-travail")
    .build();

  const sampleBroadcastFeedback: BroadcastFeedback = {
    serviceName: "test-service",
    consumerId: "cccccc99-9c0b-1bbb-bb6d-6bb9bd38bbbb",
    consumerName: broadcastToFtConsumerName,
    conventionId: convention.id,
    agencyId: ftAgency.id,
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
        toAgencyWithRights(ftAgency, {
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
        toAgencyWithRights(ftAgency, {
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
        agencyId: ftAgency.id,
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
        agencyId: ftAgency.id,
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
      uow.apiConsumerRepository.consumers = [
        new ApiConsumerBuilder()
          .withName("partner-consumer")
          .withConventionRight({
            kinds: ["SUBSCRIPTION"],
            scope: { agencyIds: [ftAgency.id] },
            subscriptions: [
              {
                id: "11111111-1111-4111-8111-111111111111",
                createdAt: "2024-07-22T00:00:00.000Z",
                callbackHeaders: { authorization: "token" },
                callbackUrl: "https://partner.example.com",
                subscribedEvent: "convention.updated",
              },
            ],
          })
          .build(),
      ];

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
        agencyId: ftAgency.id,
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

    it("should throw agency not found when the convention agency is missing", async () => {
      uow.userRepository.users = [backofficeAdmin];
      uow.conventionRepository.setConventions([convention]);

      await expectPromiseToFailWithError(
        getLastBroadcastFeedback.execute(convention.id, backofficeAdmin),
        errors.agency.notFound({ agencyId: convention.agencyId }),
      );
    });
  });

  describe("filters last feedback by relevant consumer names", () => {
    const missionLocaleAgency = new AgencyDtoBuilder()
      .withId("11111111-1111-4111-8111-111111111111")
      .withKind("mission-locale")
      .build();

    const agencyWithRefersTo = new AgencyDtoBuilder()
      .withId("33333333-3333-4333-8333-333333333333")
      .withKind("autre")
      .withRefersToAgencyInfo({
        refersToAgencyId: ftAgency.id,
        refersToAgencyName: ftAgency.name,
        refersToAgencyContactEmail: ftAgency.contactEmail,
      })
      .build();

    const conventionWithAgencyWithRefersTo = new ConventionDtoBuilder(
      convention,
    )
      .withAgencyId(agencyWithRefersTo.id)
      .build();

    const ftSuccessFeedback: BroadcastFeedback = {
      consumerId: null,
      consumerName: broadcastToFtConsumerName,
      conventionId: convention.id,
      agencyId: ftAgency.id,
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

    const imiloErrorFeedback: BroadcastFeedback = {
      consumerId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      consumerName: siMiloProductionConsumerName,
      conventionId: convention.id,
      agencyId: missionLocaleAgency.id,
      serviceName: broadcastToPartnersServiceName,
      occurredAt: "2025-01-16T14:00:00.000Z",
      handledByAgency: false,
      subscriberErrorFeedback: {
        message: "i-milo error",
        error: { code: "IMILO_ERROR" },
      },
      requestParams: {
        conventionId: convention.id,
        conventionStatus: "CANCELLED",
      },
      response: {
        httpStatus: 500,
      },
    };

    const setupAgencyUser = (currentAgency: typeof ftAgency) => {
      uow.userRepository.users = [connectedUser];
      uow.agencyRepository.agencies = [
        toAgencyWithRights(currentAgency, {
          [connectedUser.id]: { isNotifiedByEmail: true, roles: ["validator"] },
        }),
        ...(currentAgency.refersToAgencyId
          ? [toAgencyWithRights(ftAgency)]
          : []),
      ];
      uow.apiConsumerRepository.consumers = [
        new ApiConsumerBuilder()
          .withName(siMiloProductionConsumerName)
          .withConventionRight({
            kinds: ["SUBSCRIPTION"],
            scope: { agencyIds: [missionLocaleAgency.id] },
            subscriptions: [
              {
                id: "11111111-1111-4111-8111-111111111111",
                createdAt: "2024-07-22T00:00:00.000Z",
                callbackHeaders: { authorization: "token" },
                callbackUrl: "https://partner.example.com",
                subscribedEvent: "convention.updated",
              },
            ],
          })
          .build(),
      ];
    };

    it("ignores a more recent feedback whose consumer name is no longer relevant", async () => {
      setupAgencyUser(missionLocaleAgency);
      uow.conventionRepository.setConventions([
        new ConventionDtoBuilder(convention)
          .withAgencyId(missionLocaleAgency.id)
          .build(),
      ]);
      const newerFtFeedback: BroadcastFeedback = {
        ...ftSuccessFeedback,
        subscriberErrorFeedback: {
          message: "FT error after transfer",
          error: { code: "FT_ERROR" },
        },
        occurredAt: "2025-01-17T10:00:00.000Z",
        requestParams: {
          conventionId: convention.id,
          conventionStatus: "ACCEPTED_BY_VALIDATOR",
        },
        response: {
          httpStatus: 500,
        },
      };
      const olderImiloFeedback: BroadcastFeedback = {
        ...imiloErrorFeedback,
        occurredAt: "2025-01-16T10:00:00.000Z",
        requestParams: {
          conventionId: convention.id,
          conventionStatus: "ACCEPTED_BY_VALIDATOR",
        },
      };
      uow.broadcastFeedbacksRepository.broadcastFeedbacks = [
        olderImiloFeedback,
        newerFtFeedback,
      ];

      const result = await getLastBroadcastFeedback.execute(
        convention.id,
        connectedUser,
      );

      expectToEqual(result, {
        broadcastFeedback: olderImiloFeedback,
        shouldBeHandled: true,
      });
    });

    it("returns null when the current agency has no relevant feedback after a scope change", async () => {
      setupAgencyUser(missionLocaleAgency);
      uow.conventionRepository.setConventions([
        new ConventionDtoBuilder(convention)
          .withAgencyId(missionLocaleAgency.id)
          .build(),
      ]);
      uow.broadcastFeedbacksRepository.broadcastFeedbacks = [ftSuccessFeedback];

      const result = await getLastBroadcastFeedback.execute(
        convention.id,
        connectedUser,
      );

      expectToEqual(result, {
        broadcastFeedback: null,
      });
    });

    it("keeps the last feedback when the consumer name stays relevant after a transfer", async () => {
      const otherFranceTravailAgency = new AgencyDtoBuilder()
        .withId("22222222-2222-4222-8222-222222222222")
        .withKind("france-travail")
        .build();
      const conventionWithOtherFranceTravailAgency = new ConventionDtoBuilder(
        convention,
      )
        .withAgencyId(otherFranceTravailAgency.id)
        .build();
      setupAgencyUser(otherFranceTravailAgency);
      uow.conventionRepository.setConventions([
        conventionWithOtherFranceTravailAgency,
      ]);
      const ftFeedbackFromPreviousAgency: BroadcastFeedback = {
        ...sampleBroadcastFeedback,
        agencyId: ftAgency.id,
        handledByAgency: false,
        subscriberErrorFeedback: {
          message: "FT error",
          error: { code: "FT_ERROR" },
        },
      };
      uow.broadcastFeedbacksRepository.broadcastFeedbacks = [
        ftFeedbackFromPreviousAgency,
      ];

      const result = await getLastBroadcastFeedback.execute(
        convention.id,
        connectedUser,
      );

      expectToEqual(result, {
        broadcastFeedback: ftFeedbackFromPreviousAgency,
        shouldBeHandled: true,
      });
    });

    it("keeps the last feedback when the consumer name is relevant for the referred agency", async () => {
      setupAgencyUser(agencyWithRefersTo);
      uow.conventionRepository.setConventions([
        conventionWithAgencyWithRefersTo,
      ]);
      uow.broadcastFeedbacksRepository.broadcastFeedbacks = [
        sampleBroadcastFeedback,
      ];

      const result = await getLastBroadcastFeedback.execute(
        convention.id,
        connectedUser,
      );

      expectToEqual(result, {
        broadcastFeedback: sampleBroadcastFeedback,
        shouldBeHandled: false,
      });
    });

    it("keeps the last feedback from a partner subscribed to the referred agency", async () => {
      setupAgencyUser(agencyWithRefersTo);
      const referredAgencyPartnerName = "si-ft-production";
      uow.apiConsumerRepository.consumers = [
        new ApiConsumerBuilder()
          .withName(referredAgencyPartnerName)
          .withConventionRight({
            kinds: ["SUBSCRIPTION"],
            scope: { agencyIds: [ftAgency.id] },
            subscriptions: [
              {
                id: "11111111-1111-4111-8111-111111111111",
                createdAt: "2024-07-22T00:00:00.000Z",
                callbackHeaders: { authorization: "token" },
                callbackUrl: "https://partner.example.com",
                subscribedEvent: "convention.updated",
              },
            ],
          })
          .build(),
      ];
      uow.conventionRepository.setConventions([
        conventionWithAgencyWithRefersTo,
      ]);
      const referredAgencyPartnerFeedback: BroadcastFeedback = {
        consumerId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
        consumerName: referredAgencyPartnerName,
        conventionId: convention.id,
        agencyId: ftAgency.id,
        serviceName: broadcastToPartnersServiceName,
        occurredAt: "2025-01-16T14:00:00.000Z",
        handledByAgency: false,
        subscriberErrorFeedback: {
          message: "partner error",
          error: { code: "PARTNER_ERROR" },
        },
        requestParams: {
          conventionId: convention.id,
          conventionStatus: "ACCEPTED_BY_VALIDATOR",
        },
        response: {
          httpStatus: 500,
        },
      };
      uow.broadcastFeedbacksRepository.broadcastFeedbacks = [
        referredAgencyPartnerFeedback,
      ];

      const result = await getLastBroadcastFeedback.execute(
        convention.id,
        connectedUser,
      );

      expectToEqual(result, {
        broadcastFeedback: referredAgencyPartnerFeedback,
        shouldBeHandled: true,
      });
    });
  });
});
