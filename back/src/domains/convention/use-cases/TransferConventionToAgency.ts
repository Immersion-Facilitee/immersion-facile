import {
  agencyModifierRoles,
  type ConnectedUserDomainJwtPayload,
  type ConventionDto,
  errors,
  type TransferConventionToAgencyRequestDto,
  transferConventionToAgencyRequestSchema,
} from "shared";
import { throwErrorIfAgencyNotFound } from "../../../utils/agency";
import { throwErrorIfConventionStatusNotAllowed } from "../../../utils/convention";
import { throwIfNotAuthorizedForRole } from "../../connected-users/helpers/authorization.helper";
import type { CreateNewEvent } from "../../core/events/ports/EventBus";
import type { TimeGateway } from "../../core/time-gateway/ports/TimeGateway";
import { useCaseBuilder } from "../../core/useCaseBuilder";
import {
  retrieveConventionWithAgency,
  throwIfConventionArchivedAndUserIsNotAdmin,
} from "../entities/Convention";

export type TransferConventionToAgency = ReturnType<
  typeof makeTransferConventionToAgency
>;

export const makeTransferConventionToAgency = useCaseBuilder(
  "TransferConventionToAgency",
)
  .withInput<TransferConventionToAgencyRequestDto>(
    transferConventionToAgencyRequestSchema,
  )
  .withOutput<void>()
  .withCurrentUser<ConnectedUserDomainJwtPayload>()
  .withDeps<{
    createNewEvent: CreateNewEvent;
    timeGateway: TimeGateway;
  }>()
  .build(async ({ inputParams, uow, deps, currentUser }) => {
    const { agency, convention } = await retrieveConventionWithAgency(
      uow,
      inputParams.conventionId,
    );

    throwErrorIfConventionStatusNotAllowed(
      convention.status,
      ["IN_REVIEW", "PARTIALLY_SIGNED", "READY_TO_SIGN"],
      errors.convention.transferNotAllowedForStatus({
        status: convention.status,
      }),
    );

    await throwErrorIfAgencyNotFound({
      agencyId: inputParams.agencyId,
      agencyRepository: uow.agencyRepository,
    });

    await throwIfNotAuthorizedForRole({
      uow,
      convention,
      agencyWithUserRights: agency,
      authorizedRoles: [...agencyModifierRoles, "back-office"],
      errorToThrow: errors.convention.transferNotAuthorizedForRole(),
      jwtPayload: currentUser,
      isPeAdvisorAllowed: false,
      isValidatorOfAgencyRefersToAllowed: false,
    });

    await throwIfConventionArchivedAndUserIsNotAdmin({
      convention,
      now: deps.timeGateway.now(),
      jwtPayload: currentUser,
      uow,
    });

    const updatedConvention: ConventionDto = {
      ...convention,
      agencyId: inputParams.agencyId,
    };

    await uow.conventionRepository.update(updatedConvention);
    await uow.outboxRepository.save(
      deps.createNewEvent({
        topic: "ConventionTransferredToAgency",
        payload: {
          convention: updatedConvention,
          agencyId: inputParams.agencyId,
          justification: inputParams.justification,
          previousAgencyId: convention.agencyId,
          shouldNotifyActors: true,
          triggeredBy: {
            kind: "connected-user",
            userId: currentUser.userId,
          },
        },
      }),
    );
  });
