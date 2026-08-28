import { type SelectQueryBuilder, sql } from "kysely";
import type { InsertObjectOrList } from "kysely/dist/cjs/parser/insert-values-parser";
import { keys, mapObjIndexed } from "ramda";
import {
  type ApiConsumer,
  type ApiConsumerContact,
  type ApiConsumerId,
  type ApiConsumerRights,
  apiConsumerSchema,
  type DateString,
  type DateTimeIsoString,
  type Email,
  eventToRightName,
  type WebhookSubscription,
} from "shared";
import {
  cast,
  jsonBuildObject,
  jsonStripNulls,
  type KyselyDb,
} from "../../../../config/pg/kysely/kyselyUtils";
import type { Database } from "../../../../config/pg/kysely/model/database";
import { createLogger } from "../../../../utils/logger";
import { getOrCreatePhoneIds } from "../../phone-number/adapters/pgPhoneHelper";
import type {
  ApiConsumerRepository,
  GetApiConsumerFilters,
} from "../ports/ApiConsumerRepository";

const logger = createLogger(__filename);

const debugDoubleBroadcastMessage = (message: string) =>
  `Debug Mission Local, message en double. ${message}`;

export class PgApiConsumerRepository implements ApiConsumerRepository {
  #transaction: KyselyDb;

  constructor(transaction: KyselyDb) {
    this.#transaction = transaction;
  }

  public async getAll(): Promise<ApiConsumer[]> {
    const results = await this.#pgApiConsumerQueryBuild().execute();

    return results.map((result) =>
      this.#rawPgToApiConsumer(result.raw_api_consumer),
    );
  }

  public async getById(id: ApiConsumerId): Promise<ApiConsumer | undefined> {
    const result = await this.#pgApiConsumerQueryBuild()
      .where("c.id", "=", id)
      .executeTakeFirst();

    return result && this.#rawPgToApiConsumer(result.raw_api_consumer);
  }

  public async getByFilters(
    filters: GetApiConsumerFilters,
  ): Promise<ApiConsumer[]> {
    const applyFilters = <
      QB extends SelectQueryBuilder<
        ApiConsumerQueryDb,
        ApiConsumerFromTables,
        any
      >,
    >(
      b: QB,
    ) => {
      const { agencyIds, agencyKinds } = filters;
      const hasNoFilters =
        (!agencyIds || agencyIds.length === 0) &&
        (!agencyKinds || agencyKinds.length === 0);
      const shouldApplyAgencyIdsFilters =
        agencyIds &&
        agencyIds.length > 0 &&
        (!agencyKinds || agencyKinds.length === 0);
      const shouldApplyAgencyKindsFilters =
        agencyKinds &&
        agencyKinds.length > 0 &&
        (!agencyIds || agencyIds.length === 0);

      if (hasNoFilters) {
        return b;
      }

      if (shouldApplyAgencyIdsFilters) {
        return b.where(
          sql`c.rights #> '{convention,scope,agencyIds}'`,
          "?|",
          sql`${sql.val(agencyIds)}::text[]`,
        );
      }

      if (shouldApplyAgencyKindsFilters) {
        return b.where(
          sql`c.rights #> '{convention,scope,agencyKinds}'`,
          "?|",
          sql`${sql.val(agencyKinds)}::text[]`,
        );
      }

      // apply both filters
      return b.where((eb) =>
        eb.or([
          eb(
            sql`c.rights #> '{convention,scope,agencyIds}'`,
            "?|",
            sql`${sql.val(agencyIds)}::text[]`,
          ),
          eb(
            sql`c.rights #> '{convention,scope,agencyKinds}'`,
            "?|",
            sql`${sql.val(agencyKinds)}::text[]`,
          ),
        ]),
      );
    };

    const results = await applyFilters(
      this.#pgApiConsumerQueryBuild(),
    ).execute();

    return results.map((result) =>
      this.#rawPgToApiConsumer(result.raw_api_consumer),
    );
  }

  public async save(apiConsumer: ApiConsumer): Promise<void> {
    logger.warn({
      message: debugDoubleBroadcastMessage(
        `Updated ApiConsumer : ${JSON.stringify(apiConsumer)}`,
      ),
    });
    await this.#insertApiConsumer(apiConsumer);
    await this.#clearSubscriptionsOfConsumer(apiConsumer.id);
    await this.#insertSubscriptions(apiConsumer);
  }

  async #insertApiConsumer(apiConsumer: ApiConsumer) {
    const { rights, ...rest } = apiConsumer;
    const rightsWithoutSubscriptions = mapObjIndexed(
      ({ subscriptions: _, ...rest }) => rest,
      rights,
    );

    const phoneId = (
      await getOrCreatePhoneIds(this.#transaction, [rest.contact.phone])
    )[rest.contact.phone];

    const values = {
      id: rest.id,
      name: rest.name,
      description: rest.description ?? null,
      rights: JSON.parse(JSON.stringify(rightsWithoutSubscriptions)),
      created_at: rest.createdAt,
      expiration_date: rest.expirationDate,
      contact_emails: rest.contact.emails,
      contact_first_name: rest.contact.firstName,
      contact_last_name: rest.contact.lastName,
      contact_job: rest.contact.job,
      contact_phone_id: phoneId,
      revoked_at: rest.revokedAt,
      current_key_issued_at: rest.currentKeyIssuedAt,
    };

    await this.#transaction
      .insertInto("api_consumers")
      .values(values)
      .onConflict((oc) => oc.column("id").doUpdateSet(values))
      .execute();
  }

