import {
  type AgencyDto,
  AgencyDtoBuilder,
  type AgencyKind,
  type AppellationAndRomeDto,
  AssessmentDtoBuilder,
  type BroadcastFeedback,
  ConnectedUserBuilder,
  type ConventionDto,
  ConventionDtoBuilder,
  cartographeAppellationAndRome,
  errors,
  expectPromiseToFailWithError,
  expectToEqual,
  type SubscriptionParams,
} from "shared";
import { v4 as uuid } from "uuid";
import { toAgencyWithRights } from "../../../../utils/agency";
import { createAssessmentEntity } from "../../../convention/entities/AssessmentEntity";
import type { BroadcastConventionDto } from "../../../convention/use-cases/broadcast/broadcastConvention.dto";
import { CustomTimeGateway } from "../../time-gateway/adapters/CustomTimeGateway";
import {
  createInMemoryUow,
  type InMemoryUnitOfWork,
} from "../../unit-of-work/adapters/createInMemoryUow";
import { InMemoryUowPerformer } from "../../unit-of-work/adapters/InMemoryUowPerformer";
import { ApiConsumerBuilder } from "../adapters/InMemoryApiConsumerRepository";
import {
  type CallbackParams,
  InMemorySubscribersGateway,
} from "../adapters/InMemorySubscribersGateway";
import type { SubscriberResponse } from "../ports/SubscribersGateway";
import {
  type BroadcastToPartnersOnConventionUpdates,
  makeBroadcastToPartnersOnConventionUpdates,
} from "./BroadcastToPartnersOnConventionUpdates";

