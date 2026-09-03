import { type FrCxArg, fr } from "@codegouvfr/react-dsfr";
import Alert from "@codegouvfr/react-dsfr/Alert";
import type { BadgeProps } from "@codegouvfr/react-dsfr/Badge";
import { ButtonsGroup } from "@codegouvfr/react-dsfr/ButtonsGroup";
import { Input } from "@codegouvfr/react-dsfr/Input";
import Select, { type SelectProps } from "@codegouvfr/react-dsfr/SelectNext";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  type ElementRef,
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { FormProvider, useForm } from "react-hook-form";
import {
  type AppellationCode,
  type AppellationDto,
  type ContactLevelOfEducation,
  type ContactMode,
  type CreateDiscussionDto,
  contactLevelsOfEducation,
  conventionObjectiveOptions,
  createDiscussionSchema,
  discoverObjective,
  domElementIds,
  type ImmersionDuration,
  type ImmersionObjective,
  immersionDurationLabels,
  immersionDurations,
  labelsForContactLevelOfEducation,
  labelsForImmersionObjective,
  toLowerCaseWithoutDiacritics,
} from "shared";
import { PhoneInput } from "src/app/components/forms/commons/PhoneInput";
import {
  getDefaultAppellationCode,
  makeContactInputsLabelsByKey,
} from "src/app/components/immersion-offer/contactUtils";
import { TranscientPreferencesDisplay } from "src/app/components/immersion-offer/TranscientPreferencesDisplay";
import {
  transcientExpirationTimeInMinutes,
  useTranscientDataFromStorage,
} from "src/app/components/immersion-offer/useTranscientDataFromStorage";
import { useContactEstablishmentError } from "src/app/components/search/useContactEstablishmentError";
import { useGetAcquisitionParams } from "src/app/hooks/acquisition.hooks";
import { makeFieldError } from "src/app/hooks/formContents.hooks";
import { useCreateDiscussionRoute } from "src/app/routes/routes.hooks";
import { outOfReduxDependencies } from "src/config/dependencies";
import { match } from "ts-pattern";
import { EmailValidationInput } from "../forms/commons/EmailValidationInput";

type CreateDiscussionFormProps = {
  appellations: AppellationDto[];
  onSubmitSuccess: () => void;
  contactMode: ContactMode;
};

