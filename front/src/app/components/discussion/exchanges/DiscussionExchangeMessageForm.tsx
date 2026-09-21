import { fr } from "@codegouvfr/react-dsfr";
import { Button } from "@codegouvfr/react-dsfr/Button";
import { Input } from "@codegouvfr/react-dsfr/Input";
import { zodResolver } from "@hookform/resolvers/zod";
import { BorderedSection } from "react-design-system";
import { useForm } from "react-hook-form";
import { useDispatch } from "react-redux";
import {
  type DiscussionId,
  domElementIds,
  type ExchangeFromDashboard,
  type ExchangeRole,
  escapeHtml,
  exchangeMessageFromDashboardSchema,
} from "shared";
import { useFeedbackEventCallback } from "src/app/hooks/feedback.hooks";
import { makeFieldError } from "src/app/hooks/formContents.hooks";
import { useAppSelector } from "src/app/hooks/reduxHooks";
import { authSelectors } from "src/core-logic/domain/auth/auth.selectors";
import { discussionSlice } from "src/core-logic/domain/discussion/discussion.slice";
import { Feedback } from "../../feedback/Feedback";

export const DiscussionExchangeMessageForm = ({
  discussionId,
  viewer,
}: {
  discussionId: DiscussionId;
  viewer: ExchangeRole;
}) => {
  const { register, handleSubmit, formState, watch, setValue } =
    useForm<ExchangeFromDashboard>({
      resolver: zodResolver(exchangeMessageFromDashboardSchema),
      defaultValues: {
        message: "",
        recipientRole:
          viewer === "establishment" ? "potentialBeneficiary" : "establishment",
      },
    });
  const getFieldError = makeFieldError(formState);
  const dispatch = useDispatch();
  const connectedUserJwt = useAppSelector(authSelectors.connectedUserJwt);
  const message = watch("message");

  const onSubmit = (data: ExchangeFromDashboard) => {
    if (connectedUserJwt) {
      dispatch(
        discussionSlice.actions.sendExchangeRequested({
          exchangeData: {
            jwt: connectedUserJwt,
            discussionId,
            message: data.message,
            recipientRole: data.recipientRole,
          },
          feedbackTopic: "beneficiary-dashboard-discussion-send-message",
        }),
      );
    }
  };

  useFeedbackEventCallback(
    "beneficiary-dashboard-discussion-send-message",
    "create.success",
    () => {
      setValue("message", "", { shouldValidate: true });
    },
  );

  return (
    <BorderedSection>
      <form onSubmit={handleSubmit(onSubmit)}>
        <Feedback
          topics={[
            "establishment-dashboard-discussion-send-message",
            "beneficiary-dashboard-discussion-send-message",
          ]}
          className={fr.cx("fr-mb-2w")}
          closable
        />
        <input
          type="hidden"
          {...register("discussionId")}
          value={discussionId}
        />
        <Input
          textArea
          label={
            viewer === "establishment"
              ? "Répondre au candidat"
              : "Répondre à l'entreprise"
          }
          nativeTextAreaProps={{
            id: domElementIds.establishmentDashboard.discussion
              .sendMessageInput,
            rows: 5,
            placeholder: "Rédigez votre message ici...",
            ...register("message", {
              setValueAs: escapeHtml,
            }),
          }}
          {...getFieldError("message")}
        />
        <div className={fr.cx("fr-mt-2w")}>
          <Button
            id={
              domElementIds[
                viewer === "establishment"
                  ? "establishmentDashboard"
                  : "beneficiaryDashboard"
              ].discussion.sendMessageSubmitButton
            }
            type="submit"
            disabled={formState.isSubmitting || message.trim().length === 0}
            size="small"
          >
            Envoyer un message
          </Button>
        </div>
      </form>
    </BorderedSection>
  );
};
