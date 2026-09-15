import type { Selectable } from "kysely";
import {
  type ArchivedConventionRequestId,
  type ArchivedConventionRequestStatus,
  appellationCodeSchema,
  archivedConventionRequestReasons,
  archivedConventionRequestStatusSchema,
  conventionIdSchema,
  type DateString,
  firstnameMandatorySchema,
  lastnameMandatorySchema,
  makeDateStringSchema,
  siretSchema,
  zStringMinLength1Max255,
  zStringPossiblyEmptyWithMax,
  zUuidLike,
} from "shared";
import { z } from "zod";
import type { KyselyDb } from "../../../../config/pg/kysely/kyselyUtils";
import type { Database } from "../../../../config/pg/kysely/model/database";
import type { ArchivedConventionRequestEntity } from "../../entities/ArchivedConventionRequestEntity";
import type { ArchivedConventionRequestRepository } from "../../ports/ArchivedConventionRequestRepository";

export class PgArchivedConventionRequestRepository
  implements ArchivedConventionRequestRepository
{
  constructor(private readonly transaction: KyselyDb) {}

  public async getById(
    id: ArchivedConventionRequestId,
  ): Promise<ArchivedConventionRequestEntity | undefined> {
    const row = await this.transaction
      .selectFrom("archived_convention_requests")
      .selectAll()
      .where("archived_convention_requests.id", "=", id)
      .executeTakeFirst();

    return row ? toArchivedConventionRequestEntity(row) : undefined;
  }

  public async save(
    archivedConventionRequest: ArchivedConventionRequestEntity,
  ): Promise<void> {
    await this.transaction
      .insertInto("archived_convention_requests")
      .values({
        id: archivedConventionRequest.id,
        user_id: archivedConventionRequest.userId,
        created_at: new Date(archivedConventionRequest.createdAt),
        updated_at: new Date(archivedConventionRequest.updatedAt),
        status: archivedConventionRequest.status,
        reason: archivedConventionRequest.reason,
        other_reason: archivedConventionRequest.otherReason,
        ...(archivedConventionRequest.conventionSearchMethod ===
        "withConventionId"
          ? {
              convention_id: archivedConventionRequest.conventionId,
            }
          : {
              beneficiary_first_name:
                archivedConventionRequest.beneficiaryFirstName,
              beneficiary_last_name:
                archivedConventionRequest.beneficiaryLastName,
              siret: archivedConventionRequest.siret,
              immersion_date: archivedConventionRequest.immersionDate,
              immersion_appellation_code: Number.parseInt(
                archivedConventionRequest.immersionAppellationCode,
                10,
              ),
            }),
      })
      .execute();
  }

  public async update(params: {
    id: ArchivedConventionRequestId;
    status: ArchivedConventionRequestStatus;
    updatedAt: DateString;
  }): Promise<void> {
    await this.transaction
      .updateTable("archived_convention_requests")
      .set({
        status: params.status,
        updated_at: new Date(params.updatedAt),
      })
      .where("id", "=", params.id)
      .execute();
  }
}

export const toArchivedConventionRequestEntity = (
  row: Selectable<Database["archived_convention_requests"]>,
): ArchivedConventionRequestEntity =>
  archivedConventionRequestEntitySchema.parse({
    id: row.id,
    userId: row.user_id,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    status: row.status,
    reason: row.reason,
    otherReason: row.other_reason ?? undefined,
    ...(row.convention_id
      ? {
          conventionSearchMethod: "withConventionId",
          conventionId: row.convention_id,
        }
      : {
          conventionSearchMethod: "withConventionDetails",
          beneficiaryFirstName: row.beneficiary_first_name,
          beneficiaryLastName: row.beneficiary_last_name,
          siret: row.siret,
          immersionDate: row.immersion_date,
          immersionAppellationCode: row.immersion_appellation_code?.toString(),
        }),
  });

const archivedConventionRequestEntitySchema: z.ZodType<ArchivedConventionRequestEntity> =
  z
    .object({
      id: zUuidLike,
      userId: zUuidLike,
      createdAt: makeDateStringSchema(),
      updatedAt: makeDateStringSchema(),
      status: archivedConventionRequestStatusSchema,
    })
    .and(
      z.discriminatedUnion("conventionSearchMethod", [
        z.object({
          conventionSearchMethod: z.literal("withConventionId"),
          conventionId: conventionIdSchema,
        }),
        z.object({
          conventionSearchMethod: z.literal("withConventionDetails"),
          beneficiaryFirstName: firstnameMandatorySchema,
          beneficiaryLastName: lastnameMandatorySchema,
          siret: siretSchema,
          immersionDate: zStringMinLength1Max255,
          immersionAppellationCode: appellationCodeSchema,
        }),
      ]),
    )
    .and(
      z.discriminatedUnion("reason", [
        z.object({
          reason: z.literal("other"),
          otherReason: zStringPossiblyEmptyWithMax(100).default(""),
        }),
        z.object({
          reason: z.enum(
            archivedConventionRequestReasons.filter(
              (reason) => reason !== "other",
            ),
          ),
        }),
      ]),
    );
