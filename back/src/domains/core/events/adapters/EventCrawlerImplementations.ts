import * as Sentry from "@sentry/node";
import { subHours } from "date-fns";
import { splitEvery } from "ramda";
import { calculateDurationInSecondsFrom, type EventStatus } from "shared";
import {
  createLogger,
  type LoggerParamsWithMessage,
} from "../../../../utils/logger";
import { notifyErrorObjectToTeam } from "../../../../utils/notifyTeam";
import type { TimeGateway } from "../../time-gateway/ports/TimeGateway";
import type { UnitOfWorkPerformer } from "../../unit-of-work/ports/UnitOfWorkPerformer";
import type { DomainEvent } from "../events";
import type { EventBus } from "../ports/EventBus";
import type { EventCrawler } from "../ports/EventCrawler";

const logger = createLogger(__filename);

const maxEventsProcessedInParallel = 5;
const neverPublishedOutboxLimit = 1500;
const crawlerMaxBatchSize = 50;

export type TypeOfEvent = "unpublished" | "failed";

export class BasicEventCrawler implements EventCrawler {
  constructor(
    protected uowPerformer: UnitOfWorkPerformer,
    protected readonly eventBus: EventBus,
  ) {}

  public async processNewEvents(): Promise<void> {
    const getEventsStartDate = new Date();
    const events = await this.#retrieveEvents("unpublished");
    const retrieveEventsDurationInSeconds =
      calculateDurationInSecondsFrom(getEventsStartDate);

    const processStartDate = new Date();
    await this.#markEventsAsInProcess(events);
    await this.#publishEvents(events);
    const processEventsDurationInSeconds =
      calculateDurationInSecondsFrom(processStartDate);

    if (events.length) {
      logger.info({
        events,
        crawlerInfo: {
          numberOfEvents: events.length,
          processEventsDurationInSeconds,
          retrieveEventsDurationInSeconds,
          typeOfEvents: "unpublished",
        },
      });
    }
  }

  public async retryFailedEvents(): Promise<void> {
    const startDate = new Date();
    const events = await this.#retrieveEvents("failed");
    const retrieveEventsDurationInSeconds =
      calculateDurationInSecondsFrom(startDate);

    const processStartDate = new Date();
    // Pourquoi on ne ferait pas ici : await this.#markEventsAsInProcess(events); ???
    await this.#publishEvents(events);
    const processEventsDurationInSeconds =
      calculateDurationInSecondsFrom(processStartDate);

    if (events.length) {
      logger.warn({
        events,
        crawlerInfo: {
          numberOfEvents: events.length,
          processEventsDurationInSeconds,
          retrieveEventsDurationInSeconds,
          typeOfEvents: "failed",
        },
        message: `retryFailedEvents | ${events.length} events to process`,
      });
    }
  }

  public startCrawler() {
    logger.warn({
      message: "BasicEventCrawler.startCrawler: NO AUTOMATIC EVENT PROCESSING!",
    });
  }

  async #publishEvents(events: DomainEvent[]) {
    const eventGroups = splitEvery(maxEventsProcessedInParallel, events);
    for (const eventGroup of eventGroups) {
      const timer = setTimeout(() => {
        const warning = {
          message: "Processing event group is taking long",
          events: eventGroup,
        };
        notifyErrorObjectToTeam(warning);
        logger.warn(warning);
      }, 30_000);

      await Promise.all(
        eventGroup.map((event) => this.eventBus.publish(event)),
      );

      clearTimeout(timer);
    }
  }

  async #retrieveEvents(type: TypeOfEvent): Promise<DomainEvent[]> {
    return this.uowPerformer
      .perform((uow) =>
        type === "unpublished"
          ? uow.outboxQueries.getEventsToPublish({
              limit: crawlerMaxBatchSize,
            })
          : uow.outboxQueries.getFailedEvents({ limit: crawlerMaxBatchSize }),
      )
      .catch((error) => {
        const params: LoggerParamsWithMessage = {
          error,
          message: `${this.constructor.name}.retrieveEvents failed`,
          crawlerInfo: {
            typeOfEvents: type,
          },
        };

        logger.error(params);
        notifyErrorObjectToTeam({
          params,
        });

        return [];
      });
  }

  #markEventsAsInProcess(events: DomainEvent[]) {
    return this.uowPerformer.perform((uow) =>
      uow.outboxRepository.markEventsAsInProcess(events),
    );
  }
}

const retryErrorsPeriodMs = 90_000;

export class RealEventCrawler
  extends BasicEventCrawler
  implements EventCrawler
{
  constructor(
    uowPerformer: UnitOfWorkPerformer,
    eventBus: EventBus,
    private readonly timeGateway: TimeGateway,
    private readonly crawlingPeriodMs: number = 10_000,
  ) {
    super(uowPerformer, eventBus);
  }

  public override startCrawler() {
    logger.info({
      message: `RealEventCrawler.startCrawler: processing events at regular intervals (every ${this.crawlingPeriodMs}ms)`,
    });

    const processNewEvents = () =>
      setTimeout(() => {
        this.processNewEvents()
          .catch((error) => {
            logger.error({
              error,
              message: "RealEventCrawler.processNewEvents failed",
            });
            Sentry.captureException(error);
          })
          .finally(() => processNewEvents());
      }, this.crawlingPeriodMs);

    processNewEvents();

    const retryFailedEvents = () =>
      setTimeout(() => {
        this.retryFailedEvents()
          .catch((error) => {
            logger.error({
              error,
              message: "RealEventCrawler.retryFailedEvents failed",
            });
            Sentry.captureException(error);
          })
          .finally(() => retryFailedEvents());
      }, retryErrorsPeriodMs);

    retryFailedEvents();

    this.#markOldInProcessEventsAsToRepublish();
    this.#checkForOutboxCount();
  }

  #markOldInProcessEventsAsToRepublish() {
    const twoHoursAgo = subHours(this.timeGateway.now(), 2);

    return this.uowPerformer.perform((uow) =>
      uow.outboxRepository.markOldInProcessEventsAsToRepublish({
        eventsBeforeDate: twoHoursAgo,
      }),
    );
  }

  #checkForOutboxCount() {
    setTimeout(
      () =>
        Promise.all([
          this.#notifyDiscordOnTooManyOutboxWithStatus({
            status: "never-published",
            limit: neverPublishedOutboxLimit,
          }),
          this.#notifyDiscordOnTooManyOutboxWithStatus({
            status: "in-process",
            limit: crawlerMaxBatchSize,
          }),
        ]).finally(() => this.#checkForOutboxCount()),
      5 * 60 * 1000, //5 min
    );
  }

  async #notifyDiscordOnTooManyOutboxWithStatus({
    status,
    limit,
  }: {
    status: EventStatus;
    limit: number;
  }) {
    const count = await this.uowPerformer.perform((uow) =>
      uow.outboxRepository.countAllEvents({ status }),
    );
    if (count <= limit) return;
    const params: LoggerParamsWithMessage = {
      message: `${status} outbox ${count} exceeds ${limit}`,
    };
    logger.error(params);
    notifyErrorObjectToTeam(params);
  }
}
