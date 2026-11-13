import { fr } from "@codegouvfr/react-dsfr";
import { Button } from "@codegouvfr/react-dsfr/Button";
import { Input } from "@codegouvfr/react-dsfr/Input";
import MailSend from "@codegouvfr/react-dsfr/picto/MainSend";
import Smartphone from "@codegouvfr/react-dsfr/picto/Smartphone";
import RadioButtons from "@codegouvfr/react-dsfr/RadioButtons";
import Stepper from "@codegouvfr/react-dsfr/Stepper";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { Loader, MainWrapper } from "react-design-system";
import { type UseFormReturn, useForm } from "react-hook-form";
import { useDispatch } from "react-redux";
import {
  domElementIds,
  type MaskedOtpRecipients,
  type NotificationKind,
  OTP_CHALLENGE_DURATION_IN_MINUTES,
  type RequestOtpChallengeDto,
  requestOtpChallengeSchema,
  type VerifyOtpChallengeDto,
  type VisitorOtpJwt,
  verifyOtpChallengeSchema,
} from "shared";
import { Feedback } from "src/app/components/feedback/Feedback";
import { HeaderFooterLayout } from "src/app/components/layout/HeaderFooterLayout";
import { useAppSelector } from "src/app/hooks/reduxHooks";
import type { FeedbackTopic } from "src/core-logic/domain/feedback/feedback.content";
import { feedbackSlice } from "src/core-logic/domain/feedback/feedback.slice";
import { otpChallengeSelectors } from "src/core-logic/domain/otpChallenge/otpChallenge.selectors";
import { otpChallengeSlice } from "src/core-logic/domain/otpChallenge/otpChallenge.slice";
import { match } from "ts-pattern";

const otpCodeLength = 6;
const otpStepCount = 2;
const otpChallengeFeedbackTopic: FeedbackTopic = "otp-challenge";

type OtpChallengeProps = {
  jwt: VisitorOtpJwt;
};

export const OtpChallenge = ({ jwt }: OtpChallengeProps): JSX.Element => {
  const dispatch = useDispatch();
  const maskedRecipients = useAppSelector(
    otpChallengeSelectors.maskedRecipients,
  );
  const isCodeSent = useAppSelector(otpChallengeSelectors.isCodeSent);
  const isLoading = useAppSelector(otpChallengeSelectors.isLoading);
  const channelFormMethods = useForm<RequestOtpChallengeDto>({
    resolver: zodResolver(requestOtpChallengeSchema),
    defaultValues: { channel: "email" },
  });

  useEffect(() => {
    dispatch(
      otpChallengeSlice.actions.maskedOtpRecipientsRequested({
        jwt,
        feedbackTopic: otpChallengeFeedbackTopic,
      }),
    );
    return () => {
      dispatch(otpChallengeSlice.actions.resetOtpChallengeRequested());
      dispatch(
        feedbackSlice.actions.clearFeedbackTopics([otpChallengeFeedbackTopic]),
      );
    };
  }, [dispatch, jwt]);

  const requestOtpCode = ({ channel }: RequestOtpChallengeDto): void => {
    dispatch(
      otpChallengeSlice.actions.otpChallengeRequested({
        channel,
        jwt,
        feedbackTopic: otpChallengeFeedbackTopic,
      }),
    );
  };

  return (
    <HeaderFooterLayout>
      <MainWrapper layout="boxed" vSpacing={8}>
        {isLoading && <Loader />}
        {maskedRecipients === null && (
          <Feedback topics={[otpChallengeFeedbackTopic]} />
        )}
        {maskedRecipients !== null &&
          (isCodeSent ? (
            <OtpCodeStep
              jwt={jwt}
              channel={channelFormMethods.getValues("channel")}
              maskedRecipients={maskedRecipients}
              isLoading={isLoading}
              onResendCode={() =>
                requestOtpCode(channelFormMethods.getValues())
              }
              onChangeChannel={() => {
                dispatch(
                  feedbackSlice.actions.clearFeedbackTopics([
                    otpChallengeFeedbackTopic,
                  ]),
                );
                dispatch(otpChallengeSlice.actions.otpChannelChangeRequested());
              }}
            />
          ) : (
            <OtpChannelStep
              channelFormMethods={channelFormMethods}
              maskedRecipients={maskedRecipients}
              isLoading={isLoading}
              onSubmit={requestOtpCode}
            />
          ))}
      </MainWrapper>
    </HeaderFooterLayout>
  );
};

type OtpChannelStepProps = {
  channelFormMethods: UseFormReturn<RequestOtpChallengeDto>;
  maskedRecipients: MaskedOtpRecipients;
  isLoading: boolean;
  onSubmit: (values: RequestOtpChallengeDto) => void;
};

