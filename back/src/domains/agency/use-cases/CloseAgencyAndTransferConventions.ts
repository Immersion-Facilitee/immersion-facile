import {
  activeAgencyStatuses,
  type ConnectedUser,
  type ConventionDto,
  closeAgencyAndTransferConventionsRequestSchema,
  errors,
  executeInSequence,
} from "shared";
import { throwErrorIfAgencyNotFound } from "../../../utils/agency";
import { throwIfNotAdmin } from "../../connected-users/helpers/authorization.helper";
import type { TriggeredBy } from "../../core/events/events";
import type { CreateNewEvent } from "../../core/events/ports/EventBus";
import type { TimeGateway } from "../../core/time-gateway/ports/TimeGateway";
import { useCaseBuilder } from "../../core/useCaseBuilder";

export type CloseAgencyAndTransferConventions = ReturnType<
  typeof makeCloseAgencyAndTransferConventions
>;

export const makeCloseAgencyAndTransferConventions = useCaseBuilder(
  "CloseAgencyAndTransferConventions",
)
  .withInput(closeAgencyAndTransferConventionsRequestSchema)
  .withCurrentUser<ConnectedUser>()
  .withDeps<{ createNewEvent: CreateNewEvent; timeGateway: TimeGateway }>()
  .build(async ({ uow, deps, inputParams, currentUser }) => {
    throwIfNotAdmin(currentUser);

    if (
      inputParams.agencyToCloseId ===
      inputParams.agencyToTransferConventionsToId
    )
      throw errors.agency.sourceAndTargetAgencyMustBeDifferent({
        agencyId: inputParams.agencyToCloseId,
      });

    await throwErrorIfAgencyNotFound({
      agencyId: inputParams.agencyToCloseId,
      agencyRepository: uow.agencyRepository,
    });

    const agencyToTransferTo = await throwErrorIfAgencyNotFound({
      agencyId: inputParams.agencyToTransferConventionsToId,
      agencyRepository: uow.agencyRepository,
    });

    if (!activeAgencyStatuses.includes(agencyToTransferTo.status))
      throw errors.agency.targetAgencyMustBeActive({
        agencyId: inputParams.agencyToTransferConventionsToId,
      });

    if (agencyToTransferTo.refersToAgencyId !== null)
      throw errors.agency.targetAgencyMustNotReferToAnother({
        agencyId: inputParams.agencyToTransferConventionsToId,
      });

    const triggeredBy: TriggeredBy = {
      kind: "connected-user",
      userId: currentUser.id,
    };

    const conventionsToTransfer = await uow.conventionQueries.getConventions({
      filters: { agencyIds: [inputParams.agencyToCloseId] },
      sortBy: "dateStart",
    });

    await executeInSequence(conventionsToTransfer, async (convention) => {
      const updatedConvention: ConventionDto = {
        ...convention,
        agencyId: inputParams.agencyToTransferConventionsToId,
      };
      await uow.conventionRepository.update(updatedConvention);
      await uow.outboxRepository.save(
        deps.createNewEvent({
          topic: "ConventionTransferredToAgency",
          payload: {
            convention: updatedConvention,
            agencyId: inputParams.agencyToTransferConventionsToId,
            justification: "Transfert suite à la fermeture de l'agence",
            previousAgencyId: inputParams.agencyToCloseId,
            shouldNotifyActors: false,
            triggeredBy,
          },
        }),
      );
    });

    const now = deps.timeGateway.now().toISOString();

    await executeInSequence(
      await uow.agencyRepository.getAgenciesRelatedToAgency(
        inputParams.agencyToCloseId,
      ),
      (referringAgency) =>
        uow.agencyRepository.update({
          id: referringAgency.id,
          status: referringAgency.status,
          refersToAgencyId: inputParams.agencyToTransferConventionsToId,
          refersToAgencyName: agencyToTransferTo.name,
          refersToAgencyContactEmail: agencyToTransferTo.contactEmail,
          updatedAt: now,
        }),
    );

    await uow.agencyRepository.update({
      id: inputParams.agencyToCloseId,
      status: "closed",
      statusJustification: "Agence fermée suite à un transfert de convention",
      updatedAt: now,
    });
  });
