import { subDays } from "date-fns";
import { sql } from "kysely";
import { jsonArrayFrom } from "kysely/helpers/postgres";
import { equals, isEmpty } from "ramda";
import {
  type AppellationAndRomeDto,
  type AppellationCode,
  calculateLimitAndOffsetFromPagination,
  calculatePaginationResult,
  castError,
  type DataWithPagination,
  type DepartmentCode,
  type EstablishmentSearchableByValue,
  type EstablishmentUserRightStatus,
  errors,
  type FitForDisableWorkerOption,
  type LocationId,
  type NafCode,
  type RemoteWorkMode,
  type RomeCode,
  type SiretDto,
} from "shared";
import {
  jsonBuildObject,
  jsonStripNulls,
  type KyselyDb,
} from "../../../config/pg/kysely/kyselyUtils";
import { createLogger } from "../../../utils/logger";
import { getOrCreatePhoneIds } from "../../core/phone-number/adapters/pgPhoneHelper";
import type { EstablishmentAggregate } from "../entities/EstablishmentAggregate";
import type { EstablishmentEntity } from "../entities/EstablishmentEntity";
import type { OfferEntity } from "../entities/OfferEntity";
import type { GeoParams } from "../entities/SearchMadeEntity";
import type {
  EstablishmentAggregateFilters,
  EstablishmentAggregateRepository,
  GetOffersParams,
  OfferWithSiret,
  RepositorySearchImmersionResult,
  UpdateEstablishmentsWithInseeDataParams,
} from "../ports/EstablishmentAggregateRepository";
import { searchImmersionResultsQuery } from "./PgEstablishmentAggregateRepository.sql";

