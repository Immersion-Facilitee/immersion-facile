import {
  type ConventionDraftDto,
  errors,
  saveConventionDraftSchema,
} from "shared";
import type { CreateNewEvent } from "../../core/events/ports/EventBus";
import type { TimeGateway } from "../../core/time-gateway/ports/TimeGateway";
import { useCaseBuilder } from "../../core/useCaseBuilder";
import type { ConventionDraftRepository } from "../ports/ConventionDraftRepository";

export type SaveConventionDraft = ReturnType<typeof makeSaveConventionDraft>;

export const makeSaveConventionDraft = useCaseBuilder("SaveConventionDraft")
  .withInput(saveConventionDraftSchema)
  .withDeps<{
    timeGateway: TimeGateway;
    createNewEvent: CreateNewEvent;
  }>()
  .build(async ({ inputParams, uow, deps }) => {
    const now = deps.timeGateway.now().toISOString();

    await throwConflictErrorWhenConventionDraftHasBeenUpdatedSinceLastSave({
      conventionDraftRepository: uow.conventionDraftRepository,
      conventionDraftUpdated: inputParams.conventionDraft,
    });

    await uow.conventionDraftRepository.save(
      inputParams.mode === "duplicate"
        ? removeBeneficiaryFtConnectFederatedIdentityFromConvention(
            inputParams.conventionDraft,
          )
        : inputParams.conventionDraft,
      now,
    );

    await uow.outboxRepository.save(
      deps.createNewEvent({
        topic: "ConventionDraftSaved",
        payload: {
          draftId: inputParams.conventionDraft.id,
          details:
            "details" in inputParams && inputParams.details
              ? inputParams.details
              : null,
          senderEmail:
            "senderEmail" in inputParams ? inputParams.senderEmail : null,
          recipientEmail:
            "recipientEmail" in inputParams && inputParams.recipientEmail
              ? inputParams.recipientEmail
              : null,
        },
      }),
    );
  });

const throwConflictErrorWhenConventionDraftHasBeenUpdatedSinceLastSave =
  async ({
    conventionDraftRepository,
    conventionDraftUpdated,
  }: {
    conventionDraftRepository: ConventionDraftRepository;
    conventionDraftUpdated: ConventionDraftDto;
  }) => {
    const existingConventionDraft = await conventionDraftRepository.getById(
      conventionDraftUpdated.id,
    );

    if (
      existingConventionDraft?.updatedAt &&
      conventionDraftUpdated.updatedAt &&
      existingConventionDraft.updatedAt > conventionDraftUpdated.updatedAt
    ) {
      throw errors.conventionDraft.conflict({
        conventionDraftId: conventionDraftUpdated.id,
      });
    }
  };

const removeBeneficiaryFtConnectFederatedIdentityFromConvention = (
  conventionDraft: ConventionDraftDto,
): ConventionDraftDto => {
  if (
    conventionDraft.signatories?.beneficiary?.federatedIdentity?.provider !==
    "ftConnect"
  )
    return conventionDraft;

  const { federatedIdentity: _, ...beneficiaryWithoutFederatedIdentity } =
    conventionDraft.signatories.beneficiary;

  return {
    ...conventionDraft,
    signatories: {
      ...conventionDraft.signatories,
      beneficiary: beneficiaryWithoutFederatedIdentity,
    },
  };
};
