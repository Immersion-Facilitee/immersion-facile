import { fr } from "@codegouvfr/react-dsfr";
import { Input } from "@codegouvfr/react-dsfr/Input";
import ToggleSwitch from "@codegouvfr/react-dsfr/ToggleSwitch";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { ErrorNotifications } from "react-design-system";
import { useForm } from "react-hook-form";
import { useDispatch } from "react-redux";
import {
  type CreateConventionPresentationInitialValues,
  domElementIds,
  type SaveConventionDraftFromConventionDto,
  saveConventionDraftFromConventionSchema,
  toConventionDraftDto,
} from "shared";
import { WithFeedbackReplacer } from "src/app/components/feedback/WithFeedbackReplacer";
import { formConventionFieldsLabels } from "src/app/contents/forms/convention/formConvention";
import {
  displayReadableError,
  getFormContents,
  toErrorsWithLabels,
} from "src/app/hooks/formContents.hooks";
import { setValueAsUndefined } from "src/app/utils/form.utils";
import { conventionDraftSlice } from "src/core-logic/domain/convention/convention-draft/conventionDraft.slice";

export type ShareFormProps = {
  conventionFormData: CreateConventionPresentationInitialValues;
};

const makeInitialValues = ({
  conventionFormData,
}: {
  conventionFormData: CreateConventionPresentationInitialValues;
}): SaveConventionDraftFromConventionDto => ({
  senderEmail: "",
  mode: "share",
  conventionDraft: toConventionDraftDto({ convention: conventionFormData }),
  details:
    "Je vous invite à prendre connaissance de cette demande de convention d’immersion déjà partiellement remplie afin que vous la complétiez.  Merci !",
});

export const ShareForm = ({ conventionFormData }: ShareFormProps) => {
  const dispatch = useDispatch();
  const [isOnlyForSelf, setIsOnlyForSelf] = useState(false);
  const onSubmit = (values: SaveConventionDraftFromConventionDto) => {
    dispatch(
      conventionDraftSlice.actions.saveConventionDraftThenRedirectRequested({
        ...values,
        feedbackTopic: "convention-draft",
      }),
    );
  };
  const methods = useForm<SaveConventionDraftFromConventionDto>({
    mode: "onTouched",
    defaultValues: makeInitialValues({
      conventionFormData,
    }),
    resolver: zodResolver(saveConventionDraftFromConventionSchema),
  });
  const { register, handleSubmit, formState, reset, setValue } = methods;
  const { errors, submitCount } = formState;

  const { getFormErrors } = getFormContents(
    formConventionFieldsLabels({
      internshipKind: conventionFormData.internshipKind,
      isConventionTemplate: false,
    }),
  );

  useEffect(() => {
    reset(makeInitialValues({ conventionFormData }));
  }, [conventionFormData, reset]);

  return (
    <WithFeedbackReplacer topic="convention-draft">
      <form
        id={domElementIds.conventionImmersion.shareConventionDraft.shareForm}
        onSubmit={handleSubmit(onSubmit)}
      >
        <p className={fr.cx("fr-text--xs")}>
          Tous les champs marqués d'une astérisque (*) sont obligatoires.
        </p>
        <Input
          label="Votre adresse email *"
          nativeInputProps={{
            ...register("senderEmail"),
            id: domElementIds.conventionImmersion.shareConventionDraft
              .shareFormEmailInput,
            type: "email",
            placeholder: "nom@exemple.com",
          }}
          state={formState.errors.senderEmail ? "error" : "default"}
          stateRelatedMessage={formState.errors.senderEmail?.message}
        />
        <ToggleSwitch
          label="Je souhaite uniquement enregistrer un brouillon pour moi"
          checked={isOnlyForSelf}
          onChange={(checked) => {
            setValue("recipientEmail", undefined);
            setValue("details", undefined);
            setIsOnlyForSelf(checked);
          }}
        />
        <Input
          className={fr.cx("fr-mt-2w")}
          label="Adresse email du destinataire *"
          nativeInputProps={{
            ...register("recipientEmail", {
              setValueAs: setValueAsUndefined,
            }),
            type: "email",
            placeholder: "nom@exemple.com",
            id: domElementIds.conventionImmersion.shareConventionDraft
              .shareFormRecipientEmailInput,
          }}
          state={formState.errors.recipientEmail ? "error" : "default"}
          stateRelatedMessage={formState.errors.recipientEmail?.message}
          disabled={isOnlyForSelf}
        />
        <Input
          label="Votre message (facultatif)"
          nativeTextAreaProps={{
            ...register("details", {
              setValueAs: setValueAsUndefined,
            }),
            id: domElementIds.conventionImmersion.shareConventionDraft
              .shareFormDetailsInput,
          }}
          textArea
          state={formState.errors.details ? "error" : "default"}
          stateRelatedMessage={formState.errors.details?.message}
          disabled={isOnlyForSelf}
        />
        <ErrorNotifications
          errorsWithLabels={toErrorsWithLabels({
            errors: displayReadableError(errors),
            labels: Object.fromEntries(
              Object.entries(getFormErrors()).map(([key, value]) => [
                `conventionDraft.${key}`,
                value,
              ]),
            ),
          })}
          visible={submitCount !== 0 && Object.values(errors).length > 0}
        />
      </form>
    </WithFeedbackReplacer>
  );
};
