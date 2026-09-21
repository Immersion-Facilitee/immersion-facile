import { addBusinessDays, differenceInBusinessDays } from "date-fns";
import {
  type ConventionDto,
  type ConventionId,
  type ConventionStatus,
  castError,
  executeInSequence,
  type ReminderKind,
} from "shared";
import type { DomainEvent } from "../../core/events/events";
import type { CreateNewEvent } from "../../core/events/ports/EventBus";
import type { TimeGateway } from "../../core/time-gateway/ports/TimeGateway";
import { useCaseBuilder } from "../../core/useCaseBuilder";

const agencyStatuses: ConventionStatus[] = ["IN_REVIEW"];

const ZERO_DAYS = 0;
const ONE_DAY = 1;
const TWO_DAYS = 2;
const THREE_DAYS = 3;

type ConventionsReminderSummary = {
  success: number;
  failures: {
    id: ConventionId;
    error: Error;
  }[];
};
type EventWithConventionId = {
  id: ConventionId;
  event: DomainEvent;
};

export type ConventionsReminder = ReturnType<typeof makeConventionsReminder>;

type Deps = {
  timeGateway: TimeGateway;
  createNewEvent: CreateNewEvent;
};

export const makeConventionsReminder = useCaseBuilder("ConventionsReminder")
  .withOutput<ConventionsReminderSummary>()
  .withDeps<Deps>()
  .build(async ({ uow, deps }) => {
    const now = deps.timeGateway.now();

    const conventionsForAgencyReminders =
      await uow.conventionQueries.getConventions({
        filters: {
          startDateGreater: now,
          startDateLessOrEqual: addBusinessDays(now, THREE_DAYS),
          withStatuses: agencyStatuses,
        },
        sortBy: "dateStart",
      });

    const events = conventionsForAgencyReminders.flatMap((c) =>
      makeAgencyReminders(c, deps),
    );

    const results: { id: ConventionId; error?: Error }[] =
      await executeInSequence(events, ({ event, id }) =>
        uow.outboxRepository
          .save(event)
          .then(() => ({ id }))
          .catch((error) => ({ id, error: castError(error) })),
      );

    return {
      success: results.filter(
        (
          result,
        ): result is {
          id: ConventionId;
        } => result.error === undefined,
      ).length,
      failures: results.filter(
        (
          result,
        ): result is {
          id: ConventionId;
          error: Error;
        } => result.error instanceof Error,
      ),
    };
  });

const makeAgencyReminders = (
  { id, status, dateStart }: ConventionDto,
  deps: Deps,
): EventWithConventionId[] => {
  const dateStartDiff = differenceInBusinessDays(
    new Date(dateStart),
    deps.timeGateway.now(),
  );
  if (!agencyStatuses.includes(status)) return [];
  return [
    ...(TWO_DAYS < dateStartDiff && dateStartDiff <= THREE_DAYS
      ? [
          makeConventionReminderRequiredEvent({
            id,
            reminderKind: "FirstReminderForAgency",
            deps,
          }),
        ]
      : []),
    ...(ZERO_DAYS < dateStartDiff && dateStartDiff <= ONE_DAY
      ? [
          makeConventionReminderRequiredEvent({
            id,
            reminderKind: "LastReminderForAgency",
            deps,
          }),
        ]
      : []),
  ];
};

const makeConventionReminderRequiredEvent = ({
  id,
  reminderKind,
  deps,
}: {
  id: ConventionId;
  reminderKind: ReminderKind;
  deps: Deps;
}): EventWithConventionId => ({
  id,
  event: deps.createNewEvent({
    topic: "ConventionReminderRequired",
    payload: {
      conventionId: id,
      reminderKind,
    },
  }),
});
