import os from "node:os";
import path from "node:path";
import type { AxiosResponse } from "axios";
import type { Request } from "express";
import type { QueryResult } from "kysely";
import pino, { type Logger, type LoggerOptions } from "pino";
import { complement, isNil, pickBy } from "ramda";
import type {
  AgencyId,
  ApiConsumerId,
  ConventionId,
  FtExternalId,
  LegacySearchQueryParamsDto,
  SiretDto,
  UserId,
} from "shared";
import type { HttpResponse } from "shared-routes";
import type { AuthorisationStatus } from "../config/bootstrap/authMiddleware";
import type { SubscriberResponse } from "../domains/core/api-consumer/ports/SubscribersGateway";
import type { TypeOfEvent } from "../domains/core/events/adapters/EventCrawlerImplementations";
import type { DomainEvent, DomainTopic } from "../domains/core/events/events";
import type { SearchMadeEntity } from "../domains/establishment/entities/SearchMadeEntity";
import type { SearchCompaniesParams } from "../domains/establishment/ports/LaBonneBoiteGateway";
import type { NodeProcessReport } from "./nodeProcessReport";

type LogStatus = "debug" | "info" | "ok" | "warn" | "error" | "alert";

const level: LoggerOptions["level"] =
  process.env.LOG_LEVEL || process.env.NODE_ENV === "test" ? "fatal" : "info";

const devTransport: LoggerOptions["transport"] = {
  target: "pino-pretty",
  options: {
    colorize: true,
    singleLine: !process.env.LOGGER_MULTI_LINE,
    translateTime: "yyyy-mm-dd HH:MM:ss.l Z",
    ignore: "pid,hostname",
  },
};

const rootLogger = pino({
  level,
  base: {
    pid: process.pid,
    hostname: process.env.CONTAINER ?? os.hostname(),
  },
  ...(process.env.NODE_ENV !== "production" ? { transport: devTransport } : {}),
});

export const legacyCreateLogger = (filename: string): Logger =>
  rootLogger.child({ name: path.basename(filename) });

type LoggedAxiosResponse = Partial<
  Pick<AxiosResponse, "status" | "headers" | "data">
>;

type SQLError = {
  query: string;
  result: QueryResult<any>;
  error: Error;
};

type RouteMethodAndUrl = {
  method: string;
  url: string;
};

type PartnerApiCall = {
  partnerName: string;
  route: RouteMethodAndUrl;
  durationInMs: number;
  response:
    | { kind: "cache-hit" }
    | {
        kind: "success";
        status: number;
      }
    | {
        kind: "failure";
        status: number;
        body: Record<string, unknown>;
        headers?: unknown;
        input?: {
          body?: unknown;
          queryParams?: unknown;
          urlParams?: unknown;
        };
      };
};

type ApiConsumerCall = {
  consumerName?: string;
  consumerId?: string;
  route: RouteMethodAndUrl;
  authorisationStatus: AuthorisationStatus;
};

type LoggerParams = Partial<{
  crispTicket: {
    kind: "Ticket self solved" | "Ticket sent to Crisp" | "Ticket errored";
    segments?: string[];
    errorMessage?: string;
  };
  partnerApiCall: PartnerApiCall;
  cacheKey: string;
  apiConsumerCall: ApiConsumerCall;
  adapters: {
    repositories: "IN_MEMORY" | "PG";
    notificationGateway: "IN_MEMORY" | "BREVO";
    apiAddress: "IN_MEMORY" | "OPEN_CAGE_DATA";
    siretGateway: "IN_MEMORY" | "HTTPS" | "INSEE" | "ANNUAIRE_DES_ENTREPRISES";
    romeRepository: "IN_MEMORY" | "PG";
  };
  agencyId: AgencyId;
  conventionId: ConventionId;
  crawlerInfo: {
    typeOfEvents: TypeOfEvent;
    numberOfEventsBeforeAggregation?: number;
    numberOfEvents?: number;
    processEventsDurationInSeconds?: number;
    retrieveEventsDurationInSeconds?: number;
  };
  durationInSeconds: number;
  sqlQuery: string;
  error: Error | Partial<SQLError>;
  events: DomainEvent[];
  nodeProcessReport: NodeProcessReport;
  notificationId: string;
  ftConnect: Partial<{
    ftId: ConventionId;
    originalId: ConventionId;
    ftExternalId: FtExternalId;
    isJobSeeker: boolean;
  }>;
  reportTitle: string;
  reportContent: string;
  request: Pick<Request, "path" | "method">;
  requestId: string;
  sharedRouteResponse: HttpResponse<any, any>;
  axiosResponse: LoggedAxiosResponse;
  subscriberResponse: SubscriberResponse;
  searchLBB: SearchCompaniesParams;
  searchMade: SearchMadeEntity;
  searchParams: LegacySearchQueryParamsDto | undefined;
  siret: SiretDto;
  romeLabel: string;
  franceTravailGatewayStatus: "success" | "total" | "error";
  logStatus: LogStatus;
  authorisationStatus: AuthorisationStatus;
  subscriptionId: string;
  topic: DomainTopic;
  useCaseName: string;
  userId: UserId;
  apiConsumerId: ApiConsumerId;
}>;