const logger = createLogger(__filename);
export class PgEstablishmentAggregateRepository
  implements EstablishmentAggregateRepository
{
  constructor(private transaction: KyselyDb) {}

  public async getAllEstablishmentAggregatesForTest(): Promise<
    EstablishmentAggregate[]
  > {
    const aggregateWithStringDates = await establishmentByFiltersQueryBuilder(
      this.transaction,
    ).execute();
    return aggregateWithStringDates.map(({ aggregate }) =>
      makeEstablishmentAggregateFromDb(aggregate),
    );
  }

  public async getEstablishmentAggregateBySiret(
    siret: SiretDto,
  ): Promise<EstablishmentAggregate | undefined> {
    const aggregates = await establishmentByFiltersQueryBuilder(
      this.transaction,
    )
      .where("e.siret", "=", siret)
      .execute();
    const aggregate = aggregates.at(0);
    return aggregate && makeEstablishmentAggregateFromDb(aggregate.aggregate);
  }

  public async getEstablishmentAggregatesByFilters(
    filters: EstablishmentAggregateFilters,
  ): Promise<EstablishmentAggregate[]> {
    if (isEmpty(filters)) return [];
    const { userId, nameIncludes, sirets, ...rest } = filters;
    rest satisfies Record<string, never>;
    const aggregates = await establishmentByFiltersQueryBuilder(
      this.transaction,
    )
      .$if(!!userId, (qb) =>
        qb
          .leftJoin(
            "establishments__users",
            "establishments__users.siret",
            "e.siret",
          )
          .where("establishments__users.user_id", "=", userId ?? ""),
      )
      .$if(!!nameIncludes, (qb) =>
        qb.where("e.name", "ilike", `%${nameIncludes}%`),
      )
      .$if(!!sirets && sirets.length > 0, (qb) =>
        qb.where("e.siret", "in", sirets ?? []),
      )
      .execute();
    return aggregates.map(({ aggregate }) =>
      makeEstablishmentAggregateFromDb(aggregate),
    );
  }

  public async createImmersionOffersToEstablishments(
    offersWithSiret: OfferWithSiret[],
  ) {
    if (offersWithSiret.length === 0) return;

    await this.transaction
      .insertInto("immersion_offers")
      .values(
        offersWithSiret.map((offerWithSiret) => ({
          appellation_code: Number.parseInt(offerWithSiret.appellationCode, 10),
          remote_work_mode: offerWithSiret.remoteWorkMode,
          siret: offerWithSiret.siret,
          created_at: sql`${offerWithSiret.createdAt.toISOString()}`,
        })),
      )
      .execute();
  }

  public async delete(siret: string): Promise<void> {
    logger.info({
      message: `About to delete establishment with siret : ${siret}`,
    });

    await this.#deleteUserRightsBySiret(siret);

    return this.transaction
      .deleteFrom("establishments")
      .where("siret", "=", siret)
      .returning("siret")
      .execute()
      .then((result) => {
        if (result.length !== 1) throw errors.establishment.notFound({ siret });
        logger.info({
          message: `Deleted establishment successfully. Siret was : ${siret}`,
        });
      })
      .catch((error) => {
        logger.info({
          message: `Error when deleting establishment with siret ${siret} : ${error.message}`,
        });
        logger.info({ message: "Full Error", error });
        throw error;
      });
  }

  public async getOffersAsAppellationAndRomeDtosBySiret(
    siret: string,
  ): Promise<AppellationAndRomeDto[]> {
    const results = await this.transaction
      .selectFrom("immersion_offers as io")
      .leftJoin(
        "public_appellations_data as pad",
        "pad.ogr_appellation",
        "io.appellation_code",
      )
      .fullJoin("public_romes_data as prd", "prd.code_rome", "pad.code_rome")
      .select([
        "prd.code_rome",
        "prd.libelle_rome",
        "pad.libelle_appellation_long",
        "pad.ogr_appellation",
      ])
      .where("io.siret", "=", siret)
      .execute();

    return results.map(
      ({
        code_rome,
        libelle_rome,
        libelle_appellation_long,
        ogr_appellation,
      }) => {
        if (!code_rome) throw new Error("code_rome is null");
        if (!libelle_rome) throw new Error("libelle_rome is null");
        if (!libelle_appellation_long)
          throw new Error("libelle_appellation_long is null");
        if (!ogr_appellation) throw new Error("ogr_appellation is null");
        const dto: AppellationAndRomeDto = {
          romeCode: code_rome,
          appellationCode: ogr_appellation.toString(),
          romeLabel: libelle_rome,
          appellationLabel: libelle_appellation_long, // libelle_appellation_long should not be undefined
        };
        return dto;
      },
    );
  }

  public async getSiretsOfEstablishmentsNotUpdatedSince({
    updatedBefore,
    limit,
    offset = 0,
  }: {
    updatedBefore: Date;
    limit: number;
    offset?: number;
  }): Promise<SiretDto[]> {
    const result = await this.transaction
      .selectFrom("establishments")
      .select("establishments.siret")
      .where("establishments.update_date", "<", updatedBefore)
      .orderBy("establishments.update_date", "asc")
      .orderBy("establishments.siret", "asc")
      .limit(limit)
      .offset(offset)
      .execute();

    return result.map(({ siret }) => siret);
  }

  public async getSiretsOfEstablishmentsNotCheckedAtInseeSince(
    checkDate: Date,
    maxResults: number,
  ): Promise<SiretDto[]> {
    const maxLimit = 1000;
    if (maxResults > maxLimit)
      throw errors.establishment.outOfMaxLimit({
        kind: "getSiretsOfEstablishmentsNotCheckedAtInseeSince",
        maxLimit,
      });

    const results = await this.transaction
      .selectFrom("establishments")
      .select("siret")
      .where((eb) =>
        eb.or([
          eb("last_insee_check_date", "is", null),
          eb("last_insee_check_date", "<", checkDate),
        ]),
      )
      .limit(maxResults)
      .execute();

    return results.map(({ siret }) => siret);
  }

  public async getSiretsOfEstablishmentsWithRomeCode(
    rome: string,
  ): Promise<string[]> {
    const results = await this.transaction
      .selectFrom("immersion_offers")
      .select("siret")
      .leftJoin(
        "public_appellations_data",
        "public_appellations_data.ogr_appellation",
        "immersion_offers.appellation_code",
      )
      .where("public_appellations_data.code_rome", "=", rome)
      .execute();

    return results.map((row) => row.siret);
  }

  public async hasEstablishmentAggregateWithSiret(
    siret: string,
  ): Promise<boolean> {
    const result = await this.transaction
      .selectNoFrom(({ exists, selectFrom }) =>
        exists(
          selectFrom("establishments")
            .where("siret", "=", siret)
            .select("siret"),
        ).as("exist"),
      )
      .executeTakeFirst();

    return result !== undefined ? Boolean(result.exist) : false;
  }

  public async insertEstablishmentAggregate(aggregate: EstablishmentAggregate) {
    await this.#insertEstablishmentFromAggregate(aggregate);
    await this.#insertLocations(aggregate.establishment);
    await this.#insertUserRightsFromAggregate(aggregate);
    await this.createImmersionOffersToEstablishments(
      aggregate.offers.map((immersionOffer) => ({
        siret: aggregate.establishment.siret,
        ...immersionOffer,
      })),
    );
  }

  public async markEstablishmentAsSearchableWhenRecentDiscussionAreUnderMaxContactPerMonth(
    now: Date,
  ): Promise<number> {
    const sinceOneMonthAgo = subDays(now, 30);
    const sinceOneWeekAgo = subDays(now, 7);
    const result = await this.transaction
      .updateTable("establishments")
      .set({ is_max_discussions_for_period_reached: false })
      .where("is_max_discussions_for_period_reached", "=", true)
      .where("max_contacts_per_month", ">", 0)
      .where("siret", "not in", (eb) =>
        eb
          .selectFrom("establishments")
          .select("establishments.siret")
          .leftJoin("discussions", "establishments.siret", "discussions.siret")
          .where("is_max_discussions_for_period_reached", "=", true)
          .where("max_contacts_per_month", ">", 0)
          .where("discussions.created_at", ">", sinceOneMonthAgo)
          .groupBy("establishments.siret")
          .having(sql<any>`COUNT(*) >= establishments.max_contacts_per_month`),
      )
      .where("siret", "not in", (eb) =>
        eb
          .selectFrom("establishments")
          .select("establishments.siret")
          .leftJoin("discussions", "establishments.siret", "discussions.siret")
          .where("is_max_discussions_for_period_reached", "=", true)
          .where("max_contacts_per_month", ">", 0)
          .where("discussions.created_at", ">", sinceOneWeekAgo)
          .groupBy("establishments.siret")
          .having(
            sql<any>`COUNT(*) >= CEIL(establishments.max_contacts_per_month / 4)`,
          ),
      )
      .returning("siret")
      .execute();

    return result.length;
  }

  public async getOffers({
    pagination,
    sort,
    filters,
  }: GetOffersParams): Promise<
    DataWithPagination<RepositorySearchImmersionResult>
  > {
    const { limit, offset } = calculateLimitAndOffsetFromPagination(pagination);

    const { data, totalRecords } = await searchImmersionResultsQuery(
      this.transaction,
      {
        filters,
        sort,
        limit,
        offset,
        shouldCountAll: true,
      },
    );

    if (totalRecords === undefined)
      throw new Error("totalRecords is undefined"); // should not happen

    return {
      data,
      pagination: calculatePaginationResult({ ...pagination, totalRecords }),
    };
  }

  public async updateEstablishmentAggregate(
    updatedAggregate: EstablishmentAggregate,
    updatedAt: Date,
  ): Promise<void> {
    const existingAggregate = await this.getEstablishmentAggregateBySiret(
      updatedAggregate.establishment.siret,
    );
    if (!existingAggregate)
      throw errors.establishment.notFound({
        siret: updatedAggregate.establishment.siret,
      });

    // Remove offers that don't exist anymore and create those that did not exist before
    await this.#updateImmersionOffersFromAggregates(
      existingAggregate,
      updatedAggregate,
    );
    // Update establishment if it has changed
    if (
      !establishmentsEqual(
        existingAggregate.establishment,
        updatedAggregate.establishment,
      )
    ) {
      await this.#updateEstablishmentEntity(
        updatedAggregate.establishment,
        updatedAt,
      );
    }

    await this.#deleteUserRightsBySiret(updatedAggregate.establishment.siret);
    await this.#insertUserRightsFromAggregate(updatedAggregate);
  }

  public async updateEstablishmentsWithInseeData(
    inseeCheckDate: Date,
    params: UpdateEstablishmentsWithInseeDataParams,
  ): Promise<void> {
    for (const [siret, values] of Object.entries(params)) {
      const isOpen =
        values?.isOpen !== undefined ? { is_open: values.isOpen } : {};
      const name = values?.name !== undefined ? { name: values.name } : {};
      const nafDto =
        values?.nafDto !== undefined
          ? {
              naf_code: values.nafDto.code,
              naf_nomenclature: values.nafDto.nomenclature,
            }
          : {};
      const numberEmployees =
        values?.numberEmployeesRange !== undefined
          ? { number_employees: values.numberEmployeesRange }
          : {};

      await this.transaction
        .updateTable("establishments")
        .set({
          last_insee_check_date: inseeCheckDate,
          ...isOpen,
          ...nafDto,
          ...name,
          ...numberEmployees,
        })
        .where("siret", "=", siret)
        .execute();
    }
  }

  public async getSiretsInRepoFromSiretList(
    sirets: SiretDto[],
  ): Promise<SiretDto[]> {
    if (sirets.length === 0) return [];
    const results = await this.transaction
      .selectFrom("establishments")
      .select("siret")
      .where("siret", "in", sirets)
      .execute();

    return results.map(({ siret }) => siret);
  }

  async #updateEstablishmentEntity(
    establishment: EstablishmentEntity,
    updatedAt: Date,
  ): Promise<void> {
    await this.transaction
      .updateTable("establishments")
      .set({
        additional_information: establishment.additionalInformation ?? null,
        customized_name: establishment.customizedName ?? null,
        fit_for_disabled_workers: establishment.fitForDisabledWorkers ?? null,
        is_commited: establishment.isCommited ?? null,
        is_open: establishment.isOpen,
        is_max_discussions_for_period_reached:
          establishment.isMaxDiscussionsForPeriodReached,
        last_insee_check_date: establishment.lastInseeCheckDate ?? null,
        max_contacts_per_month: establishment.maxContactsPerMonth,
        naf_code: establishment.nafDto.code,
        naf_nomenclature: establishment.nafDto.nomenclature,
        name: establishment.name,
        next_availability_date: establishment.nextAvailabilityDate ?? null,
        number_employees: establishment.numberEmployeesRange,
        searchable_by_job_seekers: establishment.searchableBy.jobSeekers,
        searchable_by_students: establishment.searchableBy.students,
        siret: establishment.siret,
        source_provider: establishment.sourceProvider,
        update_date: updatedAt,
        website: establishment.website ?? null,
        contact_mode: establishment.contactMode,
        welcome_address_street_number_and_address:
          establishment.potentialBeneficiaryWelcomeAddress?.address
            .streetNumberAndAddress ?? null,
        welcome_address_postcode:
          establishment.potentialBeneficiaryWelcomeAddress?.address.postcode ??
          null,
        welcome_address_city:
          establishment.potentialBeneficiaryWelcomeAddress?.address.city ??
          null,
        welcome_address_department_code:
          establishment.potentialBeneficiaryWelcomeAddress?.address
            .departmentCode ?? null,
        welcome_address_lat:
          establishment.potentialBeneficiaryWelcomeAddress?.position.lat ??
          null,
        welcome_address_lon:
          establishment.potentialBeneficiaryWelcomeAddress?.position.lon ??
          null,
      })
      .where("siret", "=", establishment.siret)
      .execute();

    await this.transaction
      .deleteFrom("establishments_location_infos")
      .where("establishment_siret", "=", establishment.siret)
      .execute();

    await this.#insertLocations(establishment);
  }

  async #insertEstablishmentFromAggregate(aggregate: EstablishmentAggregate) {
    await this.transaction
      .insertInto("establishments")
      .values({
        siret: aggregate.establishment.siret,
        score: aggregate.establishment.score,
        name: aggregate.establishment.name,
        customized_name: aggregate.establishment.customizedName,
        website: aggregate.establishment.website,
        additional_information: aggregate.establishment.additionalInformation,
        number_employees: aggregate.establishment.numberEmployeesRange,
        naf_code: aggregate.establishment.nafDto.code,
        naf_nomenclature: aggregate.establishment.nafDto.nomenclature,
        source_provider: aggregate.establishment.sourceProvider,
        update_date: aggregate.establishment.updatedAt,
        is_open: aggregate.establishment.isOpen,
        is_max_discussions_for_period_reached:
          aggregate.establishment.isMaxDiscussionsForPeriodReached,
        is_commited: aggregate.establishment.isCommited,
        fit_for_disabled_workers: aggregate.establishment.fitForDisabledWorkers,
        max_contacts_per_month: aggregate.establishment.maxContactsPerMonth,
        last_insee_check_date: aggregate.establishment.lastInseeCheckDate,
        created_at: aggregate.establishment.createdAt,
        next_availability_date: aggregate.establishment.nextAvailabilityDate,
        searchable_by_students: aggregate.establishment.searchableBy.students,
        searchable_by_job_seekers:
          aggregate.establishment.searchableBy.jobSeekers,
        acquisition_keyword: aggregate.establishment.acquisitionKeyword,
        acquisition_campaign: aggregate.establishment.acquisitionCampaign,
        contact_mode: aggregate.establishment.contactMode,
        welcome_address_street_number_and_address:
          aggregate.establishment.potentialBeneficiaryWelcomeAddress?.address
            .streetNumberAndAddress ?? null,
        welcome_address_postcode:
          aggregate.establishment.potentialBeneficiaryWelcomeAddress?.address
            .postcode ?? null,
        welcome_address_city:
          aggregate.establishment.potentialBeneficiaryWelcomeAddress?.address
            .city ?? null,
        welcome_address_department_code:
          aggregate.establishment.potentialBeneficiaryWelcomeAddress?.address
            .departmentCode ?? null,
        welcome_address_lat:
          aggregate.establishment.potentialBeneficiaryWelcomeAddress?.position
            .lat ?? null,
        welcome_address_lon:
          aggregate.establishment.potentialBeneficiaryWelcomeAddress?.position
            .lon ?? null,
      })
      .execute();
  }

  async #insertUserRightsFromAggregate(
    aggregate: EstablishmentAggregate,
  ): Promise<void> {
    const { userRights } = aggregate;
    if (!userRights.length) return;

    const phonesToCreate = userRights
      .map((userRight) => userRight.phone)
      .filter((phone) => phone !== undefined);

    const phoneIds = await getOrCreatePhoneIds(
      this.transaction,
      phonesToCreate,
    );

    return this.transaction
      .insertInto("establishments__users")
      .values(
        userRights.map((userRight) => ({
          siret: aggregate.establishment.siret,
          user_id: userRight.userId,
          role: userRight.role,
          job: userRight.job,
          phone_id: userRight.phone ? phoneIds[userRight.phone] : null,
          should_receive_discussion_notifications:
            userRight.shouldReceiveDiscussionNotifications,
          is_main_contact_by_phone: userRight.isMainContactByPhone,
          is_main_contact_in_person: userRight.isMainContactInPerson,
          status: userRight.status,
        })),
      )
      .execute()
      .then(() => {
        return;
      })
      .catch((error) => {
        logger.error({
          error: castError(error),
          message: "Error inserting contacts",
        });
        throw error;
      });
  }

  async #deleteUserRightsBySiret(siret: SiretDto): Promise<void> {
    await this.transaction
      .deleteFrom("establishments__users")
      .where("siret", "=", siret)
      .execute();
  }

  async #getRomeCodeFromAppellationCodes(
    appellationCodes: AppellationCode[] | undefined,
  ): Promise<RomeCode[] | undefined> {
    if (!appellationCodes) return;

    const result = await this.transaction
      .selectFrom("public_appellations_data")
      .select("code_rome")
      .where(
        "ogr_appellation",
        "in",
        appellationCodes.map((appellationCode) =>
          Number.parseInt(appellationCode, 10),
        ),
      )
      .execute();

    const romeCodes: RomeCode[] = result.map(({ code_rome }) => code_rome);

    if (romeCodes.length === 0)
      throw new Error(
        `No Rome code found for appellation codes ${appellationCodes}`,
      );

    return romeCodes;
  }

  async #updateImmersionOffersFromAggregates(
    existingAggregate: EstablishmentAggregate,
    updatingAggregate: EstablishmentAggregate,
  ) {
    const updatedOffers = updatingAggregate.offers;
    const existingOffers = existingAggregate.offers;
    const siret = existingAggregate.establishment.siret;

    const offersToRemove = existingOffers.filter(
      (updatedOffer) =>
        !updatedOffers.find((existingOffer) =>
          offersEqual(existingOffer, updatedOffer),
        ),
    );
    const offersToRemoveByRomeCode = offersToRemove
      .filter((offer) => !offer.appellationCode)
      .map((offer) => offer.romeCode);

    if (offersToRemoveByRomeCode.length > 0)
      await this.transaction
        .deleteFrom("immersion_offers")
        .leftJoin(
          "public_appellations_data",
          "immersion_offers.appellation_code",
          "public_appellations_data.ogr_appellation",
        )
        .where("siret", "=", siret)
        .where("appellation_code", "is", null)
        .where(
          "public_appellations_data.code_rome",
          "in",
          offersToRemoveByRomeCode,
        )
        .execute();

    const offersToRemoveByAppellationCode = offersToRemove
      .filter((offer) => !!offer.appellationCode)
      .map((offer) => offer.appellationCode);

    if (offersToRemoveByAppellationCode.length > 0)
      await this.transaction
        .deleteFrom("immersion_offers")
        .where("siret", "=", siret)
        .where(
          "appellation_code",
          "in",
          offersToRemoveByAppellationCode.map((appellationCode) =>
            Number.parseInt(appellationCode, 10),
          ),
        )
        .execute();

    const offersToAdd = updatedOffers.filter(
      (updatedOffer) =>
        !existingOffers.find((existingOffer) =>
          offersEqual(existingOffer, updatedOffer),
        ),
    );

    if (offersToAdd.length > 0)
      await this.transaction
        .insertInto("immersion_offers")
        .values(
          offersToAdd.map((offerToAdd) => ({
            appellation_code: Number.parseInt(offerToAdd.appellationCode, 10),
            remote_work_mode: offerToAdd.remoteWorkMode,
            created_at: sql`${offerToAdd.createdAt.toISOString()}`,
            siret,
          })),
        )
        .execute();
  }

  async #insertLocations(establishment: EstablishmentEntity) {
    await this.transaction
      .insertInto("establishments_location_infos")
      .values(
        establishment.locations.map(({ position, address, id }) => ({
          id,
          establishment_siret: establishment.siret,
          city: address.city,
          department_code: address.departmentCode,
          post_code: address.postcode,
          street_number_and_address: address.streetNumberAndAddress,
          lat: position.lat,
          lon: position.lon,
        })),
      )
      .execute();

    await this.transaction
      .insertInto("establishments_location_positions")
      .values((eb) =>
        establishment.locations.map(({ position, id }) => ({
          id,
          position: eb.fn("ST_GeographyFromText", [
            sql`${`POINT(${position.lon} ${position.lat})`}`,
          ]),
        })),
      )
      .execute();
  }
}