  async #clearSubscriptionsOfConsumer(apiConsumerId: ApiConsumerId) {
    await this.#transaction
      .deleteFrom("api_consumers_subscriptions")
      .where("consumer_id", "=", apiConsumerId)
      .execute();
  }

  async #insertSubscriptions(apiConsumer: ApiConsumer) {
    const subscriptions: WebhookSubscription[] = keys(
      apiConsumer.rights,
    ).flatMap((rightName) => apiConsumer.rights[rightName].subscriptions);

    if (subscriptions.length > 0)
      await this.#transaction
        .insertInto("api_consumers_subscriptions")
        .values(
          subscriptions.map(
            (subscription) =>
              ({
                id: subscription.id,
                created_at: sql`${subscription.createdAt}`,
                right_name: eventToRightName(subscription.subscribedEvent),
                callback_url: subscription.callbackUrl,
                callback_headers: JSON.parse(
                  JSON.stringify(subscription.callbackHeaders),
                ),
                consumer_id: apiConsumer.id,
                subscribed_event: subscription.subscribedEvent,
              }) satisfies InsertObjectOrList<
                Database,
                "api_consumers_subscriptions"
              >,
          ),
        )
        .execute();
  }

  #rawPgToApiConsumer({
    subscriptions,
    revokedAt,
    ...rest
  }: PgRawConsumerData): ApiConsumer {
    const restWithEmptySubscription: Omit<
      PgRawConsumerData,
      "subscriptions" | "revokedAt"
    > = {
      ...rest,
      rights: keys(rest.rights).reduce(
        (acc, rightName) => ({
          ...acc,
          [rightName]: {
            ...rest.rights[rightName],
            subscriptions: [],
          },
        }),
        {},
      ) as ApiConsumerRights,
    };

    const apiConsumer: ApiConsumer = {
      ...restWithEmptySubscription,
      contact: {
        ...restWithEmptySubscription.contact,
        phone: restWithEmptySubscription.contact.phone,
      },
      revokedAt: revokedAt ?? null,
      rights: (subscriptions || []).reduce((acc, subscription) => {
        const rightName = eventToRightName(subscription.subscribedEvent);
        return {
          ...acc,
          [rightName]: {
            ...restWithEmptySubscription.rights[rightName],
            subscriptions: [
              ...(acc[rightName].subscriptions || []),
              subscription,
            ],
          },
        };
      }, restWithEmptySubscription.rights),
    };

    return apiConsumerSchema.parse(apiConsumer);
  }

  #pgApiConsumerQueryBuild() {
    return this.#transaction
      .selectFrom("api_consumers as c")
      .leftJoin("api_consumers_subscriptions as s", "s.consumer_id", "c.id")
      .innerJoin("phone_numbers", "c.contact_phone_id", "phone_numbers.id")
      .select((eb) =>
        jsonStripNulls(
          jsonBuildObject({
            id: eb.ref("c.id"),
            name: eb.ref("c.name"),
            description: eb.ref("c.description"),
            rights: cast<ApiConsumerRights>(eb.ref("c.rights")),
            createdAt: sql<DateString>`date_to_iso(c.created_at)`,
            expirationDate: sql<DateString>`date_to_iso(c.expiration_date)`,
            revokedAt: sql<DateTimeIsoString | null>`date_to_iso(c.revoked_at)`,
            currentKeyIssuedAt: sql<DateTimeIsoString>`date_to_iso(c.current_key_issued_at)`,
            contact: jsonBuildObject({
              firstName: eb.ref("c.contact_first_name"),
              lastName: eb.ref("c.contact_last_name"),
              job: eb.ref("c.contact_job"),
              emails: cast<Email[]>(eb.ref("c.contact_emails")),
              phone: eb.ref("phone_numbers.phone_number"),
            }),
            subscriptions: sql<
              WebhookSubscription[]
            >` JSON_AGG(JSON_BUILD_OBJECT(
                'callbackUrl', s.callback_url,
                'callbackHeaders', s.callback_headers,
                'createdAt', date_to_iso(s.created_at),
                'id', s.id,
                'subscribedEvent', s.subscribed_event
            )) FILTER (WHERE s.subscribed_event IS NOT NULL)`,
          }),
        ).as("raw_api_consumer"),
      )
      .groupBy(["c.id", "phone_numbers.id"]);
  }
}

type PgRawConsumerData = {
  id: string;
  name: string;
  description?: string;
  rights: ApiConsumerRights;
  createdAt: DateString;
  expirationDate: DateString;
  revokedAt?: DateTimeIsoString;
  currentKeyIssuedAt: DateTimeIsoString;
  contact: ApiConsumerContact;
  subscriptions: WebhookSubscription[];
};

type ApiConsumerQueryDb = Database & {
  c: Database["api_consumers"];
  s: Database["api_consumers_subscriptions"];
};

type ApiConsumerFromTables = "c" | "s" | "phone_numbers";
