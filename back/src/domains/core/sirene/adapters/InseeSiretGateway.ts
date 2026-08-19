import Bottleneck from "bottleneck";
import { format, formatISO } from "date-fns";
import {
  errors,
  filterNotFalsy,
  type NafDto,
  type OmitFromExistingKeys,
  queryParamsAsString,
  type SiretDto,
  type SiretEstablishmentDto,
} from "shared";
import type { HttpClient } from "shared-routes";
import type { InseeAccessTokenConfig } from "../../../../config/bootstrap/appConfig";
import { partnerNames } from "../../../../config/bootstrap/partnerNames";
import { createLogger } from "../../../../utils/logger";
import type { WithCache } from "../../caching-gateway/port/WithCache";
import type { RetryStrategy } from "../../retry-strategy/ports/RetryStrategy";
import type { TimeGateway } from "../../time-gateway/ports/TimeGateway";
import type {
  EstablishmentsFromSiretApi,
  SiretEstablishmentResponseDto,
  SiretGateway,
} from "../ports/SiretGateway";
import {
  type InseeExternalRoutes,
  inseeExternalRoutes,
} from "./InseeSiretGateway.routes";
import { getNumberEmployeesRangeByTefenCode } from "./SiretGateway.common";

const logger = createLogger(__filename);

const inseeMaxRequestsPerMinute = 500;
const inseeMaxRequestPerInterval = 1;
const rate_ms = 3_000;

const ONE_MINUTE_MS = 60 * 1000;
// The documentation can be found here:
// https://portail-api.insee.fr/catalog/all > Api Sirene Privée > Documentation

