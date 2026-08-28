import {
  allModifierRoles,
  type ConnectedUserDomainJwtPayload,
  type ConventionDomainJwtPayload,
  type ConventionDto,
  type ConventionStatus,
  errors,
  type InternshipKind,
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

      const signatoryRole = userRolesOnConvention.find(isSignatoryRole);
      const conventionWithSignatoriesSignedAtAndDateApprovalCleared: ConventionDto =
        convention.internshipKind === "immersion"
          ? {
              ...convention,
              dateApproval: undefined,
              signatories: clearSignedAtForAllSignatories(
                convention.signatories,
              ),
            }
          : {
              ...convention,
              dateApproval: undefined,
              signatories: clearSignedAtForAllSignatories(
                convention.signatories,
              ),
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

      if (signatoryRole) {
        const signedConvention = await signConvention({
          uow,
          convention: conventionWithSignatoriesSignedAtAndDateApprovalCleared,
          now: deps.timeGateway.now().toISOString(),
          role: signatoryRole,
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

const clearSignedAtForAllSignatories = <T extends InternshipKind>(
  signatories: Signatories<T>,
): Signatories<T> => ({
  beneficiary: {
    ...signatories.beneficiary,
    signedAt: undefined,
  },
  beneficiaryCurrentEmployer: signatories.beneficiaryCurrentEmployer && {
    ...signatories.beneficiaryCurrentEmployer,
    signedAt: undefined,
  },
  establishmentRepresentative: {
    ...signatories.establishmentRepresentative,
    signedAt: undefined,
  },
  beneficiaryRepresentative: signatories.beneficiaryRepresentative && {
    ...signatories.beneficiaryRepresentative,
    signedAt: undefined,
  },
});
