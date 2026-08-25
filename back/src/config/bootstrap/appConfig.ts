import * as dotenv from "dotenv";
import { trim } from "ramda";
import {
  type AbsoluteUrl,
  authRoutes,
  environments,
  filterNotFalsy,
  ftConnect,
  loginByEmailLinkDurationInMinutes,
  makeGetBooleanVariable,
  makeThrowIfNotAbsoluteUrl,
  makeThrowIfNotDefinedOrDefault,
  makeThrowIfNotInArray,
  makeThrowIfNotOpenCageGeosearchKey,
  type ProcessEnv,
} from "shared";
import { ftConnectNeededScopesForAllUsedApi } from "../../domains/core/authentication/ft-connect/adapters/ft-connect-gateway/ftConnectApi.routes";
import type { MetabaseConfig } from "../../domains/core/dashboard/adapters/MetabaseDashboardGateway";
import type { EmailableApiKey } from "../../domains/core/email-validation/adapters/EmailableEmailValidationGateway.dto";
import type { DomainTopic } from "../../domains/core/events/events";
import type { S3Params } from "../../domains/core/file-storage/adapters/S3DocumentGateway";
import type { CrispConfig } from "../../domains/core/support/adapters/HttpCrispGateway";

export type FTAccessTokenConfig = {
  immersionFacileBaseUrl: AbsoluteUrl;
  ftApiUrl: AbsoluteUrl;
  ftAuthCandidatUrl: AbsoluteUrl;
  ftEnterpriseUrl: AbsoluteUrl;
  clientId: string;
  clientSecret: string;
};

export type InseeAccessTokenConfig = {
  clientId: string;
  clientSecret: string;
  username: string;
  password: string;
};

export type AccessTokenResponse = {
  access_token: string;
  expires_in: number;
  scope: string;
  token_type: string;
};

export type OAuthConfig = {
  clientId: string;
  clientSecret: string;
  immersionRedirectUri: {
    afterLogin: AbsoluteUrl;
    afterLogout: AbsoluteUrl;
  };
  providerBaseUri: AbsoluteUrl;
  scope: string;
};

// See "Working with AppConfig" in back/README.md for more details.

export class AppConfig {
  readonly #getBooleanVariable;

  readonly #throwIfNotAbsoluteUrl;

  readonly #throwIfNotDefinedOrDefault;

  readonly #throwIfNotGeosearchApiKey;

  readonly #throwIfNotInArray;

  private constructor(private readonly env: ProcessEnv) {
    this.#throwIfNotInArray = makeThrowIfNotInArray(env);
    this.#throwIfNotDefinedOrDefault = makeThrowIfNotDefinedOrDefault(env);
    this.#throwIfNotAbsoluteUrl = makeThrowIfNotAbsoluteUrl(env);
    this.#getBooleanVariable = makeGetBooleanVariable(env);
    this.#throwIfNotGeosearchApiKey = makeThrowIfNotOpenCageGeosearchKey(env);
  }

