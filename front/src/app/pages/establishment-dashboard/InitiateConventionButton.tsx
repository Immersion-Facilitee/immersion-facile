import { fr } from "@codegouvfr/react-dsfr";
import Button from "@codegouvfr/react-dsfr/Button";
import { createModal } from "@codegouvfr/react-dsfr/Modal";
import RadioButtons, {
  type RadioButtonsProps,
} from "@codegouvfr/react-dsfr/RadioButtons";
import Select from "@codegouvfr/react-dsfr/SelectNext";
import { zodResolver } from "@hookform/resolvers/zod";
import { equals } from "ramda";
import { useMemo } from "react";
import { ErrorNotifications, SectionHighlight } from "react-design-system";
import { createPortal } from "react-dom";
import { FormProvider, useForm } from "react-hook-form";
import { useDispatch } from "react-redux";
import {
  appellationCodeSchema,
  conventionTemplateIdSchema,
  domElementIds,
  frontRoutes,
  type SiretDto,
  siretSchema,
  toDisplayedDate,
  zStringMinLength1Max1024,
} from "shared";
import { Feedback } from "src/app/components/feedback/Feedback";
import { useFeedbackTopic } from "src/app/hooks/feedback.hooks";
import {
  displayReadableError,
  toErrorsWithLabels,
} from "src/app/hooks/formContents.hooks";
import { useAppSelector } from "src/app/hooks/reduxHooks";
import { authSelectors } from "src/core-logic/domain/auth/auth.selectors";
import { connectedUserSelectors } from "src/core-logic/domain/connected-user/connectedUser.selectors";
import { conventionTemplateSelectors } from "src/core-logic/domain/convention-template/conventionTemplate.selectors";
import { establishmentSelectors } from "src/core-logic/domain/establishment/establishment.selectors";
import {
  defaultFormEstablishmentValue,
  establishmentSlice,
} from "src/core-logic/domain/establishment/establishment.slice";
import { z } from "zod";

const {
  Component: InitiateConventionModal,
  open: openInitiateConventionModal,
  close: closeInitiateConventionModal,
} = createModal({
  isOpenedByDefault: false,
  id: domElementIds.establishmentDashboard.initiateConvention.modal,
});

type InitiateConventionFormValues =
  | {
      initiateConventionSource: "template";
      conventionTemplateId: string;
    }
  | {
      initiateConventionSource: "establishment";
      siret: string;
      appellation: string;
      location: string;
    };

const defaultFormValues: InitiateConventionFormValues = {
  initiateConventionSource: "establishment",
  siret: "",
  appellation: "",
  location: "",
};

const initiateConventionFormErrorLabels: Record<string, string> = {
  siret: "Veuillez sélectionner un établissement",
  appellation: "Veuillez sélectionner un métier",
  location: "Veuillez sélectionner un lieu d'immersion",
  conventionTemplateId: "Aucun modèle sélectionné",
};

const establishmentFormSchema = z.object({
  initiateConventionSource: z.literal("establishment"),
  siret: siretSchema,
  appellation: appellationCodeSchema,
  location: zStringMinLength1Max1024,
});

const templateFormSchema = z.object({
  initiateConventionSource: z.literal("template"),
  conventionTemplateId: conventionTemplateIdSchema,
});

const initiateConventionFormSchema = z.discriminatedUnion(
  "initiateConventionSource",
  [establishmentFormSchema, templateFormSchema],
);

