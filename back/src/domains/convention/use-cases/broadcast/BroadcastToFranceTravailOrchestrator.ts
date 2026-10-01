import { errors } from "shared";
import type { InstantiatedUseCase } from "../../../../config/bootstrap/createUseCases";
import { conventionDtosToConventionReadDtos } from "../../../../utils/convention";
import type { UnitOfWorkPerformer } from "../../../core/unit-of-work/ports/UnitOfWorkPerformer";
import { getOnlyAssessmentDto } from "../../entities/AssessmentEntity";
import type { BroadcastToFranceTravailOnConventionUpdates } from "./BroadcastToFranceTravailOnConventionUpdates";
import type { WithConventionIdAndPreviousAgencyId } from "./broadcastConventionParams";

export type BroadcastToFranceTravailOrchestrator = ReturnType<
  typeof makeBroadcastToFranceTravailOrchestrator
>;
export const makeBroadcastToFranceTravailOrchestrator = ({
  uowPerformer,
  broadcastToFranceTravailOnConventionUpdates,
}: {
  uowPerformer: UnitOfWorkPerformer;
  broadcastToFranceTravailOnConventionUpdates: BroadcastToFranceTravailOnConventionUpdates;
}): InstantiatedUseCase<WithConventionIdAndPreviousAgencyId> => ({
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

    return broadcastToFranceTravailOnConventionUpdates.execute({
      convention: conventionRead,
      ...(params.previousAgencyId
        ? { previousAgencyId: params.previousAgencyId }
        : {}),
      ...(assessmentDto ? { assessment: assessmentDto } : {}),
    });
  },
});