  // https://opencagedata.com/
  public get apiAddress() {
    return this.#throwIfNotInArray({
      variableName: "ADDRESS_API_GATEWAY",
      authorizedValues: ["IN_MEMORY", "OPEN_CAGE_DATA"],
    });
  }

  public get apiConsumerNamesUsingRomeV3(): string[] {
    return parseStringList(
      this.#throwIfNotDefinedOrDefault("API_CONSUMER_NAMES_USING_ROME_V3", ""),
    );
  }

  public get appellationsGateway() {
    return this.#throwIfNotInArray({
      variableName: "APPELLATIONS_GATEWAY",
      authorizedValues: ["IN_MEMORY", "DIAGORIENTE"],
      defaultValue: "IN_MEMORY",
    });
  }

  // https://adresse.data.gouv.fr/
  public get apiJwtPrivateKey() {
    return this.#throwIfNotDefinedOrDefault("API_JWT_PRIVATE_KEY");
  }

  // == Address Api gateway choice between 2 providers ==
  public get apiJwtPublicKey() {
    return this.#throwIfNotDefinedOrDefault("API_JWT_PUBLIC_KEY");
  }

  // == Notification gateway provider api keys ==
  public get apiKeyBrevo() {
    return this.#throwIfNotDefinedOrDefault("BREVO_API_KEY");
  }

  public get ftConnectMaxRequestsPerInterval(): number {
    return Number.parseInt(
      this.#throwIfNotDefinedOrDefault(
        "FT_CONNECT_MAX_REQUESTS_PER_INTERVAL",
        "1",
      ),
      10,
    );
  }

  public get brevoEstablishmentContactListId(): number {
    return Number.parseInt(
      this.#throwIfNotDefinedOrDefault("BREVO_ESTABLISHMENT_CONTACT_LIST_ID"),
    );
  }

  public get establishmentMarketingGateway() {
    return this.#throwIfNotInArray({
      variableName: "ESTABLISHMENT_MARKETING_GATEWAY",
      authorizedValues: ["IN_MEMORY", "BREVO"],
    });
  }

  public get apiKeyOpenCageDataGeocoding() {
    return this.#throwIfNotDefinedOrDefault("API_KEY_OPEN_CAGE_DATA_GEOCODING");
  }

  public get apiKeyOpenCageDataGeosearch() {
    return this.#throwIfNotGeosearchApiKey("API_KEY_OPEN_CAGE_DATA_GEOSEARCH");
  }

  public get cache() {
    return this.#throwIfNotInArray({
      variableName: "CACHE",
      authorizedValues: ["REDIS", "NONE"],
      defaultValue: "NONE",
    });
  }

  public get corsAllowedOrigins(): string[] {
    return parseStringList(
      this.#throwIfNotDefinedOrDefault("CORS_ALLOWED_ORIGINS"),
    );
  }

  public get redisUrl() {
    return this.#throwIfNotDefinedOrDefault("REDIS_URL");
  }

  public get cellarS3Params(): S3Params {
    return this.documentGateway === "S3"
      ? {
          endPoint: this.#throwIfNotDefinedOrDefault("CELLAR_ADDON_HOST"),
          accessKeyId: this.#throwIfNotDefinedOrDefault("CELLAR_ADDON_KEY_ID"),
          secretAccessKey: this.#throwIfNotDefinedOrDefault(
            "CELLAR_ADDON_KEY_SECRET",
          ),
          bucketName: this.#throwIfNotDefinedOrDefault("CELLAR_BUCKET"),
        }
      : {
          endPoint: "NOT S3 Gateway",
          accessKeyId: "NOT S3 Gateway",
          secretAccessKey: "NOT S3 Gateway",
          bucketName: "NOT S3 Gateway",
        };
  }

  // Visible for testing.
  public get configParams() {
    return this.env;
  }

  // == Sirene repository ==
  public static createFromEnv(
    readDotEnv = true,
    configParams = process.env,
  ): AppConfig {
    if (readDotEnv) dotenv.config({ path: `${__dirname}/../../../.env` });
    return new AppConfig(configParams);
  }

  // == Metabase
  public get dashboard() {
    return this.#throwIfNotInArray({
      variableName: "DASHBOARD_GATEWAY",
      authorizedValues: ["METABASE", "NONE"],
      defaultValue: "NONE",
    });
  }

  // == Discord notifications ==
  public get discordWebhookUrl(): string | undefined {
    return this.env.DISCORD_WEBHOOK_URL;
  }

  public get slackBotToken(): string | undefined {
    return this.env.SLACK_BOT_TOKEN;
  }

  public get documentGateway() {
    return this.#throwIfNotInArray({
      authorizedValues: ["IN_MEMORY", "S3"],
      variableName: "DOCUMENT_GATEWAY",
      defaultValue: "IN_MEMORY",
    });
  }

  // == Email gateway provider api keys ==
  public get emailableApiKey(): EmailableApiKey {
    return this.#throwIfNotDefinedOrDefault("EMAILABLE_API_KEY");
  }

  public get diagorienteApiClientId(): EmailableApiKey {
    return this.#throwIfNotDefinedOrDefault("DIAGORIENTE_API_CLIENT_ID");
  }

  public get diagorienteApiClientSecret(): EmailableApiKey {
    return this.#throwIfNotDefinedOrDefault("DIAGORIENTE_API_CLIENT_SECRET");
  }

  // == Email notifications ==
  public get emailAllowList() {
    return parseStringList(this.env.EMAIL_ALLOW_LIST);
  }

  // == Email validation gateway ==
  public get emailValidationGateway() {
    return this.#throwIfNotInArray({
      variableName: "EMAIL_VALIDATION_GATEWAY",
      authorizedValues: ["IN_MEMORY", "EMAILABLE"],
      defaultValue: "IN_MEMORY",
    });
  }

  public get envType() {
    return this.#throwIfNotInArray({
      variableName: "ENV_TYPE",
      authorizedValues: [...environments],
      defaultValue: "local",
    });
  }

  // == Event Bus ==
  public get eventCrawlerPeriodMs() {
    return parseInteger(this.env.EVENT_CRAWLER_PERIOD_MS, 0);
  }

  public get externalAxiosTimeout(): number {
    return Number.parseInt(
      this.#throwIfNotDefinedOrDefault("EXTERNAL_AXIOS_TIMEOUT", "10000"),
    );
  }

  public get externalAxiosTimeoutForFranceTravail(): number {
    return Number.parseInt(
      this.#throwIfNotDefinedOrDefault(
        "EXTERNAL_AXIOS_TIMEOUT_FOR_FRANCE_TRAVAIL",
        "10000",
      ),
    );
  }

  // == Magic links ==
  public get immersionFacileBaseUrl(): AbsoluteUrl {
    return this.immersionFacileDomain.includes("localhost")
      ? `http://${this.immersionFacileDomain}`
      : `https://${this.immersionFacileDomain}`;
  }

  public get conventionJwt1MonthDurationInDays(): number {
    return 31; // 1 month
  }

  public get conventionJwtTwoDaysDuration(): number {
    return 2; // 2 days
  }

  public get connectedUserJwtDurationInHours(): number {
    return 12; // 12 hours
  }

  public get emailAuthCodeJwtDurationInMinutes(): number {
    return loginByEmailLinkDurationInMinutes; // 15 minutes
  }

  public get immersionFacileDomain(): string {
    return this.#throwIfNotDefinedOrDefault("DOMAIN");
  }

  public get inboundEmailAllowedIps() {
    return parseStringList(
      this.#throwIfNotDefinedOrDefault("INBOUND_EMAIL_ALLOWED_IPS"),
    );
  }

  public get proConnectConfig(): OAuthConfig {
    return {
      clientId: this.#throwIfNotDefinedOrDefault(
        "PRO_CONNECT_CLIENT_ID",
        this.proConnectGateway !== "HTTPS" ? "fake id" : undefined,
      ),
      clientSecret: this.#throwIfNotDefinedOrDefault(
        "PRO_CONNECT_CLIENT_SECRET",
        this.proConnectGateway !== "HTTPS" ? "fake secret" : undefined,
      ),
      immersionRedirectUri: {
        afterLogin: `${this.immersionFacileBaseUrl}/api${authRoutes.afterEmailOrProConnectOAuthLogin.url}`,
        afterLogout: this.immersionFacileBaseUrl,
      },
      providerBaseUri: this.#throwIfNotAbsoluteUrl(
        "PRO_CONNECT_BASE_URI",
        this.proConnectGateway !== "HTTPS"
          ? "https://fake-pro-connect.url"
          : undefined,
      ),
      scope: "openid given_name usual_name email custom siret",
    };
  }

  public get ftConnectConfig(): OAuthConfig {
    const clientId =
      this.ftConnectGateway === "HTTPS"
        ? this.franceTravailClientId
        : "fake id";

    return {
      clientId: clientId,
      clientSecret:
        this.ftConnectGateway === "HTTPS"
          ? this.franceTravailClientSecret
          : "fake secret",
      immersionRedirectUri: {
        afterLogin: `${this.immersionFacileBaseUrl}/api/${ftConnect}`,
        afterLogout: this.immersionFacileBaseUrl,
      },
      providerBaseUri:
        this.ftConnectGateway === "HTTPS"
          ? this.ftAuthCandidatUrl
          : "https://fake-ft-connect-url.com",
      scope: ftConnectNeededScopesForAllUsedApi(clientId),
    };
  }

  public get proConnectGateway() {
    return this.#throwIfNotInArray({
      variableName: "PRO_CONNECT_GATEWAY",
      authorizedValues: ["IN_MEMORY", "HTTPS"],
      defaultValue: "IN_MEMORY",
    });
  }

  public get inseeHttpConfig(): InseeAccessTokenConfig {
    return {
      clientId: this.#throwIfNotDefinedOrDefault("SIRENE_INSEE_CLIENT_ID"),
      clientSecret: this.#throwIfNotDefinedOrDefault(
        "SIRENE_INSEE_CLIENT_SECRET",
      ),
      username: this.#throwIfNotDefinedOrDefault("SIRENE_INSEE_USERNAME"),
      password: this.#throwIfNotDefinedOrDefault("SIRENE_INSEE_PASSWORD"),
    };
  }

  public get jwtPrivateKey() {
    return this.#throwIfNotDefinedOrDefault("JWT_PRIVATE_KEY");
  }

  public get jwtPublicKey() {
    return this.#throwIfNotDefinedOrDefault("JWT_PUBLIC_KEY");
  }

  public get laBonneBoiteGateway() {
    return this.#throwIfNotInArray({
      variableName: "LA_BONNE_BOITE_GATEWAY",
      authorizedValues: ["IN_MEMORY", "HTTPS"],
    });
  }

  public get maxApiConsumerCallsPerSecond() {
    return parseInteger(this.env.MAX_API_CONSUMER_CALLS_PER_SECOND, 5);
  }

  public get backfillBroadcastFeedbackMaxBatchesPerPhase(): number | undefined {
    return parseOptionalPositiveInteger(
      this.env.BACKFILL_MAX_BATCHES_PER_PHASE,
      "BACKFILL_MAX_BATCHES_PER_PHASE",
    );
  }

  public get maxConventionsToSyncWithPe() {
    return Number.parseInt(
      this.#throwIfNotDefinedOrDefault("MAX_CONVENTIONS_TO_SYNC_WITH_PE", "50"),
    );
  }

  public get metabase(): MetabaseConfig {
    return {
      v1: {
        url: this.#throwIfNotDefinedOrDefault("METABASE_URL") as AbsoluteUrl,
        apiKey: this.#throwIfNotDefinedOrDefault("METABASE_API_KEY"),
      },
      v2: {
        url: this.#throwIfNotDefinedOrDefault(
          "METABASE_V2_URL",
          "http://missing-metabase-v2-url.com",
        ) as AbsoluteUrl,
        apiKey: this.#throwIfNotDefinedOrDefault(
          "METABASE_V2_API_KEY",
          "MISSING_METABASE_V2_API_KEY",
        ),
      },
    };
  }

  public get minimumNumberOfDaysBetweenSimilarContactRequests(): number {
    return Number.parseInt(
      this.#throwIfNotDefinedOrDefault(
        "MINIMUM_NUMBER_OF_DAYS_BETWEEN_SIMILAR_CONTACT_REQUESTS",
        "7",
      ),
    );
  }

  public get nodeEnv() {
    return this.#throwIfNotInArray({
      variableName: "NODE_ENV",
      authorizedValues: ["test", "local", "production"],
    });
  }

  public get nodeProcessReportInterval(): number {
    return Number.parseInt(
      this.#throwIfNotDefinedOrDefault("NODE_PROCESS_REPORT_INTERVAL", "30000"),
    );
  }

  // == Notification gateway ==
  public get notificationGateway() {
    return this.#throwIfNotInArray({
      variableName: "NOTIFICATION_GATEWAY",
      authorizedValues: ["IN_MEMORY", "BREVO"],
    });
  }

  public get passEmploiGateway() {
    return this.#throwIfNotInArray({
      variableName: "PASS_EMPLOI_GATEWAY",
      authorizedValues: ["IN_MEMORY", "HTTPS"],
    });
  }

  public get passEmploiKey() {
    return this.#throwIfNotDefinedOrDefault("PASS_EMPLOI_KEY");
  }

  public get passEmploiUrl() {
    return this.#throwIfNotDefinedOrDefault("PASS_EMPLOI_URL");
  }

  public get pdfGenerator() {
    return {
      baseUrl: this.#throwIfNotAbsoluteUrl("PDF_GENERATOR_BASE_URL"),
      apiKey: this.#throwIfNotDefinedOrDefault("PDF_GENERATOR_API_KEY"),
    };
  }

  public get pdfGeneratorGateway() {
    return this.#throwIfNotInArray({
      variableName: "PDF_GENERATOR_GATEWAY",
      authorizedValues: ["IN_MEMORY", "SCALINGO"],
    });
  }

  public get ftApiUrl(): AbsoluteUrl {
    return this.#throwIfNotAbsoluteUrl("POLE_EMPLOI_API_URL");
  }

  public get ftAuthCandidatUrl(): AbsoluteUrl {
    return this.#throwIfNotAbsoluteUrl(
      "POLE_EMPLOI_AUTHENTIFICATION_CANDIDAT_URL",
    );
  }

  // == France Travail Connect gateway ==
  public get ftConnectGateway() {
    return this.#throwIfNotInArray({
      variableName: "PE_CONNECT_GATEWAY",
      authorizedValues: ["IN_MEMORY", "HTTPS"],
      defaultValue: "IN_MEMORY",
    });
  }

  public get ftEnterpriseUrl(): AbsoluteUrl {
    return this.#throwIfNotAbsoluteUrl("POLE_EMPLOI_ENTREPRISE_URL");
  }

  public get pgImmersionDbUrl() {
    return this.#throwIfNotDefinedOrDefault("DATABASE_URL");
  }

  public get pgTransactionIdleTimeoutMs() {
    return Number.parseInt(
      this.#throwIfNotDefinedOrDefault("PG_TRANSACTION_IDLE_TIMEOUT_MS", "0"),
    );
  }

  public get franceTravailAccessTokenConfig(): FTAccessTokenConfig {
    return {
      immersionFacileBaseUrl: this.immersionFacileBaseUrl,
      ftApiUrl: this.ftApiUrl,
      ftAuthCandidatUrl: this.ftAuthCandidatUrl,
      ftEnterpriseUrl: this.ftEnterpriseUrl,
      clientId: this.franceTravailClientId,
      clientSecret: this.franceTravailClientSecret,
    };
  }

  public get franceTravailClientId() {
    return this.#throwIfNotDefinedOrDefault("POLE_EMPLOI_CLIENT_ID");
  }

  public get franceTravailClientSecret() {
    return this.#throwIfNotDefinedOrDefault("POLE_EMPLOI_CLIENT_SECRET");
  }

  public get franceTravailGateway() {
    return this.#throwIfNotInArray({
      variableName: "POLE_EMPLOI_GATEWAY",
      authorizedValues: ["IN_MEMORY", "HTTPS"],
    });
  }

  public get previousJwtPublicKey() {
    return this.env.JWT_PREVIOUS_PUBLIC_KEY;
  }

  public get quarantinedTopics(): DomainTopic[] {
    return parseStringList(this.env.QUARANTINED_TOPICS).filter(
      filterNotFalsy,
    ) as DomainTopic[];
  }

  // == Data repositories ==
  public get repositories() {
    return this.#throwIfNotInArray({
      variableName: "REPOSITORIES",
      authorizedValues: ["IN_MEMORY", "PG"],
      defaultValue: "IN_MEMORY",
    });
  }

  // == Rome gateway ==
  public get romeRepository() {
    return this.#throwIfNotInArray({
      variableName: "ROME_GATEWAY",
      authorizedValues: ["IN_MEMORY", "PG"],
      defaultValue: "IN_MEMORY",
    });
  }

  public get shortLinkIdGeneratorGateway() {
    return this.#throwIfNotInArray({
      variableName: "SHORT_LINK_ID_GENERATOR_GATEWAY",
      authorizedValues: ["NANO_ID", "DETERMINIST"],
    });
  }

  public get siretGateway() {
    return this.#throwIfNotInArray({
      variableName: "SIRENE_REPOSITORY",
      authorizedValues: [
        "IN_MEMORY",
        "HTTPS", // Deprecated, use Insee instead
        "INSEE",
        "ANNUAIRE_DES_ENTREPRISES",
      ],
      defaultValue: "IN_MEMORY",
    });
  }

  public get skipEmailAllowlist() {
    return this.#getBooleanVariable("SKIP_EMAIL_ALLOW_LIST");
  }

  public get subscribersGateway() {
    return this.#throwIfNotInArray({
      variableName: "SUBSCRIBERS_GATEWAY",
      authorizedValues: ["IN_MEMORY", "HTTPS"],
      defaultValue: "IN_MEMORY",
    });
  }

  public get crispGatewayKind() {
    return this.#throwIfNotInArray({
      variableName: "CRISP_GATEWAY",
      authorizedValues: ["HTTP", "IN_MEMORY", "LOG_ONLY"],
      defaultValue: "LOG_ONLY",
    });
  }

  public get crispConfig(): CrispConfig {
    return {
      id: this.#throwIfNotDefinedOrDefault("CRISP_ID"),
      key: this.#throwIfNotDefinedOrDefault("CRISP_KEY"),
      websiteId: this.#throwIfNotDefinedOrDefault("CRISP_WEBSITE_ID"),
    };
  }

  public get tallySignatureSecret() {
    return this.#throwIfNotDefinedOrDefault("TALLY_SIGNATURE_SECRET");
  }

  public get timeGateway() {
    return this.#throwIfNotInArray({
      variableName: "TIME_GATEWAY",
      authorizedValues: ["CUSTOM", "REAL"],
      defaultValue: "REAL",
    });
  }

  public get updateEstablishmentFromInseeConfig() {
    return {
      maxEstablishmentsPerBatch: Number.parseInt(
        this.#throwIfNotDefinedOrDefault(
          "MAX_ESTABLISHMENTS_PER_BATCH",
          "1000",
        ),
      ),
      maxEstablishmentsPerFullRun: Number.parseInt(
        this.#throwIfNotDefinedOrDefault(
          "MAX_ESTABLISHMENTS_PER_FULL_RUN",
          "5000",
        ),
      ),
      numberOfDaysAgoToCheckForInseeUpdates: Number.parseInt(
        this.#throwIfNotDefinedOrDefault(
          "NUMBER_OF_DAYS_AGO_TO_CHECK_FOR_INSEE_UPDATES",
          "30",
        ),
      ),
      numberOfDaysToRetrieveInseeUpdates: Number.parseInt(
        this.#throwIfNotDefinedOrDefault(
          "NUMBER_OF_DAYS_TO_RETRIEVE_INSEE_UPDATES",
          "120",
        ),
      ),
    };
  }

  public get ftUserIdsAssociatedToAllFtAgencies() {
    return this.#throwIfNotDefinedOrDefault(
      "FT_USER_IDS_ASSOCIATED_TO_ALL_FT_AGENCIES",
      "",
    );
  }
}

// Parsers

const parseInteger = (str: string | undefined, defaultValue: number): number =>
  str ? Number.parseInt(str) : defaultValue;

const parseOptionalPositiveInteger = (
  str: string | undefined,
  variableName: string,
): number | undefined => {
  if (!str) return undefined;
  const parsed = Number(str);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed <= 0)
    throw new Error(
      `Invalid ${variableName}=${str} (expected a positive integer)`,
    );
  return parsed;
};

// Format: <string>,<string>,...
const parseStringList = (str: string | undefined, separator = ","): string[] =>
  (str || "").split(separator).map(trim).filter(filterNotFalsy);

// Email allow list from env variable
export const makeEmailAllowListPredicate = ({
  skipEmailAllowList,
  emailAllowList,
}: {
  skipEmailAllowList: boolean;
  emailAllowList: string[];
}): ((recipient: string) => boolean) =>
  skipEmailAllowList
    ? (_recipient: string) => true
    : (recipient: string): boolean => emailAllowList.includes(recipient);