describe("Broadcast to partners on updated convention", () => {
  const counsellor1 = new ConnectedUserBuilder()
    .withId(uuid())
    .withEmail("counsellor1@email.com")
    .buildUser();
  const counsellor2 = new ConnectedUserBuilder()
    .withId(uuid())
    .withEmail("counsellor2@email.com")
    .buildUser();
  const counsellor3 = new ConnectedUserBuilder()
    .withId(uuid())
    .withEmail("counsellor3@email.com")
    .buildUser();
  const validator1 = new ConnectedUserBuilder()
    .withId(uuid())
    .withEmail("validator1@email.com")
    .buildUser();
  const validator2 = new ConnectedUserBuilder()
    .withId(uuid())
    .withEmail("validator2@email.com")
    .buildUser();

  const agency1Dto = new AgencyDtoBuilder()
    .withId("agency-1")
    .withValidatorEmails([validator1.email])
    .build();
  const agency1 = toAgencyWithRights(
    { ...agency1Dto, validatorEmails: [], counsellorEmails: [] },
    {
      [counsellor1.id]: { roles: ["counsellor"], isNotifiedByEmail: true },
      [validator1.id]: { roles: ["validator"], isNotifiedByEmail: true },
    },
  );

  const agency2Dto = new AgencyDtoBuilder()
    .withId("agency-2")
    .withValidatorEmails([validator2.email])
    .build();
  const agency2 = toAgencyWithRights(
    { ...agency2Dto, validatorEmails: [], counsellorEmails: [] },
    {
      [counsellor2.id]: { roles: ["counsellor"], isNotifiedByEmail: true },
      [validator2.id]: { roles: ["validator"], isNotifiedByEmail: true },
    },
  );

  const agencyWithRefersToDto = new AgencyDtoBuilder()
    .withId("agency-with-refers-to")
    .withKind("autre")
    .withValidatorEmails([validator1.email])
    .withRefersToAgencyInfo({
      refersToAgencyId: agency1Dto.id,
      refersToAgencyName: agency1Dto.name,
      refersToAgencyContactEmail: agency1Dto.contactEmail,
    })
    .build();
  const agencyWithRefersTo = toAgencyWithRights(
    { ...agencyWithRefersToDto, validatorEmails: [], counsellorEmails: [] },
    {
      [counsellor3.id]: { roles: ["counsellor"], isNotifiedByEmail: true },
      [validator1.id]: { roles: ["validator"], isNotifiedByEmail: true },
    },
  );

  const convention1 = new ConventionDtoBuilder()
    .withId("11111111-ee70-4c90-b3f4-668d492f7395")
    .withAgencyId(agency1.id)
    .build();

  const convention2 = new ConventionDtoBuilder()
    .withId("22222222-ee70-4c90-b3f4-668d492f7395")
    .withAgencyId(agency2.id)
    .build();

  const subscriptionParams: SubscriptionParams = {
    callbackHeaders: { authorization: "my-cb-auth-header" },
    callbackUrl: "https://www.my-service.com/convention-updated",
  };

  const apiConsumer1 = new ApiConsumerBuilder()
    .withId("my-api-consumer1")
    .withConventionRight({
      kinds: ["SUBSCRIPTION"],
      scope: { agencyIds: [agency1.id] },
      subscriptions: [
        {
          ...subscriptionParams,
          subscribedEvent: "convention.updated",
          createdAt: new Date().toISOString(),
          id: "my-subscription-id",
        },
      ],
    })
    .build();

  const callbackParams2: SubscriptionParams = {
    callbackHeaders: { authorization: "my-cb-auth-header" },
    callbackUrl: "https://www.my-service.com/convention-updated",
  };

  const apiConsumer2 = new ApiConsumerBuilder()
    .withId("my-api-consumer2")
    .withConventionRight({
      kinds: ["SUBSCRIPTION"],
      scope: { agencyIds: [agency2.id] },
      subscriptions: [
        {
          ...callbackParams2,
          subscribedEvent: "convention.updated",
          createdAt: new Date().toISOString(),
          id: "my-subscription-id",
        },
      ],
    })
    .build();

  const apiConsumerWithoutSubscription = new ApiConsumerBuilder()
    .withId("my-api-consumer-without-subscription")
    .withConventionRight({
      kinds: ["SUBSCRIPTION"],
      scope: { agencyIds: [agency1.id, agency2.id] },
      subscriptions: [],
    })
    .build();

  const apiConsumerNotAllowedToBeNotified = new ApiConsumerBuilder()
    .withId("my-api-consumer-not-allowed")
    .withConventionRight({
      kinds: ["READ"],
      scope: { agencyIds: [agency1.id] },
      subscriptions: [
        {
          ...subscriptionParams,
          subscribedEvent: "convention.updated",
          createdAt: new Date().toISOString(),
          id: "my-subscription-id",
        },
      ],
    })
    .build();

  let uow: InMemoryUnitOfWork;
  let uowPerformer: InMemoryUowPerformer;
  let subscribersGateway: InMemorySubscribersGateway;
  let broadcastUpdatedConvention: BroadcastToPartnersOnConventionUpdates;
  let timeGateway: CustomTimeGateway;

  beforeEach(() => {
    uow = createInMemoryUow();
    uowPerformer = new InMemoryUowPerformer(uow);
    subscribersGateway = new InMemorySubscribersGateway();
    timeGateway = new CustomTimeGateway();
    broadcastUpdatedConvention = makeBroadcastToPartnersOnConventionUpdates({
      uowPerformer,
      deps: {
        subscribersGateway,
        timeGateway,
        consumerNamesUsingRomeV3: [apiConsumer2.name],
      },
    });
    uow.userRepository.users = [
      counsellor1,
      counsellor2,
      counsellor3,
      validator1,
      validator2,
    ];
    uow.agencyRepository.agencies = [agency1, agency2, agencyWithRefersTo];
  });

  it("throws when convention is not found", async () => {
    const unknownConventionId = "00000000-0000-0000-0000-000000000000";
    uow.conventionRepository.setConventions([]);

    await expectPromiseToFailWithError(
      broadcastUpdatedConvention.execute({ conventionId: unknownConventionId }),
      errors.convention.notFound({ conventionId: unknownConventionId }),
    );
  });

  it("broadcast updated convention to agency only", async () => {
    uow.conventionRepository.setConventions([convention1, convention2]);
    uow.apiConsumerRepository.consumers = [
      apiConsumer1,
      apiConsumer2,
      apiConsumerNotAllowedToBeNotified,
      apiConsumerWithoutSubscription,
    ];

    await broadcastUpdatedConvention.execute({ conventionId: convention1.id });

    const expectedCallsAfterFirstExecute: CallbackParams[] = [
      {
        body: {
          subscribedEvent: "convention.updated",
          payload: {
            convention: toExpectedBroadcastConvention(convention1, agency1Dto),
          },
        },
        subscriptionParams,
      },
    ];

    expectToEqual(subscribersGateway.calls, expectedCallsAfterFirstExecute);

    await broadcastUpdatedConvention.execute({ conventionId: convention2.id });

    const expectedCallsAfterSecondExecute: CallbackParams[] = [
      ...expectedCallsAfterFirstExecute,
      {
        body: {
          subscribedEvent: "convention.updated",
          payload: {
            convention: toExpectedBroadcastConvention(convention2, agency2Dto),
          },
        },
        subscriptionParams: {
          callbackHeaders: callbackParams2.callbackHeaders,
          callbackUrl: callbackParams2.callbackUrl,
        },
      },
    ];

    expectToEqual(subscribersGateway.calls, expectedCallsAfterSecondExecute);
  });

  it("broadcast with Legacy Rome V3 when the consumer is still with this version", async () => {
    const convention = new ConventionDtoBuilder()
      .withId("22222222-ee70-4c90-b3f4-668d492f7395")
      .withAgencyId(agency2.id)
      .withImmersionAppellation(cartographeAppellationAndRome)
      .withStatus("ACCEPTED_BY_VALIDATOR")
      .build();

    const assessment = new AssessmentDtoBuilder()
      .withConventionId(convention.id)
      .build();

    uow.conventionRepository.setConventions([convention]);
    uow.assessmentRepository.assessments = [
      createAssessmentEntity(assessment, convention),
    ];
    uow.apiConsumerRepository.consumers = [apiConsumer2];

    await broadcastUpdatedConvention.execute({ conventionId: convention.id });

    expectToEqual(subscribersGateway.calls, [
      {
        body: {
          subscribedEvent: "convention.updated",
          payload: {
            convention: toExpectedBroadcastConvention(
              convention,
              agency2Dto,
              null,
              {
                ...cartographeAppellationAndRome,
                romeCode: "V3008",
                romeLabel: "Label V3 - Cartographe",
              },
            ),
            assessment: {
              conventionId: convention.id,
              status: "COMPLETED",
              endedWithAJob: false,
              establishmentFeedback: "Ca s'est bien passé",
              establishmentAdvices: "mon conseil",
            },
          },
        },
        subscriptionParams,
      },
    ]);
  });
  it("save webhook error", async () => {
    uow.conventionRepository.setConventions([convention1]);
    uow.apiConsumerRepository.consumers = [apiConsumer1];

    const now = new Date("2024-03-04T10:00:00Z");
    timeGateway.setNextDate(now);

    const errorResponse: SubscriberResponse = {
      title: "Partner subscription errored",
      callbackUrl: "http://fake.com",
      status: 200,
      subscriberErrorFeedback: { message: "ca va très mal" },
      body: { success: true },
    };

    subscribersGateway.simulatedResponse = errorResponse;

    await broadcastUpdatedConvention.execute({ conventionId: convention1.id });

    const expectedBroadcastFeedback: BroadcastFeedback = {
      consumerId: apiConsumer1.id,
      consumerName: apiConsumer1.name,
      conventionId: convention1.id,
      agencyId: convention1.agencyId,
      handledByAgency: false,
      subscriberErrorFeedback: errorResponse.subscriberErrorFeedback,
      occurredAt: now.toISOString(),
      requestParams: {
        callbackUrl: errorResponse.callbackUrl,
        conventionId: convention1.id,
        conventionStatus: convention1.status,
      },
      ...(errorResponse.status
        ? {
            response: {
              httpStatus: errorResponse.status,
              body: errorResponse.body,
            },
          }
        : {}),
      serviceName: "BroadcastToPartnersOnConventionUpdates",
    };

    expectToEqual(uow.broadcastFeedbacksRepository.broadcastFeedbacks, [
      expectedBroadcastFeedback,
    ]);
  });

  it("save feedback success", async () => {
    uow.conventionRepository.setConventions([convention1]);
    uow.apiConsumerRepository.consumers = [apiConsumer1];

    const now = new Date("2024-03-04T10:00:00Z");
    timeGateway.setNextDate(now);

    const successResponse: SubscriberResponse = {
      title: "Partner subscription notified successfully",
      callbackUrl: "http://fake.com",
      status: 200,
      body: { success: true },
    };

    subscribersGateway.simulatedResponse = successResponse;

    await broadcastUpdatedConvention.execute({ conventionId: convention1.id });

    const expectedBroadcastFeedback: BroadcastFeedback = {
      consumerId: apiConsumer1.id,
      consumerName: apiConsumer1.name,
      conventionId: convention1.id,
      agencyId: convention1.agencyId,
      handledByAgency: false,
      occurredAt: now.toISOString(),
      requestParams: {
        callbackUrl: successResponse.callbackUrl,
        conventionId: convention1.id,
        conventionStatus: convention1.status,
      },
      ...(successResponse.status
        ? {
            response: {
              httpStatus: successResponse.status,
              body: successResponse.body,
            },
          }
        : {}),
      serviceName: "BroadcastToPartnersOnConventionUpdates",
    };

    expectToEqual(uow.broadcastFeedbacksRepository.broadcastFeedbacks, [
      expectedBroadcastFeedback,
    ]);
  });

  it("broadcast updated convention to agency and agency refered to ", async () => {
    const conventionFromAgencyWithRefersTo = new ConventionDtoBuilder()
      .withId("11111111-ee70-4c90-b3f4-668d492f7397")
      .withAgencyId(agencyWithRefersTo.id)
      .withStatus("ACCEPTED_BY_VALIDATOR")
      .build();

    const assessment = new AssessmentDtoBuilder()
      .withConventionId(conventionFromAgencyWithRefersTo.id)
      .build();

    const apiConsumerWithSubscriptionOnAgencyWithReferesTo =
      new ApiConsumerBuilder()
        .withId("my-api-consumer-with-subscription-on-agency-with-referes-to")
        .withConventionRight({
          kinds: ["SUBSCRIPTION"],
          scope: { agencyIds: [agencyWithRefersTo.id] },
          subscriptions: [
            {
              ...subscriptionParams,
              subscribedEvent: "convention.updated",
              createdAt: new Date().toISOString(),
              id: "my-subscription-id",
            },
          ],
        })
        .build();

    uow.conventionRepository.setConventions([conventionFromAgencyWithRefersTo]);
    uow.assessmentRepository.assessments = [
      createAssessmentEntity(assessment, conventionFromAgencyWithRefersTo),
    ];
    uow.apiConsumerRepository.consumers = [
      apiConsumer1,
      apiConsumerWithSubscriptionOnAgencyWithReferesTo,
      apiConsumerNotAllowedToBeNotified,
      apiConsumerWithoutSubscription,
    ];

    await broadcastUpdatedConvention.execute({
      conventionId: conventionFromAgencyWithRefersTo.id,
    });

    const expectedCallsAfterFirstExecute: CallbackParams[] = [
      {
        body: {
          subscribedEvent: "convention.updated",
          payload: {
            convention: toExpectedBroadcastConvention(
              conventionFromAgencyWithRefersTo,
              agencyWithRefersToDto,
              agency1Dto,
            ),
            assessment: {
              conventionId: conventionFromAgencyWithRefersTo.id,
              status: "COMPLETED",
              endedWithAJob: false,
              establishmentFeedback: "Ca s'est bien passé",
              establishmentAdvices: "mon conseil",
            },
          },
        },
        subscriptionParams,
      },
      {
        body: {
          subscribedEvent: "convention.updated",
          payload: {
            convention: toExpectedBroadcastConvention(
              conventionFromAgencyWithRefersTo,
              agencyWithRefersToDto,
              agency1Dto,
            ),
            assessment: {
              conventionId: conventionFromAgencyWithRefersTo.id,
              status: "COMPLETED",
              endedWithAJob: false,
              establishmentFeedback: "Ca s'est bien passé",
              establishmentAdvices: "mon conseil",
            },
          },
        },
        subscriptionParams,
      },
    ];

    expectToEqual(subscribersGateway.calls, expectedCallsAfterFirstExecute);
  });

  describe("when broadcasting france travail kinds", () => {
    const franceTravailAgencyDto = new AgencyDtoBuilder()
      .withId("france-travail-agency")
      .withKind("france-travail")
      .withValidatorEmails([validator1.email])
      .build();
    const franceTravailAgency = toAgencyWithRights(
      { ...franceTravailAgencyDto, validatorEmails: [], counsellorEmails: [] },
      {
        [validator1.id]: { roles: ["validator"], isNotifiedByEmail: true },
      },
    );
    const agencyReferringToFranceTravailDto = new AgencyDtoBuilder()
      .withId("agency-referring-to-france-travail")
      .withKind("autre")
      .withValidatorEmails([validator1.email])
      .withRefersToAgencyInfo({
        refersToAgencyId: franceTravailAgencyDto.id,
        refersToAgencyName: franceTravailAgencyDto.name,
        refersToAgencyContactEmail: franceTravailAgencyDto.contactEmail,
      })
      .build();
    const agencyReferringToFranceTravail = toAgencyWithRights(
      {
        ...agencyReferringToFranceTravailDto,
        validatorEmails: [],
        counsellorEmails: [],
      },
      {
        [validator1.id]: { roles: ["validator"], isNotifiedByEmail: true },
      },
    );
    const apiConsumer = new ApiConsumerBuilder()
      .withId("pe-api-consumer")
      .withConventionRight({
        kinds: ["SUBSCRIPTION"],
        scope: {
          agencyIds: [
            franceTravailAgency.id,
            agencyReferringToFranceTravail.id,
          ],
        },
        subscriptions: [
          {
            ...subscriptionParams,
            subscribedEvent: "convention.updated",
            createdAt: new Date().toISOString(),
            id: "pe-subscription-id",
          },
        ],
      })
      .build();

    beforeEach(() => {
      uow.agencyRepository.agencies = [
        franceTravailAgency,
        agencyReferringToFranceTravail,
      ];
      uow.apiConsumerRepository.consumers = [apiConsumer];
    });

    it("broadcasts france travail agencyKind as pole-emploi", async () => {
      const convention = new ConventionDtoBuilder()
        .withId("33333333-ee70-4c90-b3f4-668d492f7395")
        .withAgencyId(franceTravailAgency.id)
        .build();
      uow.conventionRepository.setConventions([convention]);

      await broadcastUpdatedConvention.execute({ conventionId: convention.id });

      expectToEqual(subscribersGateway.calls, [
        {
          body: {
            subscribedEvent: "convention.updated",
            payload: {
              convention: toExpectedBroadcastConvention(
                convention,
                franceTravailAgencyDto,
              ),
            },
          },
          subscriptionParams,
        },
      ]);
    });

    it("broadcasts france travail agencyRefersTo.kind as pole-emploi", async () => {
      const convention = new ConventionDtoBuilder()
        .withId("44444444-ee70-4c90-b3f4-668d492f7395")
        .withAgencyId(agencyReferringToFranceTravail.id)
        .build();
      uow.conventionRepository.setConventions([convention]);

      await broadcastUpdatedConvention.execute({ conventionId: convention.id });

      expectToEqual(subscribersGateway.calls, [
        {
          body: {
            subscribedEvent: "convention.updated",
            payload: {
              convention: toExpectedBroadcastConvention(
                convention,
                agencyReferringToFranceTravailDto,
                franceTravailAgencyDto,
              ),
            },
          },
          subscriptionParams,
        },
      ]);
    });
  });

  describe("when previousAgencyId is provided (convention transfer)", () => {
    const previousAgency = toAgencyWithRights(
      new AgencyDtoBuilder()
        .withId("previous-agency")
        .withKind("france-travail")
        .build(),
      {
        [counsellor1.id]: { roles: ["counsellor"], isNotifiedByEmail: true },
        [validator1.id]: { roles: ["validator"], isNotifiedByEmail: true },
      },
    );

    const previousAgencySubscriptionParams: SubscriptionParams = {
      callbackHeaders: { authorization: "prev-agency-auth" },
      callbackUrl: "https://www.previous-agency-service.com/convention-updated",
    };

    const apiConsumerForPreviousAgency = new ApiConsumerBuilder()
      .withId("api-consumer-previous-agency")
      .withConventionRight({
        kinds: ["SUBSCRIPTION"],
        scope: { agencyIds: [previousAgency.id] },
        subscriptions: [
          {
            ...previousAgencySubscriptionParams,
            subscribedEvent: "convention.updated",
            createdAt: new Date().toISOString(),
            id: "prev-subscription-id",
          },
        ],
      })
      .build();

    it("broadcasts to previous agency's consumers when transferring", async () => {
      uow.agencyRepository.agencies = [
        agency1,
        agency2,
        agencyWithRefersTo,
        previousAgency,
      ];
      uow.conventionRepository.setConventions([convention1]);
      uow.apiConsumerRepository.consumers = [
        apiConsumer1,
        apiConsumerForPreviousAgency,
      ];

      await broadcastUpdatedConvention.execute({
        conventionId: convention1.id,
        previousAgencyId: previousAgency.id,
      });

      expectToEqual(subscribersGateway.calls.length, 2);
      expectToEqual(
        subscribersGateway.calls.map(
          ({ subscriptionParams }) => subscriptionParams,
        ),
        [subscriptionParams, previousAgencySubscriptionParams],
      );
    });

    it("does not double-broadcast when previous agency consumer already matches new agency", async () => {
      uow.agencyRepository.agencies = [
        agency1,
        agency2,
        agencyWithRefersTo,
        previousAgency,
      ];
      uow.conventionRepository.setConventions([convention1]);
      uow.apiConsumerRepository.consumers = [apiConsumer1];

      await broadcastUpdatedConvention.execute({
        conventionId: convention1.id,
        previousAgencyId: previousAgency.id,
      });

      expectToEqual(subscribersGateway.calls.length, 1);
    });

    it("works the same as without previousAgencyId when previous agency has no matching consumers", async () => {
      const agencyWithNoConsumers = toAgencyWithRights(
        new AgencyDtoBuilder()
          .withId("no-consumers-agency")
          .withKind("autre" as AgencyKind)
          .build(),
      );
      uow.agencyRepository.agencies = [
        agency1,
        agency2,
        agencyWithRefersTo,
        agencyWithNoConsumers,
      ];
      uow.conventionRepository.setConventions([convention1]);
      uow.apiConsumerRepository.consumers = [apiConsumer1];

      await broadcastUpdatedConvention.execute({
        conventionId: convention1.id,
        previousAgencyId: agencyWithNoConsumers.id,
      });

      expectToEqual(subscribersGateway.calls.length, 1);
    });
  });
});