const offersEqual = (a: OfferEntity, b: OfferEntity) =>
  a.appellationCode === b.appellationCode &&
  a.remoteWorkMode === b.remoteWorkMode;

const objectsDeepEqual = <T>(a: T, b: T) =>
  equals(JSON.parse(JSON.stringify(a)), JSON.parse(JSON.stringify(b))); // replacing with clone() would does not work here

const establishmentsEqual = (
  a: EstablishmentEntity,
  b: EstablishmentEntity,
) => {
  // Ignore key updatedAt
  const { updatedAt: _unusedUpdatedAtA, ...establishmentAWithoutUpdatedAt } = a;
  const { updatedAt: _unusedUpdatedAtB, ...establishmentBWithoutUpdatedAt } = b;

  return objectsDeepEqual(
    establishmentAWithoutUpdatedAt,
    establishmentBWithoutUpdatedAt,
  );
};

const makeEstablishmentAggregateFromDb = (
  aggregate: any, // TODO Enlever le any
): EstablishmentAggregate => {
  return {
    establishment: {
      ...aggregate.establishment,
      locations: aggregate.establishment.locations.map(
        (location: any) => location.location,
      ),
      updatedAt: aggregate.establishment.updatedAt
        ? new Date(aggregate.establishment.updatedAt)
        : undefined,
      createdAt: new Date(aggregate.establishment.createdAt),
      lastInseeCheckDate: aggregate.establishment.lastInseeCheckDate
        ? new Date(aggregate.establishment.lastInseeCheckDate)
        : undefined,
      voluntaryToImmersion: true,
      potentialBeneficiaryWelcomeAddress: aggregate.establishment
        .potentialBeneficiaryWelcomeAddress
        ? {
            address: {
              streetNumberAndAddress:
                aggregate.establishment.potentialBeneficiaryWelcomeAddress
                  .address.streetNumberAndAddress,
              postcode:
                aggregate.establishment.potentialBeneficiaryWelcomeAddress
                  .address.postcode,
              city: aggregate.establishment.potentialBeneficiaryWelcomeAddress
                .address.city,
              departmentCode:
                aggregate.establishment.potentialBeneficiaryWelcomeAddress
                  .address.departmentCode,
            },
            position: {
              lat: aggregate.establishment.potentialBeneficiaryWelcomeAddress
                .position.lat,
              lon: aggregate.establishment.potentialBeneficiaryWelcomeAddress
                .position.lon,
            },
          }
        : undefined,
    },
    offers: aggregate.immersionOffers.map(
      (immersionOfferWithStringDate: any) => ({
        ...immersionOfferWithStringDate.offer,
        createdAt: new Date(immersionOfferWithStringDate.offer.createdAt),
      }),
    ),
    userRights: aggregate.userRights?.map(
      (userRight: any) => userRight.userRight,
    ),
  };
};