export class InseeSiretGateway implements SiretGateway {
  #limiter = new Bottleneck({
    reservoir: inseeMaxRequestsPerMinute,
    reservoirRefreshInterval: ONE_MINUTE_MS,
    reservoirRefreshAmount: inseeMaxRequestsPerMinute,
    minTime: Math.ceil(ONE_MINUTE_MS / inseeMaxRequestsPerMinute),
  });

  // 1 call every 3 seconds
  #tokenLimiter = new Bottleneck({
    maxConcurrent: 1,
    reservoir: inseeMaxRequestPerInterval,
    reservoirRefreshInterval: rate_ms,
    reservoirRefreshAmount: inseeMaxRequestPerInterval,
    minTime: Math.ceil(rate_ms / inseeMaxRequestPerInterval),
  });

  readonly #retryStrategy: RetryStrategy;

  readonly #config: InseeAccessTokenConfig;
  readonly #httpClient: HttpClient<InseeExternalRoutes>;

  readonly #timeGateway: TimeGateway;

  #withCache: WithCache;

  constructor(
    config: InseeAccessTokenConfig,
    httpClient: HttpClient<InseeExternalRoutes>,
    timeGateway: TimeGateway,
    retryStrategy: RetryStrategy,
    withCache: WithCache,
  ) {
    this.#config = config;
    this.#retryStrategy = retryStrategy;
    this.#timeGateway = timeGateway;
    this.#httpClient = httpClient;
    this.#withCache = withCache;
  }

  public async getEstablishmentBySiret(
    siret: SiretDto,
    includeClosedEstablishments = false,
  ): Promise<SiretEstablishmentResponseDto | undefined> {
    return this.#retryStrategy.apply(async () => {
      const response = await this.#limiter.schedule(async () =>
        this.#httpClient.getEstablishmentBySiret({
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Accept: "application/json",
            Authorization: `Bearer ${
              (await this.#getAccessToken()).access_token
            }`,
          },
          queryParams: this.#createSiretQueryParams(
            siret,
            includeClosedEstablishments,
          ),
        }),
      );
      if (response.status === 404) return;
      if (response.status === 200) {
        const establishment = response.body.etablissements.at(0);
        if (!establishment) return;
        return convertSirenRawEstablishmentToSirenEstablishmentDto(
          establishment,
        );
      }

      if ([429, 503].includes(response.status)) {
        throw errors.siretApi.tooManyRequests({
          serviceName: partnerNames.inseeSiret,
        });
      }

      throw new Error(
        `INSEE API Failed with ${
          response.status
        } - check datadog logs : ${JSON.stringify(response.body, null, 2)}`,
      );
    });
  }

  public async getEstablishmentUpdatedBetween(
    fromDate: Date,
    toDate: Date,
    sirets: SiretDto[],
  ): Promise<EstablishmentsFromSiretApi> {
    const formattedFromDate = format(fromDate, "yyyy-MM-dd");
    const formattedToDate = format(toDate, "yyyy-MM-dd");

    const requestBody = queryParamsAsString({
      q: [
        `dateDernierTraitementEtablissement:[${formattedFromDate} TO ${formattedToDate}]`,
        `(${sirets.map((siret) => `siret:${siret}`).join(" OR ")})`,
      ].join(" AND "),
      champs: [
        "siret",
        "denominationUniteLegale",
        "nomUniteLegale",
        "prenomUsuelUniteLegale",
        "activitePrincipaleUniteLegale",
        "nomenclatureActivitePrincipaleUniteLegale",
        "trancheEffectifsUniteLegale",
        "etatAdministratifUniteLegale",
        "numeroVoieEtablissement",
        "typeVoieEtablissement",
        "libelleVoieEtablissement",
        "codePostalEtablissement",
        "libelleCommuneEtablissement",
        "dateDebut",
        "dateFin",
        "etatAdministratifEtablissement",
      ].join(","),
      nombre: 1000,
    });

    const response = await this.#httpClient.getEstablishmentUpdatedBetween({
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
        Authorization: `Bearer ${(await this.#getAccessToken()).access_token}`,
      },
      body: requestBody,
    });

    if (response.status === 404) return {};

    if ([429, 503].includes(response.status)) {
      throw errors.siretApi.tooManyRequests({
        serviceName: partnerNames.inseeSiret,
      });
    }

    if (response.status !== 200) {
      logger.error({
        message: `INSEE API Failed with ${response.status} : ${JSON.stringify(
          response.body,
          null,
          2,
        )}`,
      });

      throw new Error(
        `INSEE API Failed with ${response.status}. More logs in datadog.`,
      );
    }

    return response.body.etablissements.reduce(
      (acc, establishment) => ({
        ...acc,
        [establishment.siret]:
          convertSirenRawEstablishmentToSirenEstablishmentDto(establishment),
      }),
      {} satisfies Record<SiretDto, SiretEstablishmentDto>,
    );
  }

  async #getAccessToken() {
    return this.#withCache({
      overrideCacheDurationInHours: 5 / 60, //5 minutes
      getCacheKey: () => "insee_access_token",
      logParams: {
        partner: "inseeSiret",
        route: inseeExternalRoutes.getAccessToken,
      },
      cb: () =>
        this.#retryStrategy.apply(() =>
          this.#tokenLimiter.schedule(() => {
            return this.#httpClient
              .getAccessToken({
                headers: {
                  "Content-Type": "application/x-www-form-urlencoded",
                },
                body: new URLSearchParams({
                  grant_type: "password",
                  client_id: this.#config.clientId,
                  client_secret: this.#config.clientSecret,
                  username: this.#config.username,
                  password: this.#config.password,
                }).toString(),
              })
              .then((response) => {
                if (response?.status === 200) return response.body;
                throw new Error(
                  `Could not access INSEE SIREN API. Status: ${
                    response?.status
                  }. Body: ${JSON.stringify(response?.body)}`,
                );
              });
          }),
        ),
    })(this.#config.clientId);
  }

  #createSiretQueryParams(
    siret: SiretDto,
    includeClosedEstablishments = false,
  ): {
    date?: string | undefined;
    q: string;
  } {
    // According to API SIRENE documentation :
    // etatAdministratifEtablissement :
    //   État de l'établissement pendant la période :
    //     A= établissement actif
    //     F= établissement fermé
    return includeClosedEstablishments
      ? { q: `siret:${siret}` }
      : {
          q: `siret:${siret} AND periode(etatAdministratifEtablissement:A)`,
          date: formatISO(this.#timeGateway.now(), {
            representation: "date",
          }),
        };
  }
}

