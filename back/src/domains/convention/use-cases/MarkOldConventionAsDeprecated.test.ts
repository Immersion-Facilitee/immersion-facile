import {
  ConventionDtoBuilder,
  expectToEqual,
  reasonableSchedule,
} from "shared";
import { makeCreateNewEvent } from "../../core/events/ports/EventBus";
import { CustomTimeGateway } from "../../core/time-gateway/adapters/CustomTimeGateway";
import {
  createInMemoryUow,
  type InMemoryUnitOfWork,
} from "../../core/unit-of-work/adapters/createInMemoryUow";
import { InMemoryUowPerformer } from "../../core/unit-of-work/adapters/InMemoryUowPerformer";
import { TestUuidGenerator } from "../../core/uuid-generator/adapters/UuidGeneratorImplementations";
import {
  type MarkOldConventionAsDeprecated,
  makeMarkOldConventionAsDeprecated,
} from "./MarkOldConventionAsDeprecated";

describe("MarkOldConventionAsDeprecated", () => {
  let uow: InMemoryUnitOfWork;
  let markOldConventionAsDeprecated: MarkOldConventionAsDeprecated;

  beforeEach(() => {
    uow = createInMemoryUow();
    const createNewEvent = makeCreateNewEvent({
      timeGateway: new CustomTimeGateway(),
      uuidGenerator: new TestUuidGenerator(),
    });
    markOldConventionAsDeprecated = makeMarkOldConventionAsDeprecated({
      uowPerformer: new InMemoryUowPerformer(uow),
      deps: {
        createNewEvent,
      },
    });
  });

  it("should mark old conventions as deprecated", async () => {
    const conventionToDeprecate = new ConventionDtoBuilder()
      .withId("11111111-1111-4111-a111-111111111111")
      .withStatus("PARTIALLY_SIGNED")
      .withDateStart(new Date("2025-02-12").toISOString())
      .withDateEnd(new Date("2025-02-14").toISOString())
      .withSchedule(reasonableSchedule)
      .build();
    const conventionToKeep = new ConventionDtoBuilder()
      .withId("11111111-1111-4111-a111-111111111112")
      .withStatus("PARTIALLY_SIGNED")
      .withDateStart(new Date("2025-04-12").toISOString())
      .withDateEnd(new Date("2025-04-14").toISOString())
      .withSchedule(reasonableSchedule)
      .build();
    uow.conventionRepository.setConventions([
      conventionToDeprecate,
      conventionToKeep,
    ]);

    const result = await markOldConventionAsDeprecated.execute({
      deprecateSince: new Date("2025-03-15"),
    });

    expect(result.numberOfUpdatedConventions).toBe(1);

    const expectedDeprecatedConvention = {
      ...conventionToDeprecate,
      status: "DEPRECATED" as const,
      statusJustification:
        "Devenu obsolète car le statut était PARTIALLY_SIGNED alors que la date de fin est dépassée depuis longtemps",
    };

    expectToEqual(uow.conventionRepository.conventions, [
      expectedDeprecatedConvention,
      conventionToKeep,
    ]);
    expect(uow.outboxRepository.events).toHaveLength(1);
    expect(uow.outboxRepository.events[0].topic).toEqual(
      "ConventionDeprecated",
    );
  });
});