export type SearchImmersionFilters = {
  appellationCodes?: AppellationCode[];
  departmentCodes?: DepartmentCode[];
  excludedSirets?: SiretDto[];
  fitForDisabledWorkers?: FitForDisableWorkerOption[];
  geoParams?: GeoParams;
  locationIds?: LocationId[];
  nafCodes?: NafCode[];
  remoteWorkModes?: RemoteWorkMode[];
  romeCodes?: RomeCode[];
  sirets?: SiretDto[];
  searchableBy?: EstablishmentSearchableByValue;
  showOnlyAvailableOffers: boolean;
};

const establishmentByFiltersQueryBuilder = (db: KyselyDb) =>
  db
    .selectFrom("establishments as e")
    .leftJoin("banned_establishments as be", "be.siret", "e.siret")
    .select(({ ref, eb }) =>
      jsonStripNulls(
        jsonBuildObject({
          establishment: jsonBuildObject({
            acquisitionCampaign: ref("e.acquisition_campaign"),
            acquisitionKeyword: ref("e.acquisition_keyword"),
            score: ref("e.score"),
            siret: ref("e.siret"),
            name: ref("e.name"),
            customizedName: ref("e.customized_name"),
            contactMode: ref("e.contact_mode"),
            website: ref("e.website"),
            additionalInformation: ref("e.additional_information"),
            locations: jsonArrayFrom(
              eb
                .selectFrom("establishments_location_infos as loc")
                .whereRef("loc.establishment_siret", "=", "e.siret")
                .select(({ ref }) =>
                  jsonBuildObject({
                    id: ref("loc.id"),
                    position: jsonBuildObject({
                      lon: ref("loc.lon"),
                      lat: ref("loc.lat"),
                    }),
                    address: jsonBuildObject({
                      streetNumberAndAddress: ref(
                        "loc.street_number_and_address",
                      ),
                      postcode: ref("loc.post_code"),
                      city: ref("loc.city"),
                      departmentCode: ref("department_code"),
                    }),
                  }).as("location"),
                ),
            ),
            sourceProvider: ref("e.source_provider"),
            numberEmployeesRange: ref("e.number_employees"),
            updatedAt: sql<string>`TO_CHAR
                ( ${ref(
                  "e.update_date",
                )}::timestamp, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`,
            createdAt: sql<string>`TO_CHAR
                ( ${ref(
                  "e.created_at",
                )}::timestamp, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`,
            lastInseeCheckDate: sql<string>`TO_CHAR
                ( ${ref(
                  "e.last_insee_check_date",
                )}::timestamp, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`,
            isOpen: ref("e.is_open"),
            isMaxDiscussionsForPeriodReached: ref(
              "e.is_max_discussions_for_period_reached",
            ),
            isCommited: ref("e.is_commited"),
            fitForDisabledWorkers: ref("e.fit_for_disabled_workers"),
            maxContactsPerMonth: ref("e.max_contacts_per_month"),
            nextAvailabilityDate: sql<string>`date_to_iso
                    (${ref("e.next_availability_date")})`,
            searchableBy: jsonBuildObject({
              jobSeekers: ref("e.searchable_by_job_seekers"),
              students: ref("e.searchable_by_students"),
            }),
            nafDto: jsonBuildObject({
              code: ref("e.naf_code"),
              nomenclature: ref("e.naf_nomenclature"),
            }),
            isEstablishmentBanned: sql<boolean>`${ref("be.siret")} IS NOT NULL`,
            establishmentBannishmentJustification: ref(
              "be.bannishment_justification",
            ),
            potentialBeneficiaryWelcomeAddress: sql`CASE WHEN ${ref("e.contact_mode")} = 'IN_PERSON' THEN ${jsonBuildObject(
              {
                address: jsonBuildObject({
                  streetNumberAndAddress: ref(
                    "e.welcome_address_street_number_and_address",
                  ),
                  postcode: ref("e.welcome_address_postcode"),
                  city: ref("e.welcome_address_city"),
                  departmentCode: ref("e.welcome_address_department_code"),
                }),
                position: jsonBuildObject({
                  lat: ref("e.welcome_address_lat"),
                  lon: ref("e.welcome_address_lon"),
                }),
              },
            )} ELSE NULL END`,
          }),
          immersionOffers: jsonArrayFrom(
            eb
              .selectFrom("immersion_offers as io")
              .leftJoin(
                "public_appellations_data as pad",
                "pad.ogr_appellation",
                "io.appellation_code",
              )
              .leftJoin(
                "public_romes_data as prd",
                "prd.code_rome",
                "pad.code_rome",
              )
              .whereRef("io.siret", "=", "e.siret")
              .select(({ ref }) =>
                jsonBuildObject({
                  romeCode: ref("pad.code_rome"),
                  romeLabel: ref("prd.libelle_rome"),
                  remoteWorkMode: ref("io.remote_work_mode"),
                  appellationCode: sql<string>`${ref(
                    "io.appellation_code",
                  )}::text`,
                  appellationLabel: ref("pad.libelle_appellation_long"),
                  createdAt: sql<string>`TO_CHAR
                      ( ${ref(
                        "io.created_at",
                      )}::timestamp, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`,
                }).as("offer"),
              )
              .orderBy("io.appellation_code asc"),
          ),
          userRights: jsonArrayFrom(
            eb
              .selectFrom("establishments__users as eu")
              .leftJoin("phone_numbers", "phone_numbers.id", "eu.phone_id")
              .whereRef("eu.siret", "=", "e.siret")
              .select(({ ref }) =>
                jsonBuildObject({
                  userId: ref("eu.user_id"),
                  role: ref("eu.role"),
                  job: ref("eu.job"),
                  phone: ref("phone_numbers.phone_number"),
                  shouldReceiveDiscussionNotifications: ref(
                    "eu.should_receive_discussion_notifications",
                  ),
                  isMainContactByPhone: ref("eu.is_main_contact_by_phone"),
                  isMainContactInPerson: ref("eu.is_main_contact_in_person"),
                  status: sql<EstablishmentUserRightStatus>`${ref("eu.status")}`,
                }).as("userRight"),
              ),
          ),
        }),
      ).as("aggregate"),
    )
    .groupBy(["e.siret", "be.siret", "be.bannishment_justification"])
    .orderBy("e.siret asc");
