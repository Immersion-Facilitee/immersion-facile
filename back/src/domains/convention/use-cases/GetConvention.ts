import {
  type AgencyWithUsersRights,
  type ApiConsumer,
  type ConventionDomainJwtPayload,
  type ConventionDto,
  type ConventionReadDto,
  type ConventionRelatedJwtPayload,
  errors,
  getConventionManageAllowedRoles,
  type UserId,
  withConventionIdSchema,
} from "shared";
import { agencyWithRightToAgencyDto } from "../../../utils/agency";
import { conventionDtosToConventionReadDtos } from "../../../utils/convention";
import {
  isHashMatchConventionEmails,
  isHashMatchNotNotifiedCounsellorOrValidator,
  isHashMatchPeAdvisorEmail,
} from "../../../utils/emailHash";
import { getUserWithRights } from "../../connected-users/helpers/userRights.helper";
import type { TimeGateway } from "../../core/time-gateway/ports/TimeGateway";
import type { UnitOfWork } from "../../core/unit-of-work/ports/UnitOfWork";
import { useCaseBuilder } from "../../core/useCaseBuilder";
import {
  isConventionInScope,
  throwErrorOnConventionIdMismatch,
  throwIfConventionArchivedForNonAdmin,
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

      const { authorizedConvention, isBackofficeAdmin } =
        "id" in jwtPayload
          ? {
              authorizedConvention: await onApiConsumer(jwtPayload, convention),
              isBackofficeAdmin: false,
            }
          : "emailHash" in jwtPayload
            ? {
                authorizedConvention: await isConventionDomainPayloadHasRight({
                  jwtPayload,
                  uow,
                  convention,
                }),
                isBackofficeAdmin: false,
              }
            : await onConnectedUserPayload({
                userId: jwtPayload.userId,
                uow,
                convention,
              });

      throwIfConventionArchivedForNonAdmin({
        convention: authorizedConvention,
        now: deps.timeGateway.now(),
        isBackofficeAdmin,
        featureFlags: await uow.featureFlagQueries.getAll(),
      });

      return authorizedConvention;
    },
  );

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
}): Promise<{
  authorizedConvention: ConventionReadDto;
  isBackofficeAdmin: boolean;
}> => {
  const user = await getUserWithRights(uow, userId);
  const isBackofficeAdmin = !!user.isBackofficeAdmin;

  const roles = getConventionManageAllowedRoles(convention, user);
  if (roles.length)
    return { authorizedConvention: convention, isBackofficeAdmin };

  const establishment =
    await uow.establishmentAggregateRepository.getEstablishmentAggregateBySiret(
      convention.siret,
    );

  const hasSomeEstablishmentRights = establishment?.userRights.some(
    (userRight) =>
      userRight.userId === user.id && userRight.status === "ACCEPTED",
  );

  if (hasSomeEstablishmentRights)
    return { authorizedConvention: convention, isBackofficeAdmin };

  throw errors.convention.forbiddenMissingRightsUserId({
    conventionId: convention.id,
    userId: user.id,
  });
};

const isConventionDomainPayloadHasRight = async ({
  jwtPayload,
  convention,
  uow,
}: {
  jwtPayload: ConventionDomainJwtPayload;
  convention: ConventionReadDto;
  uow: UnitOfWork;
}): Promise<ConventionReadDto> => {
  throwErrorOnConventionIdMismatch({
    jwtPayload,
    requestedConventionId: convention.id,
  });

  const agency = await uow.agencyRepository.getById(convention.agencyId);
  if (!agency) throw errors.agency.notFound({ agencyId: convention.agencyId });

  const isUserHasRight = await isEmailHashMatch({
    payload: jwtPayload,
    convention,
    agencyWithUserRights: agency,
    uow,
  });

  if (isUserHasRight) return convention;
  throw errors.convention.forbiddenMissingRightsEmailHash({
    conventionId: convention.id,
    emailHash: jwtPayload.emailHash,
    role: jwtPayload.role,
  });
};

const isEmailHashMatch = async ({
  payload: { emailHash, role },
  convention,
  agencyWithUserRights,
  uow,
}: {
  payload: ConventionDomainJwtPayload;
  convention: ConventionDto;
  agencyWithUserRights: AgencyWithUsersRights;
  uow: UnitOfWork;
}): Promise<boolean> => {
  if (
    isHashMatchConventionEmails({
      role,
      emailHash,
      convention,
      agency: await agencyWithRightToAgencyDto(uow, agencyWithUserRights),
    })
  )
    return true;

  if (
    isHashMatchPeAdvisorEmail({
      beneficiary: convention.signatories.beneficiary,
      emailHash,
    })
  )
    return true;

  return await isHashMatchNotNotifiedCounsellorOrValidator({
    uow,
    emailHash,
    agency: agencyWithUserRights,
  });
};
