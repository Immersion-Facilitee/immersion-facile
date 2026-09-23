import { faker } from "@faker-js/faker";
import {
  addBusinessDays,
  addDays,
  differenceInBusinessDays,
  subDays,
} from "date-fns";
import {
  AgencyDtoBuilder,
  type AgencyId,
  type ConventionDto,
  ConventionDtoBuilder,
  type ConventionStatus,
  conventionStatuses,
  errors,
  expectObjectInArrayToMatch,
  expectPromiseToFailWithError,
  expectToEqual,
} from "shared";
import { toAgencyWithRights } from "../../../utils/agency";
import type { DomainEvent } from "../../core/events/events";
import { makeCreateNewEvent } from "../../core/events/ports/EventBus";
import { CustomTimeGateway } from "../../core/time-gateway/adapters/CustomTimeGateway";
import {
  createInMemoryUow,
  type InMemoryUnitOfWork,
} from "../../core/unit-of-work/adapters/createInMemoryUow";
import { InMemoryUowPerformer } from "../../core/unit-of-work/adapters/InMemoryUowPerformer";
import { TestUuidGenerator } from "../../core/uuid-generator/adapters/UuidGeneratorImplementations";
import {
  type ConventionsReminder,
  makeConventionsReminder,
} from "./ConventionsReminder";

