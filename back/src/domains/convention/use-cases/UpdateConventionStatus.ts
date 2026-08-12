import {
  type ConventionDto,
  type ConventionId,
  type ConventionRelatedJwtPayload,
  type ConventionRole,
  type ConventionStatus,
  type DateString,
  errors,
  getConventionManageAllowedRoles,
  type Role,
  reviewedConventionStatuses,
  type UserWithRights,
  updateConventionStatusRequestSchema,
  validatedConventionStatuses,
  type WithConventionIdLegacy,
} from "shared";
import { getAgencyValidationSteps } from "../../../utils/agency";
import { getUserWithRights } from "../../connected-users/helpers/userRights.helper";
import type { DomainTopic, TriggeredBy } from "../../core/events/events";
import type { CreateNewEvent } from "../../core/events/ports/EventBus";
import type { TimeGateway } from "../../core/time-gateway/ports/TimeGateway";
import type { UnitOfWork } from "../../core/unit-of-work/ports/UnitOfWork";
import { useCaseBuilder } from "../../core/useCaseBuilder";
import {
  throwErrorOnConventionIdMismatch,
  throwIfTransitionNotAllowed,
} from "../entities/Convention";

const domainTopicByTargetStatusMap: Record<
  ConventionStatus,
  DomainTopic | null
> = {
  READY_TO_SIGN: null,
  PARTIALLY_SIGNED: "ConventionPartiallySigned",
  IN_REVIEW: "ConventionFullySigned",
  ACCEPTED_BY_COUNSELLOR: "ConventionAcceptedByCounsellor",
  ACCEPTED_BY_VALIDATOR: "ConventionAcceptedByValidator",
  REJECTED: "ConventionRejected",
  CANCELLED: "ConventionCancelled",
  DEPRECATED: "ConventionDeprecated",
};

export type UpdateConventionStatus = ReturnType<
  typeof makeUpdateConventionStatus
>;

export const makeUpdateConventionStatus = useCaseBuilder(
  "UpdateConventionStatus",
)
  .withInput(updateConventionStatusRequestSchema)
  .withOutput<WithConventionIdLegacy>()
  .withCurrentUser<ConventionRelatedJwtPayload>()
  .withDeps<{
    createNewEvent: CreateNewEvent;
    timeGateway: TimeGateway;
  }>()
  .build(async ({ inputParams, uow, deps, currentUser: payload }) => {
    throwErrorOnConventionIdMismatch({
      requestedConventionId: inputParams.conventionId,
      jwtPayload: payload,
    });
    const convention = await uow.conventionRepository.getById(
      inputParams.conventionId,
    );
    if (!convention)
      throw errors.convention.notFound({
        conventionId: inputParams.conventionId,
      });

    const agencyWithRights = await uow.agencyRepository.getById(
      convention.agencyId,
    );

    if (!agencyWithRights)
      throw errors.agency.notFound({
        agencyId: convention.agencyId,
      });

    const roleOrUser = await getRoleInPayloadOrUser(
      uow,
      payload,
      inputParams.status,
      convention.id,
    );

    const roles =
      "roleInPayload" in roleOrUser
        ? [roleOrUser.roleInPayload]
        : getConventionManageAllowedRoles(
            convention,
            roleOrUser.userWithRights,
          );

    const assessment = await uow.assessmentRepository.getByConventionId(
      convention.id,
    );

    const agencyValidationSteps = getAgencyValidationSteps(agencyWithRights);

    throwIfTransitionNotAllowed({
      roles,
      targetStatus: inputParams.status,
      convention,
      agencyValidationSteps,
      hasAssessment: !!assessment,
    });

    const conventionUpdatedAt = deps.timeGateway.now().toISOString();

    const statusJustification =
      inputParams.status === "CANCELLED" ||
      inputParams.status === "REJECTED" ||
      inputParams.status === "DEPRECATED"
        ? inputParams.statusJustification
        : undefined;

    const hasCounsellor =
      inputParams.status === "ACCEPTED_BY_COUNSELLOR" &&
      (inputParams.lastname || inputParams.firstname);

    const hasValidator =
      inputParams.status === "ACCEPTED_BY_VALIDATOR" &&
      (inputParams.lastname || inputParams.firstname);

    const getDateApproval = (): DateString | undefined => {
      if (reviewedConventionStatuses.includes(inputParams.status))
        return conventionUpdatedAt;
      if (validatedConventionStatuses.includes(inputParams.status))
        return convention.dateApproval;
      return undefined;
    };

    const updatedConvention: ConventionDto = {
      ...convention,
      status: inputParams.status,
      dateValidation: validatedConventionStatuses.includes(inputParams.status)
        ? conventionUpdatedAt
        : undefined,
      dateApproval: getDateApproval(),
      statusJustification,
      ...(hasCounsellor
        ? {
            validators: {
              ...convention.validators,
              agencyCounsellor: {
                firstname: inputParams.firstname,
                lastname: inputParams.lastname,
              },
            },
          }
        : {}),
      ...(hasValidator
        ? {
            validators: {
              ...convention.validators,
              agencyValidator: {
                firstname: inputParams.firstname,
                lastname: inputParams.lastname,
              },
            },
          }
        : {}),
    };

    const updatedId = await uow.conventionRepository.update(updatedConvention);
    if (!updatedId)
      throw errors.convention.notFound({
        conventionId: updatedConvention.id,
      });

    const domainTopic = domainTopicByTargetStatusMap[inputParams.status];
    if (domainTopic) {
      const triggeredBy: TriggeredBy =
        "roleInPayload" in roleOrUser
          ? {
              kind: "convention-magic-link",
              role: roleOrUser.roleInPayload,
            }
          : {
              kind: "connected-user",
              userId: roleOrUser.userWithRights.id,
            };

      const event = deps.createNewEvent({
        topic: domainTopic,
        payload: {
          convention: updatedConvention,
          triggeredBy,
        },
      });

      await uow.outboxRepository.save({
        ...event,
        occurredAt: conventionUpdatedAt,
      });
    }

    return { id: updatedId };
  });

const getRoleInPayloadOrUser = async (
  uow: UnitOfWork,
  payload: ConventionRelatedJwtPayload,
  targetStatus: ConventionStatus,
  conventionId: ConventionId,
): Promise<{ userWithRights: UserWithRights } | { roleInPayload: Role }> => {
  if ("role" in payload) {
    if (payload.role === ("back-office" as ConventionRole))
      throw errors.convention.badRoleStatusChange({
        roles: ["back-office"],
        status: targetStatus,
        conventionId,
      });
    return { roleInPayload: payload.role };
  }

  const userWithRights = await getUserWithRights(uow, payload.userId);
  if (!userWithRights)
    throw errors.user.notFound({
      userId: payload.userId,
    });

  return {
    userWithRights: userWithRights,
  };
};