type InseePeriodeEtablissment = Partial<{
  dateFin: string | null;
  dateDebut: string | null;
  etatAdministratifEtablissement: "A" | "F";
}>;

type InseePeriodeEtablissmentWithDateFin = OmitFromExistingKeys<
  InseePeriodeEtablissment,
  "dateFin"
> & {
  dateFin: string | null;
};

export type InseeApiRawEstablishment = {
  siret: string;
  uniteLegale: Partial<{
    denominationUniteLegale?: string;
    nomUniteLegale?: string;
    prenomUsuelUniteLegale?: string;
    activitePrincipaleUniteLegale?: string;
    nomenclatureActivitePrincipaleUniteLegale?: string;
    trancheEffectifsUniteLegale?: string;
    etatAdministratifUniteLegale?: string;
  }>;
  adresseEtablissement: Partial<{
    numeroVoieEtablissement?: string;
    typeVoieEtablissement?: string;
    libelleVoieEtablissement?: string;
    codePostalEtablissement?: string;
    libelleCommuneEtablissement?: string;
  }>;
  periodesEtablissement: Array<InseePeriodeEtablissment>;
};

export type SirenGatewayAnswer = {
  header: {
    statut: number;
    message: string;
    total: number;
    debut: number;
    nombre: number;
  };
  etablissements: InseeApiRawEstablishment[];
};

export const convertSirenRawEstablishmentToSirenEstablishmentDto = (
  siretEstablishment: InseeApiRawEstablishment,
): SiretEstablishmentResponseDto => ({
  siret: siretEstablishment.siret,
  businessName: getBusinessName(siretEstablishment),
  businessAddress: getFormattedAddress(siretEstablishment),
  nafDto: getNafAndNomenclature(siretEstablishment),
  numberEmployeesRange: getNumberEmployeesRangeByTefenCode(
    siretEstablishment.uniteLegale.trancheEffectifsUniteLegale,
  ),
  isOpen: getIsActive(siretEstablishment),
});

const getBusinessName = ({ uniteLegale }: InseeApiRawEstablishment): string => {
  const denomination = uniteLegale.denominationUniteLegale;
  if (denomination) return denomination;

  return [uniteLegale.prenomUsuelUniteLegale, uniteLegale.nomUniteLegale]
    .filter(filterNotFalsy)
    .join(" ");
};

const getNafAndNomenclature = ({
  uniteLegale,
}: InseeApiRawEstablishment): NafDto | undefined => {
  const naf = uniteLegale.activitePrincipaleUniteLegale?.replace(".", "");
  if (!naf || !uniteLegale.nomenclatureActivitePrincipaleUniteLegale) return;

  return {
    code: naf,
    nomenclature: uniteLegale.nomenclatureActivitePrincipaleUniteLegale,
  };
};
const getFormattedAddress = ({
  adresseEtablissement,
}: InseeApiRawEstablishment): string =>
  [
    adresseEtablissement.numeroVoieEtablissement,
    adresseEtablissement.typeVoieEtablissement,
    adresseEtablissement.libelleVoieEtablissement,
    adresseEtablissement.codePostalEtablissement,
    adresseEtablissement.libelleCommuneEtablissement,
  ]
    .filter(filterNotFalsy)
    .join(" ");

const hasDateFin = (
  periode: InseePeriodeEtablissment,
): periode is InseePeriodeEtablissmentWithDateFin =>
  periode.dateFin !== undefined;

const getIsActive = ({
  uniteLegale,
  periodesEtablissement,
}: InseeApiRawEstablishment) => {
  const periodesEtablissementWithDateFin =
    periodesEtablissement.filter(hasDateFin);
  const lastPeriod = periodesEtablissementWithDateFin.find(
    ({ dateFin }) => dateFin === null,
  );
  if (!lastPeriod) return false;

  return (
    uniteLegale.etatAdministratifUniteLegale === "A" &&
    lastPeriod.etatAdministratifEtablissement === "A"
  );
};
