import { addDays, subMonths } from "date-fns";
import {
  AgencyDtoBuilder,
  expectObjectInArrayToMatch,
  expectToEqual,
} from "shared";
import { toAgencyWithRights } from "../../../utils/agency";
import { makeCreateNewEvent } from "../../core/events/ports/EventBus";
import { CustomTimeGateway } from "../../core/time-gateway/adapters/CustomTimeGateway";
import {
  createInMemoryUow,
  type InMemoryUnitOfWork,
} from "../../core/unit-of-work/adapters/createInMemoryUow";
import { InMemoryUowPerformer } from "../../core/unit-of-work/adapters/InMemoryUowPerformer";
import { TestUuidGenerator } from "../../core/uuid-generator/adapters/UuidGeneratorImplementations";
import {
  type DelegationConventionReminder,
  makeDelegationConventionReminder,
} from "./DelegationConventionReminder";

describe("DelegationConventionReminder", () => {
  const eventIds = ["event-1", "event-2", "event-3", "event-4"];
  const topic = "DelegationConventionReminderRequired";

  const delegationEndDate = new Date("2026-06-30");
  const delegationEndDateIso = delegationEndDate.toISOString();

  const agencyWithDelegation = new AgencyDtoBuilder()
    .withId("agency-with-delegation")
    .withKind("autre")
    .withStatus("active")
    .withDelegationAgencyInfo({
      delegationEndDate: delegationEndDateIso,
      delegationAgencyName: "DR France Travail",
      delegationAgencyKind: "france-travail",
    })
    .build();

  let uow: InMemoryUnitOfWork;
  let timeGateway: CustomTimeGateway;
  let delegationConventionReminder: DelegationConventionReminder;

  beforeEach(() => {
    const uuidGenerator = new TestUuidGenerator();
    uuidGenerator.setNextUuids([...eventIds]);
    timeGateway = new CustomTimeGateway();
    uow = createInMemoryUow();
    delegationConventionReminder = makeDelegationConventionReminder({
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

  it("emits threeMonthsBefore event when delegation ends in 3 months", async () => {
    timeGateway.setNextDate(subMonths(delegationEndDate, 3));
    uow.agencyRepository.agencies = [
      toAgencyWithRights(agencyWithDelegation, {}),
    ];

    const summary = await delegationConventionReminder.execute();

    expectToEqual(summary, { success: 1, failures: [] });
    expectObjectInArrayToMatch(uow.outboxRepository.events, [
      {
        topic,
        payload: {
          agencyId: agencyWithDelegation.id,
          reminderKind: "threeMonthsBefore",
        },
      },
    ]);
  });

  it("emits oneMonthBefore event when delegation ends in 1 month", async () => {
    timeGateway.setNextDate(subMonths(delegationEndDate, 1));
    uow.agencyRepository.agencies = [
      toAgencyWithRights(agencyWithDelegation, {}),
    ];

    const summary = await delegationConventionReminder.execute();

    expectToEqual(summary, { success: 1, failures: [] });
    expectObjectInArrayToMatch(uow.outboxRepository.events, [
      {
        topic,
        payload: {
          agencyId: agencyWithDelegation.id,
          reminderKind: "oneMonthBefore",
        },
      },
    ]);
  });

  it("emits dayAfterExpiry event the day after delegation end", async () => {
    timeGateway.setNextDate(addDays(delegationEndDate, 1));
    uow.agencyRepository.agencies = [
      toAgencyWithRights(agencyWithDelegation, {}),
    ];

    const summary = await delegationConventionReminder.execute();

    expectToEqual(summary, { success: 1, failures: [] });
    expectObjectInArrayToMatch(uow.outboxRepository.events, [
      {
        topic,
        payload: {
          agencyId: agencyWithDelegation.id,
          reminderKind: "dayAfterExpiry",
        },
      },
    ]);
  });

  it("does not emit event when convention expired and reminder runs months later", async () => {
    timeGateway.setNextDate(new Date("2025-06-01"));
    const agency = new AgencyDtoBuilder()
      .withId("agency-expired")
      .withKind("autre")
      .withStatus("active")
      .withDelegationAgencyInfo({
        delegationEndDate: new Date("2025-01-01").toISOString(),
        delegationAgencyName: "DR France Travail",
        delegationAgencyKind: "france-travail",
      })
      .build();
    uow.agencyRepository.agencies = [toAgencyWithRights(agency, {})];

    const summary = await delegationConventionReminder.execute();

    expectToEqual(summary, { success: 0, failures: [] });
    expectToEqual(uow.outboxRepository.events, []);
  });

  it("does not emit event when reminder runs before any reminder date", async () => {
    timeGateway.setNextDate(new Date("2026-01-01"));
    uow.agencyRepository.agencies = [
      toAgencyWithRights(agencyWithDelegation, {}),
    ];

    const summary = await delegationConventionReminder.execute();

    expectToEqual(summary, { success: 0, failures: [] });
    expectToEqual(uow.outboxRepository.events, []);
  });

  it("does not emit event when threeMonthsBefore reminder was already sent", async () => {
    timeGateway.setNextDate(subMonths(delegationEndDate, 3));
    uow.agencyRepository.agencies = [
      toAgencyWithRights(agencyWithDelegation, {}),
    ];
    uow.notificationRepository.notifications = [
      {
        id: "past-notification",
        createdAt: new Date().toISOString(),
        kind: "email",
        followedIds: { agencyId: agencyWithDelegation.id },
        templatedContent: {
          kind: "AGENCY_DELEGATION_CONVENTION_EXPIRING_SOON",
          recipients: ["contact@example.com"],
          params: {
            agencyName: agencyWithDelegation.name,
            delegationEndDate: delegationEndDateIso,
            delegationAgencyName: "DR France Travail",
            reminderKind: "threeMonthsBefore",
          },
        },
      },
    ];

    const summary = await delegationConventionReminder.execute();

    expectToEqual(summary, { success: 0, failures: [] });
    expectToEqual(uow.outboxRepository.events, []);
  });

  it("does not emit event when oneMonthBefore reminder was already sent", async () => {
    timeGateway.setNextDate(subMonths(delegationEndDate, 1));
    uow.agencyRepository.agencies = [
      toAgencyWithRights(agencyWithDelegation, {}),
    ];
    uow.notificationRepository.notifications = [
      {
        id: "past-notification",
        createdAt: new Date().toISOString(),
        kind: "email",
        followedIds: { agencyId: agencyWithDelegation.id },
        templatedContent: {
          kind: "AGENCY_DELEGATION_CONVENTION_EXPIRING_SOON",
          recipients: ["contact@example.com"],
          params: {
            agencyName: agencyWithDelegation.name,
            delegationEndDate: delegationEndDateIso,
            delegationAgencyName: "DR France Travail",
            reminderKind: "oneMonthBefore",
          },
        },
      },
    ];

    const summary = await delegationConventionReminder.execute();

    expectToEqual(summary, { success: 0, failures: [] });
    expectToEqual(uow.outboxRepository.events, []);
  });

  it("does not emit event when dayAfterExpiry reminder was already sent", async () => {
    timeGateway.setNextDate(addDays(delegationEndDate, 1));
    uow.agencyRepository.agencies = [
      toAgencyWithRights(agencyWithDelegation, {}),
    ];
    uow.notificationRepository.notifications = [
      {
        id: "past-notification",
        createdAt: new Date().toISOString(),
        kind: "email",
        followedIds: { agencyId: agencyWithDelegation.id },
        templatedContent: {
          kind: "AGENCY_DELEGATION_CONVENTION_EXPIRED",
          recipients: ["contact@example.com"],
          params: {
            agencyName: agencyWithDelegation.name,
            delegationAgencyName: "DR France Travail",
            delegationAgencyKind: "france-travail",
          },
        },
      },
    ];

    const summary = await delegationConventionReminder.execute();

    expectToEqual(summary, { success: 0, failures: [] });
    expectToEqual(uow.outboxRepository.events, []);
  });
  it("emits oneMonthBefore event when threeMonthsBefore was already sent", async () => {
    timeGateway.setNextDate(subMonths(delegationEndDate, 1));
    uow.agencyRepository.agencies = [
      toAgencyWithRights(agencyWithDelegation, {}),
    ];
    uow.notificationRepository.notifications = [
      {
        id: "past-notification",
        createdAt: new Date().toISOString(),
        kind: "email",
        followedIds: { agencyId: agencyWithDelegation.id },
        templatedContent: {
          kind: "AGENCY_DELEGATION_CONVENTION_EXPIRING_SOON",
          recipients: ["contact@example.com"],
          params: {
            agencyName: agencyWithDelegation.name,
            delegationEndDate: delegationEndDateIso,
            delegationAgencyName: "DR France Travail",
            reminderKind: "threeMonthsBefore",
          },
        },
      },
    ];

    const summary = await delegationConventionReminder.execute();

    expectToEqual(summary, { success: 1, failures: [] });
    expectObjectInArrayToMatch(uow.outboxRepository.events, [
      {
        topic,
        payload: {
          agencyId: agencyWithDelegation.id,
          reminderKind: "oneMonthBefore",
        },
      },
    ]);
  });

  it("returns failure when outbox save fails", async () => {
    timeGateway.setNextDate(subMonths(delegationEndDate, 3));
    uow.agencyRepository.agencies = [
      toAgencyWithRights(agencyWithDelegation, {}),
    ];
    const saveError = new Error("outbox save failed");
    uow.outboxRepository.save = async () => Promise.reject(saveError);

    const summary = await delegationConventionReminder.execute();

    expectToEqual(summary, {
      success: 0,
      failures: [{ id: agencyWithDelegation.id, error: saveError }],
    });
    expectToEqual(uow.outboxRepository.events, []);
  });

  it("does not emit event for agencies outside scope", async () => {
    timeGateway.setNextDate(subMonths(delegationEndDate, 3));
    const inactiveAgency = new AgencyDtoBuilder()
      .withId("agency-inactive")
      .withKind("autre")
      .withStatus("closed")
      .withDelegationAgencyInfo({
        delegationEndDate: delegationEndDateIso,
        delegationAgencyName: "DR France Travail",
        delegationAgencyKind: "france-travail",
      })
      .build();
    const peAgency = new AgencyDtoBuilder()
      .withId("agency-pe")
      .withKind("france-travail")
      .withStatus("active")
      .withDelegationAgencyInfo({
        delegationEndDate: delegationEndDateIso,
        delegationAgencyName: "DR France Travail",
        delegationAgencyKind: "france-travail",
      })
      .build();
    const agencyWithoutEndDate = new AgencyDtoBuilder()
      .withId("agency-no-end-date")
      .withKind("autre")
      .withStatus("active")
      .withDelegationAgencyInfo({
        delegationEndDate: null,
        delegationAgencyName: null,
        delegationAgencyKind: null,
      })
      .build();

    uow.agencyRepository.agencies = [
      toAgencyWithRights(inactiveAgency, {}),
      toAgencyWithRights(peAgency, {}),
      toAgencyWithRights(agencyWithoutEndDate, {}),
    ];

    const summary = await delegationConventionReminder.execute();

    expectToEqual(summary, { success: 0, failures: [] });
    expectToEqual(uow.outboxRepository.events, []);
  });
});