export const CreateDiscussionForm = ({
  appellations,
  onSubmitSuccess,
  contactMode,
}: CreateDiscussionFormProps) => {
  const { activeError, setActiveErrorKind } = useContactEstablishmentError();
  const route = useCreateDiscussionRoute();

  const inputsLabelsByKey = makeContactInputsLabelsByKey(
    route.name === "searchResult" ? "IF" : "1_ELEVE_1_STAGE",
  );

  const [invalidEmailMessage, setInvalidEmailMessage] =
    useState<ReactNode | null>(null);

  const {
    getTranscientDataForScope,
    setTranscientDataForScope,
    getPreferUseTranscientDataForScope,
  } = useTranscientDataFromStorage("contact-establishment", false);

  const formRef = useRef<ElementRef<"form">>(null);

  const transcientDataForScope = getTranscientDataForScope();
  const preferUseTranscientData = getPreferUseTranscientDataForScope();
  const acquisitionParams = useGetAcquisitionParams();
  const initialValues = useMemo<CreateDiscussionDto>(
    () => ({
      contactMode,
      siret: route.params.siret,
      appellationCode: getDefaultAppellationCode(
        appellations,
        route.params.appellationCode[0],
      ),
      datePreferences: "",
      potentialBeneficiaryFirstName: route.params.contactFirstName ?? "",
      potentialBeneficiaryLastName: route.params.contactLastName ?? "",
      potentialBeneficiaryEmail: route.params.contactEmail ?? "",
      potentialBeneficiaryResumeLink: "",
      potentialBeneficiaryPhone: route.params.contactPhone ?? "",
      locationId: route.params.location ?? "",
      ...acquisitionParams,
      ...(preferUseTranscientData && transcientDataForScope?.value
        ? { ...transcientDataForScope.value }
        : {}),
      ...(route.name === "searchResult"
        ? {
            kind: "IF",
            immersionObjective: null as any as ImmersionObjective,
            immersionDuration: null as any as ImmersionDuration,
            motivation: "",
            experienceAdditionalInformation: "",
          }
        : {
            kind: "1_ELEVE_1_STAGE",
            immersionObjective: discoverObjective,
            levelOfEducation: "3ème",
          }),
    }),
    [
      appellations,
      route.params,
      preferUseTranscientData,
      transcientDataForScope,
      acquisitionParams,
      route.name,
      contactMode,
    ],
  );

  const methods = useForm<CreateDiscussionDto>({
    resolver: zodResolver(createDiscussionSchema),
    mode: "onTouched",
    defaultValues: initialValues,
  });

  const {
    register,
    handleSubmit,
    formState,
    formState: { isSubmitting },
    reset,
    setValue,
    watch,
  } = methods;

  const contactLevelOfEducation = watch("levelOfEducation");

  useEffect(() => {
    if (contactLevelOfEducation === "2nde") {
      setValue("datePreferences", "Du 16 au 27 juin 2025");
    }
  }, [contactLevelOfEducation, setValue]);

  const getFieldError = makeFieldError(formState);

  const onFormValid = async (values: CreateDiscussionDto) => {
    setTranscientDataForScope(values, transcientExpirationTimeInMinutes);
    const errorKind =
      await outOfReduxDependencies.searchGateway.contactEstablishment({
        ...values,
      });
    if (errorKind) return setActiveErrorKind(errorKind);
    onSubmitSuccess();
  };

  return (
    <FormProvider {...methods}>
      <h2 className={fr.cx("fr-h3", "fr-mb-2w")}>
        Contacter l'entreprise <p {...contactModeToBadgeOptions[contactMode]} />
      </h2>
      <form
        // biome-ignore lint/suspicious/noConsole: debug purpose
        onSubmit={handleSubmit(onFormValid, console.error)}
        id={domElementIds[route.name].contactByMailForm}
        ref={formRef}
      >
        <TranscientPreferencesDisplay
          scope="contact-establishment"
          onPreferencesChange={(accept) => {
            const newInitialValues = accept
              ? {
                  ...initialValues,
                  ...transcientDataForScope?.value,
                }
              : initialValues;
            reset(newInitialValues);
          }}
          mode="form-overlay"
          parentRef={formRef}
        />
        {match(contactMode)
          .with("EMAIL", () => (
            <p>
              Cette entreprise a choisi d'être contactée par mail. Veuillez
              compléter ce formulaire qui sera transmis à l'entreprise.
            </p>
          ))
          .with("PHONE", () => (
            <>
              <p>Cette entreprise souhaite être contactée par téléphone.</p>
              <p>
                Vous recevrez par mail le nom de la personne à contacter, son
                numéro de téléphone ainsi que des conseils pour présenter votre
                demande d’immersion. Ces informations sont personnelles et
                confidentielles. Elles ne peuvent pas être communiquées à
                d’autres personnes. Merci !
              </p>
            </>
          ))
          .with("IN_PERSON", () => (
            <>
              <p>
                Cette entreprise souhaite que vous vous présentiez directement.
              </p>
              <p>
                Vous recevrez par mail le nom de la personne à contacter ainsi
                que des conseils pour présenter votre demande d’immersion. Ces
                informations sont personnelles et confidentielles. Elles ne
                peuvent pas être communiquées à d’autres personnes.
              </p>
            </>
          ))
          .exhaustive()}
        <h2 className={fr.cx("fr-h6")}>Vos informations de contact</h2>
        <p className={fr.cx("fr-hint-text")}>
          Pour permettre à l’entreprise de vous recontacter.
        </p>
        <Input
          label={inputsLabelsByKey.potentialBeneficiaryFirstName}
          nativeInputProps={register("potentialBeneficiaryFirstName")}
          {...getFieldError("potentialBeneficiaryFirstName")}
        />
        <Input
          label={inputsLabelsByKey.potentialBeneficiaryLastName}
          nativeInputProps={register("potentialBeneficiaryLastName")}
          {...getFieldError("potentialBeneficiaryLastName")}
        />
        <EmailValidationInput
          label={inputsLabelsByKey.potentialBeneficiaryEmail}
          nativeInputProps={{
            ...register("potentialBeneficiaryEmail", {
              setValueAs: (value) => toLowerCaseWithoutDiacritics(value),
            }),
            onBlur: (event) => {
              setValue(
                "potentialBeneficiaryEmail",
                toLowerCaseWithoutDiacritics(event.currentTarget.value),
              );
            },
          }}
          {...getFieldError("potentialBeneficiaryEmail")}
          onEmailValidationFeedback={({ state, stateRelatedMessage }) =>
            setInvalidEmailMessage(
              state === "error" ? stateRelatedMessage : null,
            )
          }
        />
        <PhoneInput
          label={inputsLabelsByKey.potentialBeneficiaryPhone}
          inputProps={{
            label: inputsLabelsByKey.potentialBeneficiaryPhone,
            nativeInputProps: {
              ...register("potentialBeneficiaryPhone"),
              type: "phone",
            },
          }}
          onPhoneNumberChange={(phoneNumber) => {
            setValue("potentialBeneficiaryPhone", phoneNumber);
          }}
          {...getFieldError("potentialBeneficiaryPhone")}
        />
        <h2 className={fr.cx("fr-h6", "fr-mt-3w")}>
          {route.name === "searchResult" ? "Votre immersion" : "Votre stage"}
        </h2>
        <p className={fr.cx("fr-hint-text")}>
          Donnez un maximum d’informations à l’entreprise pour qu’elle sache si
          elle est en capacité de vous accueillir.
        </p>

        {route.name === "searchResult" && (
          <Select
            label={inputsLabelsByKey.immersionObjective}
            options={immersionObjectiveListOfOptions}
            placeholder={"But de l'immersion"}
            nativeSelectProps={{
              ...register("immersionObjective"),
            }}
            {...getFieldError("immersionObjective")}
          />
        )}

        <Select
          disabled={appellations.length === 1}
          label={inputsLabelsByKey.appellationCode}
          options={appellationListOfOptions(appellations)}
          nativeSelectProps={{
            ...register("appellationCode"),
          }}
          {...getFieldError("appellationCode")}
        />
        {route.name === "searchResultForStudent" && (
          <Select
            label={inputsLabelsByKey.levelOfEducation}
            options={contactLevelsOfEducationsListOfOptions}
            nativeSelectProps={{
              ...register("levelOfEducation"),
            }}
            {...getFieldError("levelOfEducation")}
          />
        )}
        <Input
          label={inputsLabelsByKey.datePreferences}
          hintText={
            "Exemple : “Du 1er au 10 juillet”, “Idéalement en septembre” ou “Je suis flexible”"
          }
          nativeInputProps={{
            ...register("datePreferences"),
          }}
          {...getFieldError("datePreferences")}
        />
        {route.name === "searchResult" && (
          <>
            <Select
              label={inputsLabelsByKey.immersionDuration}
              options={immersionDurationListOfOptions}
              placeholder="Sélectionner la durée"
              nativeSelectProps={{
                ...register("immersionDuration"),
              }}
              {...getFieldError("immersionDuration")}
            />
            <Input
              label={inputsLabelsByKey.motivation}
              hintText={
                "Exemple : “J'aime beaucoup le contact avec les gens. Je pense que ce métier est fait pour moi et je veux le vérifier.” ou “J'habite près de chez vous et j'aime beaucoup ce que vous faites. J'aimerais beaucoup apprendre avec votre équipe.”"
              }
              nativeTextAreaProps={{
                ...register("motivation"),
              }}
              {...getFieldError("motivation")}
              textArea
            />
            <h2 className={fr.cx("fr-h6", "fr-mt-3w")}>
              Vos expériences et compétences
            </h2>
            <p className={fr.cx("fr-hint-text")}>
              N’hésitez pas à détailler vos compétences, cela augmentera vos
              chances de recevoir une réponse positive de l’entreprise.
            </p>
            <Input
              label={inputsLabelsByKey.experienceAdditionalInformation}
              hintText={
                "Exemple : “Je suis de nature très manuelle et je bricole beaucoup chez moi (menuiserie, petites réparations). Je n'ai pas de diplôme dans ce secteur, mais j'ai une grande capacité d'adaptation et le goût du travail bien fait.”"
              }
              state="info"
              stateRelatedMessage={
                <span>
                  <strong>Protection de vos données personnelles :</strong> Nous
                  vous invitons à partager uniquement les informations utiles à
                  la compréhension de votre parcours. Évitez d'inclure des
                  informations trop personnelles (comme vos opinions
                  philosophiques, syndicales, politiques ou des éléments liés à
                  votre vie sexuelle). Ces données sensibles ne sont pas
                  nécessaires et nous souhaitons les protéger.
                </span>
              }
              nativeTextAreaProps={{
                ...register("experienceAdditionalInformation"),
              }}
              {...getFieldError("experienceAdditionalInformation")}
              textArea
            />
            <Input
              label={inputsLabelsByKey.potentialBeneficiaryResumeLink}
              nativeInputProps={{
                ...register("potentialBeneficiaryResumeLink"),
              }}
              {...getFieldError("potentialBeneficiaryResumeLink")}
            />
          </>
        )}
        <ButtonsGroup
          className={fr.cx()}
          alignment="right"
          inlineLayoutWhen="always"
          buttons={[
            {
              type: "submit",
              priority: "primary",
              disabled:
                isSubmitting ||
                activeError.isActive ||
                invalidEmailMessage !== null,
              nativeButtonProps: {
                id: domElementIds[route.name].contactByMailButton,
              },
              children: "Envoyer",
            },
          ]}
        />
        {invalidEmailMessage !== null && (
          <Alert
            severity="error"
            title="Email invalide"
            description={`L'email de contact que vous avez utilisé dans le formulaire de contact a été invalidé par notre vérificateur d'email pour la raison suivante : ${invalidEmailMessage}`}
          />
        )}
        {activeError.isActive && (
          <Alert
            severity="error"
            title={activeError.title}
            description={activeError.description}
          />
        )}
      </form>
    </FormProvider>
  );
};

