import {
  type ApiConsumer,
  type ConventionDomainJwtPayload,
  type ConventionReadDto,
  type ConventionRelatedJwtPayload,
  errors,
  getConventionManageAllowedRoles,
  type UserId,
  withConventionIdSchema,
} from "shared";
import { conventionDtosToConventionReadDtos } from "../../../utils/convention";
import { isHashMatchConventionEmails } from "../../../utils/emailHash";
import { getUserWithRights } from "../../connected-users/helpers/userRights.helper";
import type { TimeGateway } from "../../core/time-gateway/ports/TimeGateway";
import type { UnitOfWork } from "../../core/unit-of-work/ports/UnitOfWork";
import { useCaseBuilder } from "../../core/useCaseBuilder";
import {
  isConventionInScope,
  throwErrorOnConventionIdMismatch,
  throwIfConventionArchivedAndUserIsNotAdmin,
} from "../entities/Convention";

export type GetConvention = ReturnType<typeof makeGetConvention>;

export const makeGetConvention = useCaseBuilder("GetConvention")
  .withInput(withConventionIdSchema)
  .withOutput<ConventionReadDto>()
  .withCurrentUser<ConventionRelatedJwtPayload | ApiConsumer>()
  .withDeps<{ timeGateway: TimeGateway }>()
  .build(
    async ({
      inputParams: { conventionId },
      uow,
      currentUser: jwtPayload,
      deps,
    }) => {
      const conventionDto =
        await uow.conventionRepository.getById(conventionId);
      if (!conventionDto) throw errors.convention.notFound({ conventionId });

      const [convention] = await conventionDtosToConventionReadDtos(
        [conventionDto],
        uow,
      );

      const authorizedConvention = await getAuthorizedConvention({
        jwtPayload,
        convention,
        uow,
      });

      await throwIfConventionArchivedAndUserIsNotAdmin({
        convention: authorizedConvention,
        now: deps.timeGateway.now(),
        jwtPayload,
        uow,
      });

      return authorizedConvention;
    },
  );

const getAuthorizedConvention = async ({
  jwtPayload,
  convention,
  uow,
}: {
  jwtPayload: ConventionRelatedJwtPayload | ApiConsumer;
  convention: ConventionReadDto;
  uow: UnitOfWork;
}): Promise<ConventionReadDto> => {
  if ("id" in jwtPayload) return onApiConsumer(jwtPayload, convention);
  if ("emailHash" in jwtPayload)
    return isConventionDomainPayloadHasRight({
      jwtPayload,
      convention,
    });
  return onConnectedUserPayload({
    userId: jwtPayload.userId,
    uow,
    convention,
  });
};

const onApiConsumer = async (
  currentUser: ApiConsumer,
  convention: ConventionReadDto,
): Promise<ConventionReadDto> => {
  if (isConventionInScope(convention, currentUser)) return convention;
  throw errors.convention.forbiddenMissingRightsApiConsumer(
    convention.id,
    currentUser.id,
  );
};

const onConnectedUserPayload = async ({
  userId,
  convention,
  uow,
}: {
  userId: UserId;
  convention: ConventionReadDto;
  uow: UnitOfWork;
}): Promise<ConventionReadDto> => {
  const user = await getUserWithRights(uow, userId);

  const roles = getConventionManageAllowedRoles(convention, user);
  if (roles.length) return convention;

  const establishment =
    await uow.establishmentAggregateRepository.getEstablishmentAggregateBySiret(
      convention.siret,
    );

  const hasSomeEstablishmentRights = establishment?.userRights.some(
    (userRight) =>
      userRight.userId === user.id && userRight.status === "ACCEPTED",
  );

  if (hasSomeEstablishmentRights) return convention;

  throw errors.convention.forbiddenMissingRightsUserId({
    conventionId: convention.id,
    userId: user.id,
  });
};

const isConventionDomainPayloadHasRight = ({
  jwtPayload,
  convention,
}: {
  jwtPayload: ConventionDomainJwtPayload;
  convention: ConventionReadDto;
}): ConventionReadDto => {
  throwErrorOnConventionIdMismatch({
    jwtPayload,
    requestedConventionId: convention.id,
  });

  if (
    isHashMatchConventionEmails({
      role: jwtPayload.role,
      emailHash: jwtPayload.emailHash,
      convention,
    })
  )
    return convention;

  throw errors.convention.forbiddenMissingRightsEmailHash({
    conventionId: convention.id,
    emailHash: jwtPayload.emailHash,
    role: jwtPayload.role,
  });
};