const toExpectedBroadcastConvention = (
  convention: ConventionDto,
  agency: AgencyDto,
  refersToAgency: AgencyDto | null = null,
  immersionAppellation?: AppellationAndRomeDto,
): BroadcastConventionDto => ({
  id: convention.id,
  status: convention.status,
  statusJustification: convention.statusJustification,
  agencyId: convention.agencyId,
  dateSubmission: convention.dateSubmission,
  dateStart: convention.dateStart,
  dateEnd: convention.dateEnd,
  dateValidation: convention.dateValidation,
  dateApproval: convention.dateApproval,
  siret: convention.siret,
  businessName: convention.businessName,
  schedule: convention.schedule,
  workConditions: convention.workConditions,
  businessAdvantages: convention.businessAdvantages,
  individualProtection: convention.individualProtection,
  individualProtectionDescription: convention.individualProtectionDescription,
  sanitaryPrevention: convention.sanitaryPrevention,
  sanitaryPreventionDescription: convention.sanitaryPreventionDescription,
  immersionAddress: convention.immersionAddress,
  immersionObjective: convention.immersionObjective,
  immersionAppellation: immersionAppellation ?? convention.immersionAppellation,
  immersionActivities: convention.immersionActivities,
  immersionSkills: convention.immersionSkills,
  establishmentNumberEmployeesRange:
    convention.establishmentNumberEmployeesRange,
  establishmentTutor: convention.establishmentTutor,
  validators: convention.validators,
  agencyReferent: convention.agencyReferent,
  renewed: convention.renewed,
  internshipKind: convention.internshipKind,
  signatories: convention.signatories,
  agencyName: agency.name,
  agencyDepartment: agency.address.departmentCode,
  agencyKind: agency.kind === "france-travail" ? "pole-emploi" : agency.kind,
  agencySiret: agency.agencySiret,
  agencyCodeSafir: agency.codeSafir,
  agencyValidatorEmails: agency.validatorEmails,
  ...(refersToAgency
    ? {
        agencyRefersTo: {
          id: refersToAgency.id,
          name: refersToAgency.name,
          kind:
            refersToAgency.kind === "france-travail"
              ? "pole-emploi"
              : refersToAgency.kind,
          siret: refersToAgency.agencySiret,
          codeSafir: refersToAgency.codeSafir,
        },
      }
    : {}),
  isEstablishmentBanned: false,
});
