import {
  agencyModifierRoles,
  type ConventionDto,
  type ConventionRelatedJwtPayload,
  type EditConventionCounsellorNameRequestDto,
  editConventionCounsellorNameRequestSchema,
  errors,
} from "shared";
import { throwErrorIfConventionStatusNotAllowed } from "../../../utils/convention";
import { throwIfNotAuthorizedForRole } from "../../connected-users/helpers/authorization.helper";
import type { TriggeredBy } from "../../core/events/events";
import type { CreateNewEvent } from "../../core/events/ports/EventBus";
import type { TimeGateway } from "../../core/time-gateway/ports/TimeGateway";
import { useCaseBuilder } from "../../core/useCaseBuilder";
import {
  retrieveConventionWithAgency,
  throwErrorOnConventionIdMismatch,
  throwIfConventionArchivedForNonAdmin,
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
  .withCurrentUser<ConventionRelatedJwtPayload>()
  .withDeps<{
    createNewEvent: CreateNewEvent;
    timeGateway: TimeGateway;
  }>()
  .build(async ({ inputParams, uow, deps, currentUser: jwtPayload }) => {
    throwErrorOnConventionIdMismatch({
      requestedConventionId: inputParams.conventionId,
      jwtPayload,
    });

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
      jwtPayload,
      convention,
      authorizedRoles: [...agencyModifierRoles, "back-office"],
      errorToThrow: errors.convention.editCounsellorNameNotAuthorizedForRole(),
      agencyWithUserRights: agency,
      isPeAdvisorAllowed: true,
      isValidatorOfAgencyRefersToAllowed: false,
    });

    await throwIfConventionArchivedForNonAdmin({
      convention,
      now: deps.timeGateway.now(),
      jwtPayload,
      uow,
    });

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
          triggeredBy,
        },
      }),
    );
  });
