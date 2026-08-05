import { errors } from "shared";
import type { InstantiatedUseCase } from "../../../../config/bootstrap/createUseCases";
import { conventionDtosToConventionReadDtos } from "../../../../utils/convention";
import type { UnitOfWorkPerformer } from "../../../core/unit-of-work/ports/UnitOfWorkPerformer";
import { getOnlyAssessmentDto } from "../../entities/AssessmentEntity";
import type { BroadcastToFranceTravailOnConventionUpdates } from "./BroadcastToFranceTravailOnConventionUpdates";
import type {
  BroadcastConventionParams,
  WithConventionIdAndPreviousAgencyId,
} from "./broadcastConventionParams";

export type BroadcastToFranceTravailOrchestrator = ReturnType<
  typeof makeBroadcastToFranceTravailOrchestrator
>;
export const makeBroadcastToFranceTravailOrchestrator = ({
  uowPerformer,
  broadcastToFranceTravailOnConventionUpdates,
  eventType,
}: {
  uowPerformer: UnitOfWorkPerformer;
  eventType: BroadcastConventionParams["eventType"];
  broadcastToFranceTravailOnConventionUpdates: BroadcastToFranceTravailOnConventionUpdates;
}): InstantiatedUseCase<WithConventionIdAndPreviousAgencyId> => {
  return {
    useCaseName: "BroadcastToFranceTravailOrchestrator",
    execute: async (params) => {
      const convention = await uowPerformer.perform(async (uow) =>
        uow.conventionRepository.getById(params.conventionId),
      );
      if (!convention)
        throw errors.convention.notFound({ conventionId: params.conventionId });

      const { assessment, conventionRead } = await uowPerformer.perform(
        async (uow) => {
          const [conventionReadDto] = await conventionDtosToConventionReadDtos(
            [convention],
            uow,
          );
          return {
            assessment: await uow.assessmentRepository.getByConventionId(
              convention.id,
            ),
            conventionRead: conventionReadDto,
          };
        },
      );

      const assessmentDto = assessment
        ? getOnlyAssessmentDto(assessment)
        : undefined;

      if (eventType === "ASSESSMENT_CREATED") {
        if (!assessmentDto)
          throw errors.assessment.missingAssessment({
            conventionId: convention.id,
          });

        return broadcastToFranceTravailOnConventionUpdates.execute({
          eventType: "ASSESSMENT_CREATED",
          convention: conventionRead,
          assessment: assessmentDto,
        });
      }

      return broadcastToFranceTravailOnConventionUpdates.execute({
        eventType: "CONVENTION_UPDATED",
        convention: conventionRead,
        previousAgencyId: params.previousAgencyId,
        ...(assessmentDto ? { assessment: assessmentDto } : {}),
      });
    },
  };
};
