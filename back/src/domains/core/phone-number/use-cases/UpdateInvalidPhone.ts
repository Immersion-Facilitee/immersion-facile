import {
  type Phone,
  type PhoneNumber,
  phoneNumberSchema,
  type TriggeredBy,
  triggeredBySchema,
} from "shared";
import z from "zod";
import { useCaseBuilder } from "../../useCaseBuilder";
import type { PhoneId } from "../adapters/pgPhoneHelper";

export type UpdatePhonePayload = {
  phoneIdToUpdate: PhoneId;
  newPhoneNumber: PhoneNumber;
  triggeredBy: TriggeredBy;
};

const updatePhonePayloadSchema = z.object({
  phoneIdToUpdate: z.number(),
  newPhoneNumber: phoneNumberSchema,
  triggeredBy: triggeredBySchema,
});

export type UpdateInvalidPhone = ReturnType<typeof makeUpdateInvalidPhone>;

export const makeUpdateInvalidPhone = useCaseBuilder("UpdateInvalidPhone")
  .withInput<UpdatePhonePayload>(updatePhonePayloadSchema)
  .build(async ({ inputParams: updatePhonePayload, uow }) => {
    const phoneToUpdate: Phone | undefined =
      await uow.phoneRepository.getPhoneById(
        updatePhonePayload.phoneIdToUpdate,
      );

    if (
      !phoneToUpdate ||
      (phoneToUpdate.phoneNumber === updatePhonePayload.newPhoneNumber &&
        phoneToUpdate.status === "VALID")
    )
      return;

    const conflictingPhoneNumberId =
      await uow.phoneRepository.getConflictingPhoneNumberId({
        phoneNumber: updatePhonePayload.newPhoneNumber,
      });

    conflictingPhoneNumberId && conflictingPhoneNumberId !== phoneToUpdate.id
      ? await uow.phoneRepository.fixConflictingPhone({
          phoneToUpdate,
          newPhoneNumber: updatePhonePayload.newPhoneNumber,
          conflictingPhoneId: conflictingPhoneNumberId,
        })
      : await uow.phoneRepository.fixNotConflictingPhone({
          phoneToUpdate,
          newPhoneNumber: updatePhonePayload.newPhoneNumber,
        });
  });
