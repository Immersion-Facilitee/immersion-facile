import { fr } from "@codegouvfr/react-dsfr";
import { Button } from "@codegouvfr/react-dsfr/Button";
import MailSend from "@codegouvfr/react-dsfr/picto/MainSend";
import Smartphone from "@codegouvfr/react-dsfr/picto/Smartphone";
import RadioButtons, {
  type RadioButtonsProps,
} from "@codegouvfr/react-dsfr/RadioButtons";
import Stepper from "@codegouvfr/react-dsfr/Stepper";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useDispatch } from "react-redux";
import {
  domElementIds,
  type MaskedOtpRecipients,
  OTP_CODE_LENGTH,
  type OtpJwt,
  type RequestOtpChallengeDto,
  requestOtpChallengeSchema,
} from "shared";
import { Feedback } from "src/app/components/feedback/Feedback";
import { useAppSelector } from "src/app/hooks/reduxHooks";
import type { FeedbackTopic } from "src/core-logic/domain/feedback/feedback.content";
import { otpChallengeSelectors } from "src/core-logic/domain/otpChallenge/otpChallenge.selectors";
import { otpChallengeSlice } from "src/core-logic/domain/otpChallenge/otpChallenge.slice";

const otpStepCount = 2;
const otpChallengeFeedbackTopic: FeedbackTopic = "otp-challenge";

type OtpChannelStepProps = {
  jwt: OtpJwt;
  maskedRecipients: MaskedOtpRecipients;
};

export const OtpChannelStep = ({
  jwt,
  maskedRecipients,
}: OtpChannelStepProps): JSX.Element => {
  const dispatch = useDispatch();
  const channel = useAppSelector(otpChallengeSelectors.channel);
  const isLoading = useAppSelector(otpChallengeSelectors.isLoading);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RequestOtpChallengeDto>({
    resolver: zodResolver(requestOtpChallengeSchema),
    defaultValues: { channel },
  });

  const requestOtpCode = ({ channel }: RequestOtpChallengeDto): void => {
    dispatch(
      otpChallengeSlice.actions.otpChallengeRequested({
        channel,
        jwt,
        feedbackTopic: otpChallengeFeedbackTopic,
      }),
    );
  };

  const channelOptions: RadioButtonsProps["options"] = [
    {
      label: "Recevoir le code par email",
      hintText: maskedRecipients.maskedEmail,
      illustration: <MailSend fontSize="large" />,
      nativeInputProps: {
        value: "email",
        ...register("channel"),
      },
    },
    ...(maskedRecipients.maskedPhone === null
      ? []
      : [
          {
            label: "Recevoir le code par SMS",
            hintText: maskedRecipients.maskedPhone,
            illustration: <Smartphone fontSize="large" />,
            nativeInputProps: {
              value: "sms",
              ...register("channel"),
            },
          },
        ]),
  ];

  return (
    <>
      <Stepper
        currentStep={1}
        stepCount={otpStepCount}
        title="Avant d’accéder à la convention, vérifions votre identité"
      />
      <p>
        Pour renforcer la sécurité de vos actions, Immersion Facilitée doit
        vérifier votre identité à l’aide d’un code temporaire à{" "}
        {OTP_CODE_LENGTH} chiffres.
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
      <form onSubmit={handleSubmit(requestOtpCode)}>
        <RadioButtons
          id={domElementIds.otpChallenge.channelRadioButtons}
          legend="Comment voulez-vous recevoir votre code ?"
          options={channelOptions}
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
