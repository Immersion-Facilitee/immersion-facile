import {
  allModifierRoles,
  type ConnectedUserDomainJwtPayload,
  type ConventionDomainJwtPayload,
  type ConventionDto,
  type ConventionStatus,
  errors,
  isSignatoryRole,
  type Signatories,
  statusTransitionConfigs,
  updateConventionRequestSchema,
  type WithConventionIdLegacy,
} from "shared";
import { throwErrorIfConventionStatusNotAllowed } from "../../../utils/convention";
import { throwIfNotAuthorizedForRole } from "../../connected-users/helpers/authorization.helper";
import type { TriggeredBy } from "../../core/events/events";
import type { CreateNewEvent } from "../../core/events/ports/EventBus";
import type { TimeGateway } from "../../core/time-gateway/ports/TimeGateway";
import { useCaseBuilder } from "../../core/useCaseBuilder";
import {
  extractUserRolesOnConventionFromJwtPayload,
  retrieveConventionWithAgency,
  signConvention,
} from "../entities/Convention";

export type UpdateConvention = ReturnType<typeof makeUpdateConvention>;

export const makeUpdateConvention = useCaseBuilder("UpdateConvention")
  .withInput(updateConventionRequestSchema)
  .withOutput<WithConventionIdLegacy>()
  .withCurrentUser<ConventionDomainJwtPayload | ConnectedUserDomainJwtPayload>()
  .withDeps<{
    timeGateway: TimeGateway;
    createNewEvent: CreateNewEvent;
  }>()
  .build(
    async ({
      inputParams: { convention },
      uow,
      deps,
      currentUser: jwtPayload,
    }) => {
      if (!jwtPayload) throw errors.user.unauthorized();

      const { agency, convention: conventionFromRepo } =
        await retrieveConventionWithAgency(uow, convention.id);

      await throwIfNotAuthorizedForRole({
        uow,
        convention: conventionFromRepo,
        agencyWithUserRights: agency,
        authorizedRoles: [...allModifierRoles],
        errorToThrow: errors.convention.updateForbidden({ id: convention.id }),
        jwtPayload,
        isPeAdvisorAllowed: true,
        isValidatorOfAgencyRefersToAllowed:
          conventionFromRepo.status !== "ACCEPTED_BY_COUNSELLOR",
      });

      const minimalValidStatus: ConventionStatus = "READY_TO_SIGN";

      throwErrorIfConventionStatusNotAllowed(
        convention.status,
        [minimalValidStatus],
        errors.convention.updateBadStatusInParams({ id: convention.id }),
      );

      const isTransitionAllowed = statusTransitionConfigs[
        minimalValidStatus
      ].validInitialStatuses.includes(conventionFromRepo.status);

      if (!isTransitionAllowed)
        throw errors.convention.updateBadStatusInRepo({
          id: conventionFromRepo.id,
          status: conventionFromRepo.status,
        });

      if (convention.updatedAt !== conventionFromRepo.updatedAt) {
        throw errors.convention.conventionGotUpdatedWhileUpdating();
      }
      const userRolesOnConvention =
        await extractUserRolesOnConventionFromJwtPayload(
          jwtPayload,
          uow,
          conventionFromRepo,
        );

      const hasSignatoryRole = userRolesOnConvention.some((role) =>
        isSignatoryRole(role),
      );
      const conventionWithSignatoriesSignedAtAndDateApprovalCleared: ConventionDto =
        {
          ...convention,
          dateApproval: undefined,
          signatories: clearSignedAtForAllSignatories(convention),
        };

      const triggeredBy: TriggeredBy =
        "userId" in jwtPayload
          ? {
              kind: "connected-user",
              userId: jwtPayload.userId,
            }
          : {
              kind: "convention-magic-link",
              role: jwtPayload.role,
            };

      if (hasSignatoryRole) {
        const { signedConvention } = await signConvention({
          uow,
          convention: conventionWithSignatoriesSignedAtAndDateApprovalCleared,
          jwtPayload,
          now: deps.timeGateway.now().toISOString(),
        });

        await uow.conventionRepository.update(signedConvention);
        await uow.outboxRepository.save(
          deps.createNewEvent({
            topic: "ConventionModifiedAndSigned",
            payload: {
              convention: signedConvention,
              triggeredBy,
            },
          }),
        );
      } else {
        await uow.conventionRepository.update(
          conventionWithSignatoriesSignedAtAndDateApprovalCleared,
        );
        await uow.outboxRepository.save(
          deps.createNewEvent({
            topic: "ConventionSubmittedAfterModification",
            payload: {
              convention:
                conventionWithSignatoriesSignedAtAndDateApprovalCleared,
              triggeredBy,
            },
          }),
        );
      }

      return { id: conventionFromRepo.id };
    },
  );

const clearSignedAtForAllSignatories = (
  convention: ConventionDto,
): Signatories => {
  return {
    beneficiary: {
      ...convention.signatories.beneficiary,
      signedAt: undefined,
    },
    beneficiaryCurrentEmployer: convention.signatories
      .beneficiaryCurrentEmployer && {
      ...convention.signatories.beneficiaryCurrentEmployer,
      signedAt: undefined,
    },
    establishmentRepresentative: {
      ...convention.signatories.establishmentRepresentative,
      signedAt: undefined,
    },
    beneficiaryRepresentative: convention.signatories
      .beneficiaryRepresentative && {
      ...convention.signatories.beneficiaryRepresentative,
      signedAt: undefined,
    },
  };
};
