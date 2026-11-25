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
  expiredJwtErrorMessage,
  type MaskedOtpRecipients,
  type NotificationKind,
  OTP_CHALLENGE_DURATION_IN_MINUTES,
  OTP_CODE_LENGTH,
  type OtpJwt,
  type RequestOtpChallengeDto,
  requestOtpChallengeSchema,
  type VerifyOtpChallengeDto,
  verifyOtpChallengeSchema,
} from "shared";
import { RenewExpiredJwtButton } from "src/app/components/auth/RenewExpiredJwtButton";
import { Feedback } from "src/app/components/feedback/Feedback";
import { HeaderFooterLayout } from "src/app/components/layout/HeaderFooterLayout";
import { useFeedbackTopic } from "src/app/hooks/feedback.hooks";
import { useAppSelector } from "src/app/hooks/reduxHooks";
import { useWebOtpCode } from "src/app/hooks/webOtp.hooks";
import { frontErrors } from "src/app/pages/error/front-errors";
import type { FeedbackTopic } from "src/core-logic/domain/feedback/feedback.content";
import { feedbackSlice } from "src/core-logic/domain/feedback/feedback.slice";
import { otpChallengeSelectors } from "src/core-logic/domain/otpChallenge/otpChallenge.selectors";
import { otpChallengeSlice } from "src/core-logic/domain/otpChallenge/otpChallenge.slice";
import { match } from "ts-pattern";

const otpStepCount = 2;
const otpChallengeFeedbackTopic: FeedbackTopic = "otp-challenge";
const renewExpiredJwtFeedbackTopic: FeedbackTopic = "renew-expired-jwt";

type OtpChallengePageProps = {
  jwt: OtpJwt;
};

export const OtpChallengePage = ({
  jwt,
}: OtpChallengePageProps): JSX.Element => {
  const dispatch = useDispatch();
  const maskedRecipients = useAppSelector(
    otpChallengeSelectors.maskedRecipients,
  );
  const isCodeSent = useAppSelector(otpChallengeSelectors.isCodeSent);
  const isLoading = useAppSelector(otpChallengeSelectors.isLoading);
  const [sentCodeCount, setSentCodeCount] = useState(0);
  const otpChallengeFeedback = useFeedbackTopic(otpChallengeFeedbackTopic);
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

  if (
    otpChallengeFeedback?.level === "error" &&
    otpChallengeFeedback.message.includes(expiredJwtErrorMessage)
  )
    throw frontErrors.jwtLink.expired({
      RenewJwtButton: (
        <RenewExpiredJwtButton
          key={RenewExpiredJwtButton.name}
          expiredJwt={jwt}
          feedbackTopic={renewExpiredJwtFeedbackTopic}
        />
      ),
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
              key={sentCodeCount}
              jwt={jwt}
              channel={channelFormMethods.getValues("channel")}
              maskedRecipients={maskedRecipients}
              isLoading={isLoading}
              onResendCode={() => {
                setSentCodeCount((count) => count + 1);
                requestOtpCode(channelFormMethods.getValues());
              }}
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
  jwt: OtpJwt;
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
      <p className={fr.cx("fr-mt-3w")}>
        Vous n’avez rien reçu ?{" "}
        <button
          id={domElementIds.otpChallenge.resendCodeButton}
          type="button"
          className={fr.cx("fr-link")}
          disabled={isLoading}
          onClick={onResendCode}
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
