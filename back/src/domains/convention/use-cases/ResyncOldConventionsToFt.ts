import { type ConventionId, errors, executeInSequence } from "shared";
import { match } from "ts-pattern";
import { conventionDtosToConventionReadDtos } from "../../../utils/convention";
import type { TimeGateway } from "../../core/time-gateway/ports/TimeGateway";
import type { UnitOfWork } from "../../core/unit-of-work/ports/UnitOfWork";
import { useCaseBuilder } from "../../core/useCaseBuilder";
import { getOnlyAssessmentDto } from "../entities/AssessmentEntity";
import type { BroadcastToFranceTravailOnConventionUpdates } from "./broadcast/BroadcastToFranceTravailOnConventionUpdates";

type ResyncOldConventionToFtReport = {
  success: number;
  skips: Record<ConventionId, string>;
  errors: Record<ConventionId, Error>;
};

export type ResyncOldConventionsToFt = ReturnType<
  typeof makeResyncOldConventionsToFt
>;

export const makeResyncOldConventionsToFt = useCaseBuilder(
  "ResyncOldConventionsToFt",
)
  .withOutput<ResyncOldConventionToFtReport>()
  .withDeps<{
    timeGateway: TimeGateway;
    standardBroadcastToFTUsecase: BroadcastToFranceTravailOnConventionUpdates;
    limit: number;
  }>()
  .build(
    async ({
      uow,
      deps: { standardBroadcastToFTUsecase, limit, timeGateway },
    }) => {
      const report: ResyncOldConventionToFtReport = {
        errors: {},
        skips: {},
        success: 0,
      };

      const featureFlags = await uow.featureFlagQueries.getAll();
      if (!featureFlags.enableFranceTravailConventionBroadcast.isActive) {
        return report;
      }

      const conventionsToSync =
        await uow.conventionsToSyncRepository.getToProcessOrError(limit);

      await executeInSequence(conventionsToSync, (conventionToSync) =>
        handleConventionToSync({
          uow,
          conventionToSyncId: conventionToSync.id,
          report,
          timeGateway,
          standardBroadcastToFTUsecase,
        }),
      );

      return report;
    },
  );

const handleConventionToSync = async ({
  uow,
  conventionToSyncId,
  report,
  timeGateway,
  standardBroadcastToFTUsecase,
}: {
  uow: UnitOfWork;
  conventionToSyncId: ConventionId;
  report: ResyncOldConventionToFtReport;
  timeGateway: TimeGateway;
  standardBroadcastToFTUsecase: BroadcastToFranceTravailOnConventionUpdates;
}) => {
  try {
    await resync({ uow, conventionToSyncId, standardBroadcastToFTUsecase });

    const updatedConventionToSync =
      await uow.conventionsToSyncRepository.getById(conventionToSyncId);

    match(updatedConventionToSync)
      .with(undefined, () => {
        report.errors[conventionToSyncId] = new Error(
          "Convention not found or no status",
        );
      })
      .with({ status: "SUCCESS" }, () => {
        report.success += 1;
      })
      .with({ status: "TO_PROCESS" }, (toProcessConventionToSync) => {
        report.errors[toProcessConventionToSync.id] = new Error(
          "Convention still have status TO_PROCESS",
        );
      })
      .with({ status: "ERROR" }, (errorConventionToSync) => {
        report.errors[errorConventionToSync.id] = new Error(
          errorConventionToSync.reason,
        );
      })
      .with({ status: "SKIP" }, (skipConventionToSync) => {
        report.skips[skipConventionToSync.id] = skipConventionToSync.reason;
      })
      .exhaustive();
  } catch (error) {
    const anError =
      error instanceof Error
        ? error
        : new Error(`Not an Error: ${JSON.stringify(error)}`);
    await uow.conventionsToSyncRepository.save({
      id: conventionToSyncId,
      status: "ERROR",
      processDate: timeGateway.now(),
      reason: anError.message,
    });
    report.errors[conventionToSyncId] = anError;
  }
};

const resync = async ({
  uow,
  conventionToSyncId,
  standardBroadcastToFTUsecase,
}: {
  uow: UnitOfWork;
  conventionToSyncId: ConventionId;
  standardBroadcastToFTUsecase: BroadcastToFranceTravailOnConventionUpdates;
}): Promise<void> => {
  const conventionDto =
    await uow.conventionRepository.getById(conventionToSyncId);
  if (!conventionDto)
    throw errors.convention.notFound({
      conventionId: conventionToSyncId,
    });

  const assessmentEntity =
    await uow.assessmentRepository.getByConventionId(conventionToSyncId);

  const assessment = assessmentEntity
    ? getOnlyAssessmentDto(assessmentEntity)
    : undefined;
  const [convention] = await conventionDtosToConventionReadDtos(
    [conventionDto],
    uow,
  );

  return assessment
    ? standardBroadcastToFTUsecase.execute({
        eventType: "ASSESSMENT_CREATED",
        convention,
        assessment,
      })
    : standardBroadcastToFTUsecase.execute({
        eventType: "CONVENTION_UPDATED",
        convention,
      });
};
