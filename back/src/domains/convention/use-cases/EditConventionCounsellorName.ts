import {
  agencyModifierRoles,
  type ConnectedUserDomainJwtPayload,
  type ConventionDto,
  type EditConventionCounsellorNameRequestDto,
  editConventionCounsellorNameRequestSchema,
  errors,
} from "shared";
import { throwErrorIfConventionStatusNotAllowed } from "../../../utils/convention";
import { throwIfNotAuthorizedForRole } from "../../connected-users/helpers/authorization.helper";
import type { CreateNewEvent } from "../../core/events/ports/EventBus";
import type { TimeGateway } from "../../core/time-gateway/ports/TimeGateway";
import { useCaseBuilder } from "../../core/useCaseBuilder";
import {
  retrieveConventionWithAgency,
  throwIfConventionArchivedAndUserIsNotAdmin,
} from "../entities/Convention";

export type EditConventionCounsellorName = ReturnType<
  typeof makeEditConventionCounsellorName
>;

export const makeEditConventionCounsellorName = useCaseBuilder(
  "EditCounsellorName",
)
  .withInput<EditConventionCounsellorNameRequestDto>(
    editConventionCounsellorNameRequestSchema,
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
      errors.convention.editCounsellorNameNotAllowedForStatus({
        status: convention.status,
      }),
    );

    await throwIfNotAuthorizedForRole({
      uow,
      jwtPayload: currentUser,
      convention,
      authorizedRoles: [...agencyModifierRoles, "back-office"],
      errorToThrow: errors.convention.editCounsellorNameNotAuthorizedForRole(),
      agencyWithUserRights: agency,
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
      agencyReferent: {
        firstname: inputParams.firstname,
        lastname: inputParams.lastname,
      },
    };

    await uow.conventionRepository.update(updatedConvention);
    await uow.outboxRepository.save(
      deps.createNewEvent({
        topic: "ConventionCounsellorNameEdited",
        payload: {
          conventionId: updatedConvention.id,
          triggeredBy: {
            kind: "connected-user",
            userId: currentUser.userId,
          },
        },
      }),
    );
  });