export const InitiateConventionButton = () => {
  const dispatch = useDispatch();
  const connectedUserJwt = useAppSelector(authSelectors.connectedUserJwt);
  const currentUser = useAppSelector(connectedUserSelectors.currentUser);
  const establishment = useAppSelector(
    establishmentSelectors.formEstablishment,
  );
  const conventionTemplates = useAppSelector(
    conventionTemplateSelectors.conventionTemplates,
  );
  const isEstablishmentDefault = equals(
    establishment,
    defaultFormEstablishmentValue(),
  );
  const currentUserEstablishments = currentUser?.establishments?.filter(
    ({ isEstablishmentBanned }) => !isEstablishmentBanned,
  );
  const hasEstablishments = (currentUserEstablishments?.length ?? 0) > 0;
  const hasTemplates = conventionTemplates.length > 0;
  const establishmentFeedback = useFeedbackTopic("form-establishment");

  const initiateConventionMethods = useForm<InitiateConventionFormValues>({
    defaultValues: defaultFormValues,
    resolver: zodResolver(initiateConventionFormSchema),
    mode: "onTouched",
  });

  const {
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors: formErrors, submitCount },
  } = initiateConventionMethods;

  const initiateConventionSource = watch("initiateConventionSource");
  const values = watch();
  const selectedConventionTemplateId = watch("conventionTemplateId");

  const establishmentValues =
    initiateConventionSource === "establishment"
      ? (values as Extract<
          InitiateConventionFormValues,
          { initiateConventionSource: "establishment" }
        >)
      : null;

  const selectedOffer =
    !isEstablishmentDefault && establishmentValues?.appellation
      ? establishment.offers.find(
          (offer) => offer.appellationCode === establishmentValues.appellation,
        )
      : undefined;

  const isFullRemoteOffer = selectedOffer?.remoteWorkMode === "FULL_REMOTE";
  const defaultEstablishmentAddress =
    establishment.businessAddresses[0]?.rawAddress;

  const shouldShowAddressSelect =
    !!establishmentValues?.appellation && !isFullRemoteOffer;

  const onInitiateConventionFormSubmit = () => {
    if (initiateConventionSource === "establishment" && establishmentValues) {
      const appellation = establishment?.offers.find(
        (offer) => offer.appellationCode === establishmentValues.appellation,
      );
      closeInitiateConventionModal();
      frontRoutes
        .conventionImmersion({
          siret: establishmentValues.siret,
          immersionAppellation: appellation,
          immersionAddress: establishmentValues.location,
          skipIntro: true,
        })
        .push();
    }
    const selectedConventionTemplate = conventionTemplates.find(
      (template) => template.id === selectedConventionTemplateId,
    );
    if (selectedConventionTemplate) {
      closeInitiateConventionModal();
      frontRoutes
        .conventionImmersion({
          conventionTemplateId: selectedConventionTemplate.id,
          skipIntro: true,
          at_campaign: "establishment-dashboard-convention-template",
          at_medium: "website-if",
        })
        .push();
    }
  };

  const initiateConventionSourceOptions: RadioButtonsProps["options"] = useMemo(
    () => [
      {
        label: "À partir de vos informations",
        nativeInputProps: {
          name: "initiateConventionSource",
          value: "establishment",
          checked: initiateConventionSource === "establishment",
          onChange: () => {
            setValue("initiateConventionSource", "establishment");
            if (currentUserEstablishments?.length === 1) {
              setValue("siret", currentUserEstablishments[0].siret);
            }
          },
        },
      },
      {
        label: "À partir d'un modèle",
        nativeInputProps: {
          name: "initiateConventionSource",
          value: "template",
          checked: initiateConventionSource === "template",
          onChange: () => setValue("initiateConventionSource", "template"),
          disabled: conventionTemplates.length === 0,
        },
      },
    ],
    [
      initiateConventionSource,
      currentUserEstablishments,
      setValue,
      conventionTemplates.length,
    ],
  );

  const conventionTemplateOptions: RadioButtonsProps["options"] = useMemo(
    () =>
      conventionTemplates.map((template) => ({
        label: template.name,
        hintText: `Mise à jour le ${template.updatedAt ? toDisplayedDate({ date: new Date(template.updatedAt), withHours: true }) : ""}`,
        nativeInputProps: {
          name: "initiateConventionTemplate",
          value: template.id,
          checked: selectedConventionTemplateId === template.id,
          onChange: () => setValue("conventionTemplateId", template.id),
        },
      })),
    [conventionTemplates, selectedConventionTemplateId, setValue],
  );

  const makeResetFormValues = (siret: SiretDto) =>
    reset(
      hasEstablishments
        ? { ...defaultFormValues, siret }
        : {
            initiateConventionSource: "template",
            conventionTemplateId: "",
          },
    );

  const fetchEstablishment = (siret: SiretDto) => {
    if (!connectedUserJwt) return;
    dispatch(
      establishmentSlice.actions.fetchEstablishmentRequested({
        establishmentRequested: {
          siret,
          jwt: connectedUserJwt,
        },
        feedbackTopic: "form-establishment",
      }),
    );
  };

  const onOpenModal = () => {
    if (!hasEstablishments && !hasTemplates)
      return frontRoutes.conventionImmersion({ skipIntro: true }).push();
    const firstSiret = currentUserEstablishments?.[0]?.siret ?? "";
    if (firstSiret) fetchEstablishment(firstSiret);
    makeResetFormValues(firstSiret);
    openInitiateConventionModal();
  };

  if (
    initiateConventionSource === "establishment" &&
    !isEstablishmentDefault &&
    establishment.offers.length === 1 &&
    establishmentValues?.appellation === ""
  )
    setValue("appellation", establishment.offers[0].appellationCode);

  if (
    initiateConventionSource === "establishment" &&
    !isEstablishmentDefault &&
    defaultEstablishmentAddress &&
    establishmentValues?.appellation &&
    (isFullRemoteOffer ||
      (shouldShowAddressSelect &&
        establishment.businessAddresses.length === 1)) &&
    establishmentValues.location !== defaultEstablishmentAddress
  )
    setValue("location", defaultEstablishmentAddress);

  if (!currentUser || !connectedUserJwt) return null;

  return (
    <>
      <Button
        onClick={onOpenModal}
        id={domElementIds.establishmentDashboard.initiateConvention.button}
      >
        Initier une convention
      </Button>
      {createPortal(
        <FormProvider {...initiateConventionMethods}>
          <InitiateConventionModal
            title="Initier une convention"
            buttons={[
              {
                doClosesModal: true,
                children: "Fermer",
              },
              {
                id: domElementIds.establishmentDashboard.initiateConvention
                  .modalButton,
                doClosesModal: false,
                children: "Initier la convention",
                onClick: handleSubmit(onInitiateConventionFormSubmit),
              },
            ]}
          >
            {establishmentFeedback?.level === "error" && (
              <Feedback topics={["form-establishment"]} closable />
            )}
            <ErrorNotifications
              errorsWithLabels={toErrorsWithLabels({
                labels: initiateConventionFormErrorLabels,
                errors: displayReadableError(formErrors),
              })}
              visible={submitCount !== 0 && Object.keys(formErrors).length > 0}
            />
            <p>
              Créer une convention depuis votre espace vous permet de la
              pré-remplir avec vos informations ou à partir d'un modèle.
            </p>
            {hasEstablishments && hasTemplates && (
              <RadioButtons
                id={
                  domElementIds.establishmentDashboard.initiateConvention
                    .sourceRadioButtons
                }
                name="initiateConventionSource"
                legend="Comment souhaitez-vous initier la convention ?"
                options={initiateConventionSourceOptions}
                className={fr.cx("fr-mb-3w")}
              />
            )}
            <SectionHighlight>
              {initiateConventionSource === "template" || !hasEstablishments ? (
                <RadioButtons
                  id={
                    domElementIds.establishmentDashboard.initiateConvention
                      .templateRadioButtons
                  }
                  name="initiateConventionTemplate"
                  legend="Quel modèle souhaitez-vous utiliser ?"
                  options={conventionTemplateOptions}
                  className={fr.cx("fr-mb-3w")}
                />
              ) : (
                <>
                  Sélectionnez l'organisme pour lequel vous souhaitez initier la
                  convention.
                  <Select
                    label={"Établissement *"}
                    className={fr.cx("fr-mt-2w")}
                    placeholder="Sélectionnez un établissement"
                    disabled={
                      currentUserEstablishments &&
                      currentUserEstablishments.length === 1
                    }
                    options={
                      currentUserEstablishments?.map((est) => ({
                        value: est.siret,
                        label: est.businessName,
                      })) ?? []
                    }
                    nativeSelectProps={{
                      id: domElementIds.establishmentDashboard
                        .initiateConvention.establishmentSelect,
                      value: establishmentValues?.siret ?? "",
                      onChange: (event) => {
                        const siret = event.currentTarget.value;
                        setValue("siret", siret);
                        setValue("appellation", "");
                        setValue("location", "");
                        fetchEstablishment(siret);
                      },
                    }}
                    state={"siret" in formErrors ? "error" : "default"}
                    stateRelatedMessage={
                      "siret" in formErrors &&
                      formErrors.siret &&
                      formErrors.siret.message
                    }
                  />
                  <Select
                    label={"Métier *"}
                    placeholder="Sélectionnez un métier"
                    className={fr.cx("fr-mt-2w")}
                    disabled={
                      isEstablishmentDefault ||
                      establishment.offers.length === 1
                    }
                    options={
                      !isEstablishmentDefault
                        ? (establishment?.offers.map((offer) => ({
                            value: offer.appellationCode,
                            label: offer.appellationLabel,
                          })) ?? [])
                        : []
                    }
                    nativeSelectProps={{
                      id: domElementIds.establishmentDashboard
                        .initiateConvention.appellationSelect,
                      value: establishmentValues?.appellation ?? "",
                      onChange: (event) =>
                        setValue("appellation", event.currentTarget.value, {
                          shouldValidate: true,
                        }),
                    }}
                    state={"appellation" in formErrors ? "error" : "default"}
                    stateRelatedMessage={
                      "appellation" in formErrors &&
                      formErrors.appellation &&
                      formErrors.appellation.message
                    }
                  />
                  {shouldShowAddressSelect && (
                    <Select
                      label={"Lieu d'immersion *"}
                      placeholder="Sélectionnez un lieu d'immersion"
                      className={fr.cx("fr-mt-2w")}
                      disabled={
                        isEstablishmentDefault ||
                        establishment.businessAddresses.length === 1
                      }
                      options={
                        establishment?.businessAddresses.map((location) => ({
                          value: location.rawAddress,
                          label: location.rawAddress,
                        })) ?? []
                      }
                      nativeSelectProps={{
                        id: domElementIds.establishmentDashboard
                          .initiateConvention.addressSelect,
                        value: establishmentValues?.location ?? "",
                        onChange: (event) =>
                          setValue("location", event.currentTarget.value),
                      }}
                      state={"location" in formErrors ? "error" : "default"}
                      stateRelatedMessage={
                        "location" in formErrors &&
                        formErrors.location &&
                        formErrors.location.message
                      }
                    />
                  )}
                </>
              )}
            </SectionHighlight>
          </InitiateConventionModal>
        </FormProvider>,
        document.body,
      )}
    </>
  );
};