const immersionObjectiveListOfOptions: SelectProps.Option<ImmersionObjective>[] =
  conventionObjectiveOptions.map((immersionObjective) => ({
    value: immersionObjective,
    label: labelsForImmersionObjective[immersionObjective],
  }));

const contactLevelsOfEducationsListOfOptions: SelectProps.Option<ContactLevelOfEducation>[] =
  contactLevelsOfEducation.map((contactLevelOfEducation) => ({
    label: labelsForContactLevelOfEducation[contactLevelOfEducation],
    value: contactLevelOfEducation,
  }));

const immersionDurationListOfOptions: SelectProps.Option<ImmersionDuration>[] =
  immersionDurations.map((immersionDuration) => ({
    label: immersionDurationLabels[immersionDuration],
    value: immersionDuration,
  }));

const appellationListOfOptions = (
  appellations: AppellationDto[],
): SelectProps.Option<AppellationCode>[] =>
  appellations.map((appellation) => ({
    value: appellation.appellationCode,
    label: appellation.appellationLabel,
  }));

const commonBadgeClassName: FrCxArg = [
  "fr-badge",
  "fr-badge--icon-left",
  "fr-badge--green-archipel",
];
export const contactModeToBadgeOptions: Record<ContactMode, BadgeProps> = {
  EMAIL: {
    children: "Mise en relation par mail",
    className: fr.cx(...commonBadgeClassName, "fr-icon-mail-line"),
  },
  PHONE: {
    children: "Mise en relation par téléphone",
    className: fr.cx(...commonBadgeClassName, "fr-icon-phone-line"),
  },
  IN_PERSON: {
    children: "Rendez-vous sur place",
    className: fr.cx(...commonBadgeClassName, "fr-icon-map-pin-2-line"),
  },
};
