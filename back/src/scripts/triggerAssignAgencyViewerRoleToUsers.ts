import "./instrumentSentryCron";
import type { UserId } from "shared";
import { AppConfig } from "../config/bootstrap/appConfig";
import { createMakeProductionPgPool } from "../config/pg/pgPool";
import { makeAssignAgencyViewerRole } from "../domains/agency/use-cases/AssignAgencyViewerRoleToUsers";
import { createDbRelatedSystems } from "../domains/core/unit-of-work/adapters/createDbRelatedSystems";
import { createLogger } from "../utils/logger";
import { handleCRONScript } from "./handleCRONScript";

const logger = createLogger(__filename);
const config = AppConfig.createFromEnv();

const TARGET_USER_IDS: UserId[] =
  config.ftUserIdsAssociatedToAllFtAgencies &&
  config.ftUserIdsAssociatedToAllFtAgencies.trim().length > 0
    ? config.ftUserIdsAssociatedToAllFtAgencies
        .split(",")
        .map((id) => id.trim())
        .filter((id) => id.length > 0)
    : [];

const TARGET_AGENCY_KINDS: (
  | "france-travail"
  | "cap-emploi"
  | "conseil-departemental"
)[] = ["france-travail", "cap-emploi", "conseil-departemental"];

const executeAssignAgencyViewerRole = async () => {
  if (TARGET_USER_IDS.length === 0) {
    logger.warn({
      message:
        "No user IDs configured. Set FT_USER_IDS_ASSOCIATED_TO_ALL_FT_AGENCIES environment variable.",
    });
    return {
      agenciesSuccessfullyUpdated: 0,
      agencyUpdatesFailed: 0,
      agenciesSkipped: 0,
    };
  }

  logger.info({
    message: "Starting agency viewer role assignment on FT users script",
  });

  const { uowPerformer } = createDbRelatedSystems(
    config,
    createMakeProductionPgPool(config),
  );

  const assignAgencyViewerRoleUseCase = makeAssignAgencyViewerRole({
    uowPerformer,
  });

  return assignAgencyViewerRoleUseCase.execute({
    userIds: TARGET_USER_IDS,
    agencyKinds: TARGET_AGENCY_KINDS,
  });
};

handleCRONScript({
  name: "assignAgencyViewerRoleToFTUsers",
  config,
  script: executeAssignAgencyViewerRole,
  handleResults: ({
    agenciesSuccessfullyUpdated,
    agencyUpdatesFailed,
    agenciesSkipped,
  }) => {
    return [
      `Agencies successfully updated: ${agenciesSuccessfullyUpdated}`,
      `Agencies failed to update: ${agencyUpdatesFailed}`,
      `Agencies skipped: ${agenciesSkipped}`,
      "",
      `Total agencies processed: ${agenciesSuccessfullyUpdated + agencyUpdatesFailed + agenciesSkipped}`,
    ].join("\n");
  },
  logger,
});