describe("ConventionReminder use case", () => {
  const now = new Date("2023-03-17");
  const eventIds = ["event-1", "event-2", "event-3", "event-4"];
  const topic = "ConventionReminderRequired";
  const needSignatureStatuses: ConventionStatus[] = [
    "READY_TO_SIGN",
    "PARTIALLY_SIGNED",
  ];
  const needReviewStatuses: ConventionStatus[] = ["IN_REVIEW"];
  const agency = new AgencyDtoBuilder().build();

  let uow: InMemoryUnitOfWork;
  let conventionsReminder: ConventionsReminder;

  beforeEach(() => {
    const uuidGenerator = new TestUuidGenerator();
    const timeGateway = new CustomTimeGateway(now);

    uow = createInMemoryUow();
    uuidGenerator.setNextUuids([...eventIds]);

    conventionsReminder = makeConventionsReminder({
      uowPerformer: new InMemoryUowPerformer(uow),
      deps: {
        timeGateway,
        createNewEvent: makeCreateNewEvent({
          timeGateway,
          uuidGenerator,
        }),
      },
    });
  });

  describe("Do nothing", () => {
    it("When there is no convention that have status different of READY_TO_SIGN, PARTIALLY_SIGNED or IN_REVIEW.", async () => {
      // Arrange
      const conventionsWithUnsupportedStatuses =
        makeOneConventionOfEachStatuses({
          withDateStart: now,
          agencyId: agency.id,
        }).filter(
          ({ status }) =>
            ![...needSignatureStatuses, ...needReviewStatuses].includes(status),
        );

      uow.conventionRepository.setConventions(
        conventionsWithUnsupportedStatuses,
      );

      // Act
      const summary = await conventionsReminder.execute();

      //Assert
      expectToEqual(summary, {
        success: 0,
        failures: [],
      });
      expectToEqual(uow.outboxRepository.events, []);
      expectToEqual(
        uow.conventionRepository.conventions,
        conventionsWithUnsupportedStatuses,
      );
    });

    it("When there is conventions that is above 1 open day after internship starts", async () => {
      // Arrange
      const { startDate, startDateDifference } = prepareDates(now, -1);
      expect(startDateDifference < 0).toBeTruthy();

      const conventions = makeOneConventionOfEachStatuses({
        withDateStart: startDate,
        agencyId: agency.id,
      });
      uow.conventionRepository.setConventions(conventions);

      // Act
      const summary = await conventionsReminder.execute();

      //Assert
      expectToEqual(summary, {
        success: 0,
        failures: [],
      });
      expectToEqual(uow.outboxRepository.events, []);
      expectToEqual(uow.conventionRepository.conventions, conventions);
    });
  });

  it("Throw an error when convention to remind does not validate schema", async () => {
    const { startDate, startDateDifference } = prepareDates(now, 2);
    expect(0 < startDateDifference && startDateDifference <= 3).toBeTruthy();

    const convention = new ConventionDtoBuilder()
      .withId("conventionId")
      .withAgencyId(agency.id)
      .withStatus("IN_REVIEW")
      .withDateStart(startDate.toISOString())
      .withDateSubmission(subDays(startDate, 10).toISOString())
      .build();

    uow.conventionRepository.setConventions([convention]);
    uow.agencyRepository.agencies = [toAgencyWithRights(agency)];

    await expectPromiseToFailWithError(
      conventionsReminder.execute(),
      errors.inputs.badSchema({
        id: convention.id,
        schemaName: "conventionSchema",
        flattenErrors: [
          "id : Le format de l'identifiant est invalide",
          "dateEnd : La durée maximale calendaire d'une immersion est de 30 jours.",
        ],
      }),
    );
  });

  describe("Send 'ConventionReminderRequired' event", () => {
    it(`with kind 'FirstReminderForAgency'
        when there is a convention that is between 3 and 2 open days before interships start depending of convention statuses.`, async () => {
      // Arrange
      const { startDate, startDateDifference } = prepareDates(now, 3);
      expect(2 < startDateDifference && startDateDifference <= 3).toBeTruthy();

      const conventions = makeOneConventionOfEachStatuses({
        withDateStart: startDate,
        withDateSubmission: subDays(now, 2),
        agencyId: agency.id,
      });
      uow.conventionRepository.setConventions(conventions);
      uow.agencyRepository.agencies = [toAgencyWithRights(agency)];

      // Act
      const summary = await conventionsReminder.execute();

      //Assert
      const supportedConventions = conventions.filter((convention) =>
        [...needReviewStatuses, ...needSignatureStatuses].includes(
          convention.status,
        ),
      );
      const expectedEvents: Partial<DomainEvent>[] = [
        {
          id: eventIds[0],
          topic,
          payload: {
            reminderKind: "FirstReminderForAgency",
            conventionId: supportedConventions[2].id,
          },
        },
      ];

      expectToEqual(summary, {
        success: expectedEvents.length,
        failures: [],
      });
      expectObjectInArrayToMatch(uow.outboxRepository.events, expectedEvents);
      expectToEqual(uow.conventionRepository.conventions, conventions);
    });

    it(`with kind 'LastReminderForAgency'
        when there is a convention that is below 1 open days before interships start depending on conventions statuses.`, async () => {
      // Arrange
      const { startDate, startDateDifference } = prepareDates(now, 1);
      expect(0 < startDateDifference && startDateDifference <= 1).toBeTruthy();

      const conventions = makeOneConventionOfEachStatuses({
        withDateStart: startDate,
        agencyId: agency.id,
      });
      uow.conventionRepository.setConventions(conventions);
      uow.agencyRepository.agencies = [toAgencyWithRights(agency)];

      // Act
      const summary = await conventionsReminder.execute();

      //Assert

      const conventionsNeeds24 = conventions.filter((convention) =>
        needReviewStatuses.includes(convention.status),
      );

      const events: Partial<DomainEvent>[] = [
        {
          id: eventIds[0],
          topic,
          payload: {
            reminderKind: "LastReminderForAgency",
            conventionId: conventionsNeeds24[0].id,
          },
        },
      ];
      expectToEqual(summary, {
        success: events.length,
        failures: [],
      });
      expectObjectInArrayToMatch(uow.outboxRepository.events, events);
      expectToEqual(uow.conventionRepository.conventions, conventions);
    });
  });
});

const makeOneConventionOfEachStatuses = ({
  withDateStart,
  withDateSubmission = subDays(withDateStart, 10),
  agencyId,
}: {
  withDateStart: Date;
  withDateSubmission?: Date;
  agencyId: AgencyId;
}): ConventionDto[] =>
  conventionStatuses.map((conventionStatus) =>
    new ConventionDtoBuilder()
      .withId(faker.string.uuid())
      .withAgencyId(agencyId)
      .withStatus(conventionStatus)
      .withDateStart(withDateStart.toISOString())
      .withDateEnd(addDays(withDateStart, 2).toISOString())
      .withDateSubmission(withDateSubmission.toISOString())
      .build(),
  );

const prepareDates = (now: Date, businessDaysToAdd: number) => {
  const startDate = addBusinessDays(now, businessDaysToAdd);
  return {
    startDate,
    startDateDifference: differenceInBusinessDays(startDate, now),
  };
};
