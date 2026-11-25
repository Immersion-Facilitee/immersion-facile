import { fr } from "@codegouvfr/react-dsfr";
import { Input } from "@codegouvfr/react-dsfr/Input";
import Stepper from "@codegouvfr/react-dsfr/Stepper";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useDispatch } from "react-redux";
import {
  domElementIds,
  type MaskedOtpRecipients,
  type NotificationKind,
  OTP_CHALLENGE_DURATION_IN_MINUTES,
  OTP_CODE_LENGTH,
  type OtpJwt,
  type VerifyOtpChallengeDto,
  verifyOtpChallengeSchema,
} from "shared";
import { Feedback } from "src/app/components/feedback/Feedback";
import { useAppSelector } from "src/app/hooks/reduxHooks";
import { useWebOtpCode } from "src/app/hooks/webOtp.hooks";
import type { FeedbackTopic } from "src/core-logic/domain/feedback/feedback.content";
import { feedbackSlice } from "src/core-logic/domain/feedback/feedback.slice";
import { otpChallengeSelectors } from "src/core-logic/domain/otpChallenge/otpChallenge.selectors";
import { otpChallengeSlice } from "src/core-logic/domain/otpChallenge/otpChallenge.slice";
import { match } from "ts-pattern";

const otpStepCount = 2;
const otpChallengeFeedbackTopic: FeedbackTopic = "otp-challenge";

type OtpCodeStepProps = {
  jwt: OtpJwt;
  maskedRecipients: MaskedOtpRecipients;
};

export const OtpCodeStep = ({
  jwt,
  maskedRecipients,
}: OtpCodeStepProps): JSX.Element => {
  const dispatch = useDispatch();
  const channel = useAppSelector(otpChallengeSelectors.channel);
  const isLoading = useAppSelector(otpChallengeSelectors.isLoading);
  const [codeInputKey, setCodeInputKey] = useState(0);

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
        Nous vous avons envoyé un code de vérification à {OTP_CODE_LENGTH}{" "}
        chiffres {recipientIntroduction} <strong>{maskedRecipient}</strong>. Il
        est valable {OTP_CHALLENGE_DURATION_IN_MINUTES} minutes.
      </p>
      <Feedback
        topics={[otpChallengeFeedbackTopic]}
        className={fr.cx("fr-mb-3w")}
        closable
      />
      <OtpCodeForm key={codeInputKey} jwt={jwt} channel={channel} />
      <p className={fr.cx("fr-mt-3w")}>
        Vous n’avez rien reçu ?{" "}
        <button
          id={domElementIds.otpChallenge.resendCodeButton}
          type="button"
          className={fr.cx("fr-link")}
          disabled={isLoading}
          onClick={() => {
            setCodeInputKey((key) => key + 1);
            dispatch(
              otpChallengeSlice.actions.otpChallengeRequested({
                channel,
                jwt,
                feedbackTopic: otpChallengeFeedbackTopic,
              }),
            );
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
          onClick={() => {
            dispatch(
              feedbackSlice.actions.clearFeedbackTopics([
                otpChallengeFeedbackTopic,
              ]),
            );
            dispatch(otpChallengeSlice.actions.otpChannelChangeRequested());
          }}
        >
          Changer la méthode d’envoi
        </button>
      </p>
    </>
  );
};

type OtpCodeFormProps = {
  jwt: OtpJwt;
  channel: NotificationKind;
};

const OtpCodeForm = ({ jwt, channel }: OtpCodeFormProps): JSX.Element => {
  const dispatch = useDispatch();
  const {
    register,
    handleSubmit,
    setValue,
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

  useWebOtpCode({
    isEnabled: channel === "sms",
    onCode: (otpCode) => {
      setValue("otpCode", otpCode);
      handleSubmit(verifyOtpCode)();
    },
  });

  return (
    <form
      className={fr.cx("fr-grid-row")}
      onSubmit={handleSubmit(verifyOtpCode)}
    >
      <Input
        className={fr.cx("fr-col-12", "fr-col-md-6", "fr-mb-0")}
        label={`Saisissez le code à ${OTP_CODE_LENGTH} chiffres pour confirmer votre identité`}
        hintText="La vérification se lance dès la saisie complète."
        nativeInputProps={{
          id: domElementIds.otpChallenge.otpCodeInput,
          inputMode: "numeric",
          autoComplete: "one-time-code",
          maxLength: OTP_CODE_LENGTH,
          ...register("otpCode", {
            onChange: (event) => {
              if (event.target.value.length === OTP_CODE_LENGTH)
                handleSubmit(verifyOtpCode)();
            },
          }),
        }}
        state={errors.otpCode ? "error" : "default"}
        stateRelatedMessage={errors.otpCode?.message}
      />
    </form>
  );
};