const OtpChannelStep = ({
  channelFormMethods,
  maskedRecipients,
  isLoading,
  onSubmit,
}: OtpChannelStepProps): JSX.Element => {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = channelFormMethods;
  const emailOption = {
    label: "Recevoir le code par email",
    hintText: maskedRecipients.maskedEmail,
    illustration: <MailSend fontSize="large" />,
    nativeInputProps: {
      value: "email",
      ...register("channel"),
    },
  };

  return (
    <>
      <Stepper
        currentStep={1}
        stepCount={otpStepCount}
        title="Avant d’accéder à la convention, vérifions votre identité"
      />
      <p>
        Pour renforcer la sécurité de vos actions, Immersion Facilitée doit
        vérifier votre identité à l’aide d’un code temporaire à {otpCodeLength}{" "}
        chiffres.
      </p>
      <p className={fr.cx("fr-hint-text")}>
        Ce code ne peut être envoyé qu’aux coordonnées disponibles dans la
        convention.
      </p>
      <Feedback
        topics={[otpChallengeFeedbackTopic]}
        className={fr.cx("fr-mb-3w")}
        closable
      />
      <form onSubmit={handleSubmit(onSubmit)}>
        <RadioButtons
          id={domElementIds.otpChallenge.channelRadioButtons}
          legend="Comment voulez-vous recevoir votre code ?"
          options={
            maskedRecipients.maskedPhone === null
              ? [emailOption]
              : [
                  emailOption,
                  {
                    label: "Recevoir le code par SMS",
                    hintText: maskedRecipients.maskedPhone,
                    illustration: <Smartphone fontSize="large" />,
                    nativeInputProps: {
                      value: "sms",
                      ...register("channel"),
                    },
                  },
                ]
          }
          state={errors.channel ? "error" : "default"}
          stateRelatedMessage={errors.channel?.message}
        />
        <Button
          id={domElementIds.otpChallenge.sendCodeButton}
          type="submit"
          disabled={isLoading}
        >
          Envoyer le code
        </Button>
      </form>
    </>
  );
};

type OtpCodeStepProps = {
  jwt: VisitorOtpJwt;
  channel: NotificationKind;
  maskedRecipients: MaskedOtpRecipients;
  isLoading: boolean;
  onResendCode: () => void;
  onChangeChannel: () => void;
};

const OtpCodeStep = ({
  jwt,
  channel,
  maskedRecipients,
  isLoading,
  onResendCode,
  onChangeChannel,
}: OtpCodeStepProps): JSX.Element => {
  const dispatch = useDispatch();
  const [sentCodeCount, setSentCodeCount] = useState(0);
  const {
    register,
    handleSubmit,
    resetField,
    formState: { errors },
  } = useForm<VerifyOtpChallengeDto>({
    resolver: zodResolver(verifyOtpChallengeSchema),
    defaultValues: { otpCode: "" },
  });

  const verifyOtpCode = ({ otpCode }: VerifyOtpChallengeDto): void => {
    dispatch(
      otpChallengeSlice.actions.otpChallengeVerificationRequested({
        otpCode,
        jwt,
        feedbackTopic: otpChallengeFeedbackTopic,
      }),
    );
  };

  const { title, recipientIntroduction, maskedRecipient } = match(channel)
    .with("email", () => ({
      title: "Consultez votre boîte mail",
      recipientIntroduction: "à l’adresse",
      maskedRecipient: maskedRecipients.maskedEmail,
    }))
    .with("sms", () => ({
      title: "Consultez vos SMS",
      recipientIntroduction: "au numéro",
      maskedRecipient: maskedRecipients.maskedPhone,
    }))
    .exhaustive();

  return (
    <>
      <Stepper currentStep={2} stepCount={otpStepCount} title={title} />
      <p>
        Nous vous avons envoyé un code de vérification à {otpCodeLength}{" "}
        chiffres {recipientIntroduction} <strong>{maskedRecipient}</strong>. Il
        est valable {OTP_CHALLENGE_DURATION_IN_MINUTES} minutes.
      </p>
      <Feedback
        key={sentCodeCount}
        topics={[otpChallengeFeedbackTopic]}
        className={fr.cx("fr-mb-3w")}
        closable
      />
      <form
        className={fr.cx("fr-grid-row")}
        onSubmit={handleSubmit(verifyOtpCode)}
      >
        <Input
          className={fr.cx("fr-col-12", "fr-col-md-6", "fr-mb-0")}
          label={`Saisissez le code à ${otpCodeLength} chiffres pour confirmer votre identité`}
          hintText="La vérification se lance dès la saisie complète."
          nativeInputProps={{
            id: domElementIds.otpChallenge.otpCodeInput,
            inputMode: "numeric",
            autoComplete: "one-time-code",
            maxLength: otpCodeLength,
            ...register("otpCode", {
              onChange: (event) => {
                if (event.target.value.length === otpCodeLength)
                  handleSubmit(verifyOtpCode)();
              },
            }),
          }}
          state={errors.otpCode ? "error" : "default"}
          stateRelatedMessage={errors.otpCode?.message}
        />
      </form>
      <p className={fr.cx("fr-mt-3w")}>
        Vous n’avez rien reçu ?{" "}
        <button
          id={domElementIds.otpChallenge.resendCodeButton}
          type="button"
          className={fr.cx("fr-link")}
          disabled={isLoading}
          onClick={() => {
            resetField("otpCode");
            setSentCodeCount((count) => count + 1);
            onResendCode();
          }}
        >
          Renvoyer le code
        </button>{" "}
        ou{" "}
        <button
          id={domElementIds.otpChallenge.changeChannelButton}
          type="button"
          className={fr.cx("fr-link")}
          disabled={isLoading}
          onClick={onChangeChannel}
        >
          Changer la méthode d’envoi
        </button>
      </p>
    </>
  );
};
