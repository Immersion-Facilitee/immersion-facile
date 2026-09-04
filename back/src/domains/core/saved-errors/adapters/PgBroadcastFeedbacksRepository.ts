import { sql } from "kysely";
import {
  type AgencyId,
  type BroadcastFeedback,
  type ConventionId,
  type DateTimeIsoString,
  errors,
} from "shared";
import type { KyselyDb } from "../../../../config/pg/kysely/kyselyUtils";
import { isAxiosError } from "../../../../utils/axiosUtils";
import type { BroadcastFeedbacksRepository } from "../ports/BroadcastFeedbacksRepository";

export class PgBroadcastFeedbacksRepository
  implements BroadcastFeedbacksRepository
{
  constructor(private transaction: KyselyDb) {}

  public async getLastBroadcastFeedback(
    id: ConventionId,
  ): Promise<BroadcastFeedback | null> {
    const result = await this.transaction
      .with("latest_feedback", (qb) =>
        qb
          .selectFrom("broadcast_feedbacks as bf")
          .where(sql`(bf.request_params ->> 'conventionId')::uuid`, "=", id)
          .select([
            "bf.consumer_id as consumerId",
            "bf.consumer_name as consumerName",
            "bf.service_name as serviceName",
            "bf.subscriber_error_feedback as subscriberErrorFeedback",
            "bf.request_params as requestParams",
            sql<DateTimeIsoString>`date_to_iso(bf.occurred_at)`.as(
              "occurredAt",
            ),
            "bf.handled_by_agency as handledByAgency",
            "bf.response as response",
            "bf.convention_id as conventionId",
            "bf.agency_id as agencyId",
            sql<number>`
              ROW_NUMBER() OVER (
                PARTITION BY (bf.request_params->>'conventionId')
                ORDER BY bf.occurred_at DESC
              )
            `.as("rn"),
          ]),
      )
      .selectFrom("latest_feedback as lf")
      .selectAll()
      .where("lf.rn", "=", 1)
      .executeTakeFirst();

    if (!result) return null;

    const conventionId = (result.conventionId ??
      result.requestParams.conventionId) as ConventionId;
    const agencyId = result.agencyId ?? (await this.#getAgencyId(conventionId));

    if (!agencyId) return null;

    return {
      consumerId: result.consumerId,
      consumerName: result.consumerName,
      conventionId,
      agencyId,
      handledByAgency: result.handledByAgency,
      occurredAt: result.occurredAt,
      requestParams: result.requestParams,
      serviceName: result.serviceName,
      response: result.response,
      subscriberErrorFeedback: result.subscriberErrorFeedback
        ? result.subscriberErrorFeedback
        : undefined,
    };
  }

  public async getBroadcastFeedbacksByConventionId(
    id: ConventionId,
  ): Promise<BroadcastFeedback[]> {
    const rows = await this.transaction
      .selectFrom("broadcast_feedbacks as bf")
      .where("bf.convention_id", "=", id)
      .select([
        "bf.consumer_id as consumerId",
        "bf.consumer_name as consumerName",
        "bf.service_name as serviceName",
        "bf.subscriber_error_feedback as subscriberErrorFeedback",
        "bf.request_params as requestParams",
        sql<DateTimeIsoString>`date_to_iso(bf.occurred_at)`.as("occurredAt"),
        "bf.handled_by_agency as handledByAgency",
        "bf.response as response",
        "bf.convention_id as conventionId",
        "bf.agency_id as agencyId",
      ])
      .orderBy("bf.occurred_at", "asc")
      .execute();

    return rows.flatMap((row) => {
      if (!row.conventionId || !row.agencyId) return [];

      return [
        {
          consumerId: row.consumerId,
          consumerName: row.consumerName,
          conventionId: row.conventionId,
          agencyId: row.agencyId,
          handledByAgency: row.handledByAgency,
          occurredAt: row.occurredAt,
          requestParams: row.requestParams,
          serviceName: row.serviceName,
          response: row.response,
          subscriberErrorFeedback: row.subscriberErrorFeedback
            ? row.subscriberErrorFeedback
            : undefined,
        },
      ];
    });
  }

  async #getAgencyId(conventionId: ConventionId): Promise<AgencyId | null> {
    const convention = await this.transaction
      .selectFrom("conventions")
      .select("agency_id")
      .where("id", "=", conventionId)
      .executeTakeFirst();

    return (convention?.agency_id ?? null) as AgencyId | null;
  }

  public async markPartnersErroredConventionAsHandled(
    conventionId: ConventionId,
  ): Promise<void> {
    const result = await this.transaction
      .updateTable("broadcast_feedbacks")
      .set({ handled_by_agency: true })
      .where(sql`(request_params ->> 'conventionId')::uuid`, "=", conventionId)
      .where("handled_by_agency", "=", false)
      .executeTakeFirst();

    if (Number(result.numUpdatedRows) === 0)
      throw errors.broadcastFeedback.notFound({
        conventionId,
      });
  }

  public async save(broadcastFeedback: BroadcastFeedback): Promise<void> {
    const {
      serviceName,
      subscriberErrorFeedback,
      requestParams,
      response,
      occurredAt,
      handledByAgency,
      consumerName,
      consumerId,
      conventionId,
      agencyId,
    } = broadcastFeedback;

    if (conventionId !== requestParams.conventionId)
      throw new Error("Broadcast feedback convention ids must match");

    await this.transaction
      .insertInto("broadcast_feedbacks")
      .values({
        service_name: serviceName,
        consumer_name: consumerName,
        consumer_id: consumerId,
        convention_id: conventionId,
        agency_id: agencyId,
        ...(subscriberErrorFeedback
          ? {
              subscriber_error_feedback: JSON.stringify({
                message: subscriberErrorFeedback.message,
                ...(subscriberErrorFeedback.error
                  ? {
                      error: isAxiosError(subscriberErrorFeedback.error)
                        ? subscriberErrorFeedback.error.toJSON()
                        : // Why?  >> https://stackoverflow.com/questions/18391212/is-it-not-possible-to-stringify-an-error-using-json-stringify
                          JSON.stringify(
                            subscriberErrorFeedback.error,
                            Object.getOwnPropertyNames(
                              subscriberErrorFeedback.error,
                            ),
                          ),
                    }
                  : {}),
              }),
            }
          : {}),
        request_params: JSON.stringify(requestParams),
        response: JSON.stringify(response),
        occurred_at: occurredAt,
        handled_by_agency: handledByAgency,
      })
      .execute();
  }
}
