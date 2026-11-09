import {
  type AgencyRole,
  BadRequestError,
  type ConnectedUserDomainJwtPayload,
  type ConventionDto,
  clearSignaturesAndValidation,
  errors,
  ForbiddenError,
  type Role,
  renewConventionParamsSchema,
  type UserId,
} from "shared";
import type { TimeGateway } from "../../core/time-gateway/ports/TimeGateway";
import type { UnitOfWork } from "../../core/unit-of-work/ports/UnitOfWork";
import { useCaseBuilder } from "../../core/useCaseBuilder";
import { throwIfConventionArchivedAndUserIsNotAdmin } from "../entities/Convention";
import type { AddConvention } from "./AddConvention";

export type RenewConvention = ReturnType<typeof makeRenewConvention>;

export const makeRenewConvention = useCaseBuilder("RenewConvention")
  .withInput(renewConventionParamsSchema)
  .withCurrentUser<ConnectedUserDomainJwtPayload>()
  .withDeps<{
    //TODO : must use event instead of sub usecase execution
    addConvention: AddConvention;
    timeGateway: TimeGateway;
  }>()
  .build(
    async ({
      inputParams: { dateEnd, dateStart, id, renewed, schedule },
      uow,
      deps,
      currentUser,
    }) => {
      const allowedRoles: Role[] = ["validator", "counsellor", "back-office"];

      const conventionInRepo = await uow.conventionRepository.getById(
        renewed.from,
      );

      if (!conventionInRepo)
        throw errors.convention.notFound({
          conventionId: renewed.from,
        });

      const roles = await getConnectedUserRoles({
        userId: currentUser.userId,
        uow,
        convention: conventionInRepo,
      });

      if (!allowedRoles.some((allowedRole) => roles.includes(allowedRole)))
        throw new ForbiddenError(
          `The role '${roles}' is not allowed to renew convention`,
        );

      await throwIfConventionArchivedAndUserIsNotAdmin({
        convention: conventionInRepo,
        now: deps.timeGateway.now(),
        jwtPayload: currentUser,
        uow,
      });

      if (conventionInRepo.status !== "ACCEPTED_BY_VALIDATOR")
        throw new BadRequestError(
          `This convention cannot be renewed, as it has status : '${conventionInRepo.status}'`,
        );

      await deps.addConvention.execute({
        convention: {
          ...clearSignaturesAndValidation(conventionInRepo),
          id,
          dateStart,
          dateEnd,
          dateSubmission: deps.timeGateway.now().toISOString(),
          schedule,
          renewed,
          status: "READY_TO_SIGN",
        },
      });
    },
  );

const getConnectedUserRoles = async ({
  userId,
  uow,
  convention,
}: {
  userId: UserId;
  uow: UnitOfWork;
  convention: ConventionDto;
}): Promise<(Role | AgencyRole)[]> => {
  const user = await uow.userRepository.getById(userId);
  if (!user) throw errors.user.notFound({ userId });

  if (user.isBackofficeAdmin) return ["back-office"];
  const agency = await uow.agencyRepository.getById(convention.agencyId);
  if (!agency) throw errors.agency.notFound({ agencyId: convention.agencyId });

  const agencyRight = agency.usersRights[userId];

  if (!agencyRight)
    throw new ForbiddenError(
      `You don't have sufficient rights on agency '${convention.agencyId}'.`,
    );

  return agencyRight.roles;
};