export type OpacifiedLogger = {
  debug: LoggerFunction;
  info: LoggerFunction;
  warn: LoggerFunction;
  error: LoggerFunction;
  trace: LoggerFunction;
  fatal: LoggerFunction;
  silent: LoggerFunction;
  level: string;
};

type LogMethod = keyof OpacifiedLogger;

const logMethodToLogStatus: Record<LogMethod, LogStatus> = {
  info: "info",
  warn: "warn",
  error: "error",
  fatal: "error",
  debug: "debug",
  silent: "debug",
  trace: "debug",
  level: "debug",
};

export type LoggerParamsWithMessage = LoggerParams & {
  message?: string;
};

type LoggerFunction = (params: LoggerParamsWithMessage) => void;

export const createLogger = (filename: string): OpacifiedLogger => {
  const logger = rootLogger.child({ name: path.basename(filename) });

  const makeLogFunction =
    (method: LogMethod): LoggerFunction =>
    ({
      partnerApiCall,
      cacheKey,
      adapters,
      agencyId,
      conventionId,
      crawlerInfo,
      durationInSeconds,
      error,
      events,
      message,
      nodeProcessReport,
      notificationId,
      ftConnect,
      reportContent,
      request,
      requestId,
      sharedRouteResponse,
      subscriberResponse,
      axiosResponse,
      searchMade,
      searchLBB,
      logStatus,
      authorisationStatus,
      franceTravailGatewayStatus,
      subscriptionId,
      topic,
      useCaseName,
      searchParams,
      siret,
      romeLabel,
      apiConsumerCall,
      crispTicket,
      reportTitle,
      sqlQuery,
      userId,
      apiConsumerId,
      ...rest
    }) => {
      const _noValuesForgotten: Record<string, never> = rest;
      if (method === "level") return {};

      const opacifiedLogContent = {
        adapters,
        apiConsumerCall,
        agencyId,
        conventionId,
        crawlerInfo,
        durationInSeconds,
        sqlQuery,
        error: error instanceof Error ? error.message : error,
        events: sanitizeEvents(events),
        nodeProcessReport,
        notificationId,
        ftConnect,
        reportContent,
        request,
        requestId,
        sharedRouteResponse: sanitizeSharedRouteResponse(sharedRouteResponse),
        subscriberResponse,
        axiosResponse,
        searchMade,
        searchLBB,
        status: logStatus ?? logMethodToLogStatus[method],
        authorisationStatus,
        franceTravailGatewayStatus,
        subscriptionId,
        topic,
        useCaseName,
        searchParams,
        partnerApiCall,
        siret,
        romeLabel,
        cacheKey,
        crispTicket,
        userId,
        apiConsumerId,
      };

      const opacifiedWithoutNullOrUndefined = pickBy(
        complement(isNil),
        opacifiedLogContent,
      );

      logger[method](opacifiedWithoutNullOrUndefined, message);
    };

  return {
    debug: makeLogFunction("debug"),
    info: makeLogFunction("info"),
    error: makeLogFunction("error"),
    warn: makeLogFunction("warn"),
    trace: makeLogFunction("trace"),
    silent: makeLogFunction("silent"),
    fatal: makeLogFunction("fatal"),
    level: "",
  };
};

const sanitizeSharedRouteResponse = (
  response: HttpResponse<any, any> | undefined,
) => {
  if (!response) return;
  if (response.status >= 200 && response.status < 400)
    return {
      status: response.status,
    };

  return {
    status: response.status,
    body: response.body,
  };
};

const sanitizeEvents = (events: DomainEvent[] | undefined) => {
  if (!events) return;
  return events.map(
    ({ publications, id, topic, wasQuarantined }: DomainEvent) => {
      const publishCount = publications.length;
      const lastPublication = publications[publishCount - 1];

      return {
        eventId: id,
        topic: topic,
        wasQuarantined: wasQuarantined,
        lastPublishedAt: lastPublication?.publishedAt,
        failedSubscribers: lastPublication?.failures,
        publishCount,
      };
    },
  );
};
