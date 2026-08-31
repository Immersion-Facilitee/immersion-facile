import {
  ConventionDtoBuilder,
  conventionStatuses,
  DiscussionBuilder,
  errors,
  expectPromiseToFailWithError,
  expectToEqual,
} from "shared";
import type { DomainEvent } from "../../core/events/events";
import {
  type CreateNewEvent,
  defaultPriority,
  makeCreateNewEvent,
} from "../../core/events/ports/EventBus";
import {
  InMemorySiretGateway,
  SiretEstablishmentDtoBuilder,
} from "../../core/sirene/adapters/InMemorySiretGateway";
import { CustomTimeGateway } from "../../core/time-gateway/adapters/CustomTimeGateway";
import {
  createInMemoryUow,
  type InMemoryUnitOfWork,
} from "../../core/unit-of-work/adapters/createInMemoryUow";
import { InMemoryUowPerformer } from "../../core/unit-of-work/adapters/InMemoryUowPerformer";
import { TestUuidGenerator } from "../../core/uuid-generator/adapters/UuidGeneratorImplementations";
import { type AddConvention, makeAddConvention } from "./AddConvention";

const validConvention = new ConventionDtoBuilder().build();

describe("Add Convention", () => {
  let addConvention: AddConvention;
  let createNewEvent: CreateNewEvent;
  let siretGateway: InMemorySiretGateway;
  let timeGateway: CustomTimeGateway;
  let uow: InMemoryUnitOfWork;
  let uuidGenerator: TestUuidGenerator;

  beforeEach(() => {
    uow = createInMemoryUow();
    timeGateway = new CustomTimeGateway();
    uuidGenerator = new TestUuidGenerator();
    createNewEvent = makeCreateNewEvent({
      timeGateway,
      uuidGenerator,
    });
    siretGateway = new InMemorySiretGateway();
    const uowPerformer = new InMemoryUowPerformer(uow);
    addConvention = makeAddConvention({
      uowPerformer,
      deps: {
        createNewEvent,
        siretGateway,
      },
    });
  });

  it("saves valid conventions in the repository", async () => {
    const occurredAt = new Date("2021-10-15T15:00");
    const id = "eventId";
    timeGateway.setNextDate(occurredAt);
    uuidGenerator.setNextUuid(id);

    expect(
      await addConvention.execute({ convention: validConvention }),
    ).toEqual({
      id: validConvention.id,
    });

    const storedInRepo = uow.conventionRepository.conventions;
    expect(storedInRepo[0]).toEqual(validConvention);
    expectDomainEventsToBeInOutbox([
      {
        id,
        occurredAt: occurredAt.toISOString(),
        topic: "ConventionSubmittedByBeneficiary",
        payload: { convention: validConvention, triggeredBy: null },
        publications: [],
        status: "never-published",
        wasQuarantined: false,
        priority: defaultPriority,
      },
    ]);
  });

  it("saves valid conventions with agency referent firstname and lastname in the repository", async () => {
    const occurredAt = new Date("2021-10-15T15:00");
    const id = "eventId";
    timeGateway.setNextDate(occurredAt);
    uuidGenerator.setNextUuid(id);

    const validConventionWithAgencyReferent = {
      ...validConvention,
      agencyReferent: {
        firstname: "Fredy",
        lastname: "L'ACCOMPAGNATEUR",
      },
    };
    expect(
      await addConvention.execute({
        convention: validConventionWithAgencyReferent,
      }),
    ).toEqual({
      id: validConvention.id,
    });

    const storedInRepo = uow.conventionRepository.conventions;
    expect(storedInRepo[0]).toEqual(validConventionWithAgencyReferent);
    expectDomainEventsToBeInOutbox([
      {
        id,
        occurredAt: occurredAt.toISOString(),
        topic: "ConventionSubmittedByBeneficiary",
        payload: {
          convention: validConventionWithAgencyReferent,
          triggeredBy: null,
        },
        publications: [],
        status: "never-published",
        wasQuarantined: false,
        priority: defaultPriority,
      },
    ]);
  });

  it("sends conventionDraftId in the event and add it to the convention when the convention was created from a draft", async () => {
    const fromConventionDraftId = "550e8400-e29b-41d4-a716-446655440000";
    const occurredAt = new Date("2021-10-15T15:00");
    const id = "eventId";
    timeGateway.setNextDate(occurredAt);
    uuidGenerator.setNextUuid(id);

    expectToEqual(
      await addConvention.execute({
        convention: validConvention,
        fromConventionDraftId,
      }),
      {
        id: validConvention.id,
      },
    );

    expectDomainEventsToBeInOutbox([
      {
        id,
        occurredAt: occurredAt.toISOString(),
        topic: "ConventionSubmittedByBeneficiary",
        payload: {
          convention: validConvention,
          conventionDraftId: fromConventionDraftId,
          triggeredBy: null,
        },
        publications: [],
        status: "never-published",
        wasQuarantined: false,
        priority: defaultPriority,
      },
    ]);
    expectToEqual(uow.conventionRepository.conventions, [
      { ...validConvention, sourceConventionDraftId: fromConventionDraftId },
    ]);
  });

  it("also sends the discussionId in the event, if initialy provided to the use case", async () => {
    const discussion = new DiscussionBuilder().build();
    const occurredAt = new Date("2021-10-15T15:00");
    const id = "eventId";
    timeGateway.setNextDate(occurredAt);
    uuidGenerator.setNextUuid(id);

    expect(
      await addConvention.execute({
        convention: validConvention,
        discussionId: discussion.id,
      }),
    ).toEqual({
      id: validConvention.id,
    });

    const storedInRepo = uow.conventionRepository.conventions;
    expect(storedInRepo[0]).toEqual(validConvention);
    expectDomainEventsToBeInOutbox([
      {
        id,
        occurredAt: occurredAt.toISOString(),
        topic: "ConventionSubmittedByBeneficiary",
        payload: {
          convention: validConvention,
          discussionId: discussion.id,
          triggeredBy: null,
        },
        publications: [],
        status: "never-published",
        wasQuarantined: false,
        priority: defaultPriority,
      },
    ]);
  });

  it("rejects conventions where the ID is already in use", async () => {
    await uow.conventionRepository.save(validConvention);

    await expectPromiseToFailWithError(
      addConvention.execute({ convention: validConvention }),
      errors.convention.conflict({ conventionId: validConvention.id }),
    );
  });

  describe("Status validation", () => {
    // This might be nice for "backing up" entered data, but not implemented in front end as of Dec 16, 2021

    it("allows applications submitted as READY_TO_SIGN", async () => {
      expect(
        await addConvention.execute({
          convention: {
            ...validConvention,
            status: "READY_TO_SIGN",
          },
        }),
      ).toEqual({
        id: validConvention.id,
      });
    });

    it("rejects applications if the status is not READY_TO_SIGN", async () => {
      for (const status of conventionStatuses) {
        if (status === "READY_TO_SIGN") {
          continue;
        }
        await expectPromiseToFailWithError(
          addConvention.execute({
            convention: {
              ...validConvention,
              status,
            },
          }),
          errors.convention.forbiddenStatus({ status }),
        );
      }
    });
  });

  describe("SIRET validation", () => {
    const siretRawEstablishmentBuilder = new SiretEstablishmentDtoBuilder()
      .withSiret(validConvention.siret)
      .withNafDto({ code: "78.3Z", nomenclature: "Ref2" });

    const siretRawInactiveEstablishment = siretRawEstablishmentBuilder
      .withBusinessName("INACTIVE BUSINESS")
      .withIsActive(false)
      .build();

    const siretRawActiveEstablishment = siretRawEstablishmentBuilder
      .withBusinessName("Active BUSINESS")
      .withIsActive(true)
      .build();

    it("rejects applications with SIRETs that don't correspond to active businesses", async () => {
      siretGateway.setSirenEstablishment(siretRawInactiveEstablishment);

      await expectPromiseToFailWithError(
        addConvention.execute({ convention: validConvention }),
        errors.establishment.missingOrClosed({ siret: validConvention.siret }),
      );
    });

    it("accepts applications with SIRETs that  correspond to active businesses", async () => {
      siretGateway.setSirenEstablishment(siretRawActiveEstablishment);

      expect(
        await addConvention.execute({ convention: validConvention }),
      ).toEqual({
        id: validConvention.id,
      });
    });

    it("Throws errors when the SIRET endpoint throws erorrs", async () => {
      siretGateway.setError(errors.generic.testError("test error"));

      await expectPromiseToFailWithError(
        addConvention.execute({ convention: validConvention }),
        errors.siretApi.unavailable({ serviceName: "Sirene API" }),
      );
    });
  });

  const expectDomainEventsToBeInOutbox = (expected: DomainEvent[]) => {
    expect(uow.outboxRepository.events).toEqual(expected);
  };
});
