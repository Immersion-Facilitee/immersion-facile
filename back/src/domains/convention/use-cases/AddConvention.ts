import {
  addConventionInputSchema,
  type ConventionStatus,
  errors,
} from "shared";
import type { CreateNewEvent } from "../../core/events/ports/EventBus";
import { rejectsSiretIfNotAnOpenCompany } from "../../core/sirene/helpers/rejectsSiretIfNotAnOpenCompany";
import type { SiretGateway } from "../../core/sirene/ports/SiretGateway";
import { useCaseBuilder } from "../../core/useCaseBuilder";

export type AddConvention = ReturnType<typeof makeAddConvention>;

export const makeAddConvention = useCaseBuilder("AddConvention")
  .withInput(addConventionInputSchema)
  .withDeps<{ siretGateway: SiretGateway; createNewEvent: CreateNewEvent }>()
  .build(
    async ({
      inputParams: { convention, discussionId, fromConventionDraftId },
      deps,
      uow,
    }) => {
      const minimalValidStatus: ConventionStatus = "READY_TO_SIGN";

      if (convention.status !== minimalValidStatus) {
        throw errors.convention.forbiddenStatus({
          status: convention.status,
        });
      }

      await rejectsSiretIfNotAnOpenCompany(deps.siretGateway, convention.siret);

      await uow.conventionRepository.save({
        ...convention,
        fromConventionDraftId,
      });
      await uow.conventionExternalIdRepository.save(convention.id);

      const event = deps.createNewEvent({
        topic: "ConventionSubmittedByBeneficiary",
        payload: {
          convention,
          triggeredBy: null,
          ...(fromConventionDraftId
            ? { conventionDraftId: fromConventionDraftId }
            : {}),
          ...(discussionId ? { discussionId } : {}),
        },
      });

      await uow.outboxRepository.save(event);

      return { id: convention.id };
    },
  );
