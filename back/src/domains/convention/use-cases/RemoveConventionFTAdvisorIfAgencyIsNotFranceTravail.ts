import { errors, type WithConventionId, withConventionIdSchema } from "shared";
import { useCaseBuilder } from "../../core/useCaseBuilder";

export type RemoveConventionFTAdvisorIfAgencyIsNotFranceTravail = ReturnType<
  typeof makeRemoveConventionFTAdvisorIfAgencyIsNotFranceTravail
>;

export const makeRemoveConventionFTAdvisorIfAgencyIsNotFranceTravail =
  useCaseBuilder("RemoveConventionFTAdvisorIfAgencyIsNotFranceTravail")
    .withInput<WithConventionId>(withConventionIdSchema)
    .withOutput<void>()
    .withCurrentUser<void>()
    .build(async ({ inputParams, uow }) => {
      const convention = await uow.conventionRepository.getById(
        inputParams.conventionId,
      );
      if (!convention)
        throw errors.convention.notFound({
          conventionId: inputParams.conventionId,
        });

      const agency = await uow.agencyRepository.getById(convention.agencyId);

      if (!agency)
        throw errors.agency.notFound({
          agencyId: convention.agencyId,
        });

      if (agency.kind !== "france-travail")
        await uow.conventionFranceTravailAdvisorRepository.deleteByConventionId(
          inputParams.conventionId,
        );
    });
