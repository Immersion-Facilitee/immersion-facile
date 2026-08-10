import { sql } from "kysely";
import {
  type Phone,
  type PhoneNumber,
  type PhoneStatus,
  pipeWithValue,
} from "shared";
import type { KyselyDb } from "../../../../config/pg/kysely/kyselyUtils";
import {
  type FixConflictingPhoneParams,
  type FixNotConflictingPhoneParams,
  type PhoneRepository,
  type TablesWithPhoneReference,
  tablesWithPhoneReference,
} from "../ports/PhoneRepository";
import type { PhoneId } from "./pgPhoneHelper";

export class PgPhoneRepository implements PhoneRepository {
  constructor(private transaction: KyselyDb) {}

  async getConflictingPhoneNumberId(params: {
    phoneNumber: PhoneNumber;
  }): Promise<number | null> {
    const { phoneNumber } = params;
    const existingPhone = await this.transaction
      .selectFrom("phone_numbers")
      .select("id")
      .where("phone_number", "=", phoneNumber)
      .executeTakeFirst();

    return existingPhone ? existingPhone.id : null;
  }

  async fixConflictingPhone(params: FixConflictingPhoneParams): Promise<void> {
    const { phoneToUpdate, conflictingPhoneId } = params;

    await Promise.all(
      tablesWithPhoneReference.map(({ table, column }) =>
        this.transaction
          .updateTable(table)
          .set({ [column]: conflictingPhoneId })
          .where(column, "=", phoneToUpdate.id)
          .execute(),
      ),
    );

    await this.transaction
      .deleteFrom("phone_numbers")
      .where("id", "=", phoneToUpdate.id)
      .execute();
  }

  async fixNotConflictingPhone(
    params: FixNotConflictingPhoneParams,
  ): Promise<void> {
    const { phoneToUpdate, newPhoneNumber } = params;
    await this.transaction
      .updateTable("phone_numbers")
      .set({
        phone_number: newPhoneNumber,
        status: "VALID",
      })
      .where("id", "=", phoneToUpdate.id)
      .execute();
  }

  async getPhones(
    params: {
      verifiedBefore?: Date;
      limit?: number;
      verificationStatus?: PhoneStatus[];
      fromId?: PhoneId;
    } = {},
  ): Promise<{ phones: Phone[]; cursorId: number | null }> {
    const {
      verifiedBefore = new Date(),
      limit = 100,
      verificationStatus,
      fromId,
    } = params;

    const rows = await pipeWithValue(
      this.transaction
        .selectFrom("phone_numbers")
        .select(["id", "phone_number", "status", "verified_at"])
        .orderBy("id", "asc"),
      (b) =>
        verifiedBefore
          ? b.where((eb) =>
              eb.or([
                eb("verified_at", "is", null),
                eb("verified_at", "<", verifiedBefore),
              ]),
            )
          : b,
      (b) => (fromId ? b.where("id", ">", fromId) : b),
      (b) =>
        verificationStatus && verificationStatus.length > 0
          ? b.where("status", "in", verificationStatus)
          : b,
      (b) => b.limit(limit + 1),
    ).execute();

    const hasMore = rows.length > limit;
    const phones = rows.slice(0, limit).map((row) => ({
      id: row.id,
      phoneNumber: row.phone_number,
      status: row.status,
      verifiedAt: row.verified_at ? new Date(row.verified_at) : null,
    }));

    return {
      phones,
      cursorId: hasMore ? phones[phones.length - 1].id : null,
    };
  }

  async getPhoneById(id: PhoneId): Promise<Phone | undefined> {
    return this.transaction
      .selectFrom("phone_numbers")
      .where("id", "=", id)
      .select([
        "id",
        "phone_number as phoneNumber",
        "verified_at as verifiedAt",
        "status",
      ])
      .executeTakeFirst();
  }

  async getPhoneByNumberForTesting(
    phoneNumber: PhoneNumber,
  ): Promise<Phone | undefined> {
    return this.transaction
      .selectFrom("phone_numbers")
      .where("phone_number", "=", phoneNumber)
      .select([
        "id",
        "phone_number as phoneNumber",
        "verified_at as verifiedAt",
        "status",
      ])
      .executeTakeFirst();
  }

  async markAsVerified(params: {
    phoneIds: PhoneId[];
    verifiedDate: Date;
  }): Promise<void> {
    const { phoneIds, verifiedDate } = params;

    if (phoneIds.length === 0) return;

    await this.transaction
      .updateTable("phone_numbers")
      .set({ verified_at: verifiedDate })
      .where("id", "in", phoneIds)
      .execute();
  }

  async updateStatus(params: {
    phoneIds: PhoneId[];
    status: PhoneStatus;
  }): Promise<void> {
    const { phoneIds, status } = params;

    if (phoneIds.length === 0) return;

    await this.transaction
      .updateTable("phone_numbers")
      .set({ status: status })
      .where("id", "in", phoneIds)
      .execute();
  }

  async getTableNamesReferencingPhoneNumbers(): Promise<
    TablesWithPhoneReference[]
  > {
    const result = await sql<TablesWithPhoneReference>`
    SELECT kcu.table_name as "table", kcu.column_name as "column"
    FROM information_schema.key_column_usage kcu
    JOIN information_schema.referential_constraints rc
      ON rc.constraint_name = kcu.constraint_name
    JOIN information_schema.key_column_usage ccu
      ON ccu.constraint_name = rc.unique_constraint_name
    WHERE ccu.table_name = 'phone_numbers'
      AND ccu.column_name = 'id'
  `.execute(this.transaction);

    return result.rows;
  }
}
