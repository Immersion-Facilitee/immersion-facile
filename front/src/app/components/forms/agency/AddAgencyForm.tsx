import { fr } from "@codegouvfr/react-dsfr";
import Alert from "@codegouvfr/react-dsfr/Alert";
import { Button } from "@codegouvfr/react-dsfr/Button";
import Highlight from "@codegouvfr/react-dsfr/Highlight";
import RadioButtons, {
  type RadioButtonsProps,
} from "@codegouvfr/react-dsfr/RadioButtons";
import Select from "@codegouvfr/react-dsfr/SelectNext";
import { zodResolver } from "@hookform/resolvers/zod";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ErrorNotifications, LinkHome, useScrollTo } from "react-design-system";
import { FormProvider, type SubmitHandler, useForm } from "react-hook-form";
import { useDispatch } from "react-redux";
import {
  type AgencyDto,
  type AllowedAgencyKindToAdd,
  allAgencyKindsAllowedToAdd,
  type CreateAgencyInitialValues,
  createAgencySchema,
  type DepartmentCode,
  domElementIds,
  frontRoutes,
  toDateUTCString,
} from "shared";
import { agenciesSubmitMessageByKind } from "src/app/components/agency/AgencySubmitFeedback";
import { AgencyFormCommonFields } from "src/app/components/forms/agency/AgencyFormCommonFields";
import { agencyKindListOfOptions } from "src/app/components/forms/agency/agencyKindToLabel";
import {
  AgencySelector,
  departmentOptions,
} from "src/app/components/forms/commons/AgencySelector";
import { SubmitFeedbackNotification } from "src/app/components/SubmitFeedbackNotification";
import { formAgencyFieldsLabels } from "src/app/contents/forms/agency/formAgency";
import { useGetAcquisitionParams } from "src/app/hooks/acquisition.hooks";
import {
  displayReadableError,
  getFormContents,
  toErrorsWithLabels,
} from "src/app/hooks/formContents.hooks";
import { useAppSelector } from "src/app/hooks/reduxHooks";
import { makeUseTypedRoute } from "src/app/routes/routes.hooks";
import errorSvg from "src/assets/img/error.svg";
import successSvg from "src/assets/img/success.svg";
import { agenciesSelectors } from "src/core-logic/domain/agencies/agencies.selectors";
import {
  type AgenciesSubmitFeedback,
  agenciesSlice,
} from "src/core-logic/domain/agencies/agencies.slice";
import { match, P } from "ts-pattern";
import { v4 as uuidV4 } from "uuid";
import mushroomImage from "../../../../assets/img/mushroom.webp";
import roundSquareImage from "../../../../assets/img/round-square.webp";
import shurikenImage from "../../../../assets/img/shuriken.webp";

export const AddAgencyForm = () => {
  const [refersToOtherAgency, setRefersToOtherAgency] = useState<
    boolean | undefined
  >(undefined);
  const [preSelectedKind, setPreSelectedKind] = useState<
    AllowedAgencyKindToAdd | undefined
  >(undefined);

  const dispatch = useDispatch();
  const feedback = useAppSelector(agenciesSelectors.feedback);

  useEffect(() => {
    dispatch(agenciesSlice.actions.addAgencyClearRequested());
  }, [dispatch]);

  useScrollTo(feedback.kind === "agencyAdded");
  useScrollTo(feedback.kind === "agencyOfTypeOtherAdded");

  const onFormValid: SubmitHandler<CreateAgencyInitialValues> = (values) => {
    if (values.kind === "") throw new Error("Agency kind is empty");
    dispatch(
      agenciesSlice.actions.addAgencyRequested({
        ...values,
        kind: values.kind,
      }),
    );
  };

  const refersToOtherAgencyOptions: RadioButtonsProps["options"] = [
    {
      illustration: <img src={shurikenImage} alt="" />,
      label: "Prescripteur de droit commun",
      hintText:
        "Valide les conventions et assure la couverture du risque d'accident du travail et de maladie professionnelle (AT/MP). Exemples : Mission Locale, Cap Emploi, France Travail, Conseil Départemental, Structure IAE (hors ETTI), CEP.",
      nativeInputProps: {
        value: 0,
        onChange: () => {
          setPreSelectedKind(undefined);
          setRefersToOtherAgency(false);
        },
      },
    },
    {
      illustration: <img src={roundSquareImage} alt="" />,
      label: "Prescripteur par délégation",
      hintText:
        "Dispose, ou souhaite disposer, d'une convention signée avec un prescripteur de droit commun. Valide les conventions et assure la couverture du risque d'accident du travail et de maladie professionnelle (AT/MP).",
      nativeInputProps: {
        value: 1,
        onChange: () => {
          setPreSelectedKind("autre");
          setRefersToOtherAgency(false);
        },
      },
    },
    {
      illustration: <img src={mushroomImage} alt="" />,
      label: "Structure d'accompagnement",
      hintText:
        "Accompagne la personne tout au long de son immersion et pré-valide la convention avant la validation finale par le prescripteur. Ne cotise pas au risque AT/MP. Exemples : club sportif, organismes d'accompagnement sans délégation, etc.",
      nativeInputProps: {
        value: 2,
        onChange: () => {
          setPreSelectedKind(undefined);
          setRefersToOtherAgency(true);
        },
      },
    },
  ];
  if (
    feedback.kind === "agencyAdded" ||
    feedback.kind === "agencyOfTypeOtherAdded"
  ) {
    return (
      <SubmitFeedbackNotification
        submitFeedback={feedback}
        messageByKind={agenciesSubmitMessageByKind}
      />
    );
  }
  return (
    <>
      <Highlight className={fr.cx("fr-ml-0", "fr-pl-3w")} size="sm">
        <p className={fr.cx("fr-mb-1w")}>
          <strong>Vous ne savez encore quel est votre rôle ?</strong> Pas
          d'inquiétude ! Notre équipe peut vous aider à l'identifier en fonction
          de vos missions et obligations.
        </p>
        <p>
          <a
            className={fr.cx("fr-link", "fr-text--sm")}
            href="https://pages.immersion-facile.beta.gouv.fr/ressources-webinaires-prescripteurs-immersion-professionnelle-pmsmp/"
            target="_blank"
            rel="noreferrer"
          >
            Participer à un temps d'échange
          </a>
        </p>
      </Highlight>
      <RadioButtons
        id={domElementIds.addAgency.agencyRefersToInput}
        legend={"Quel est votre rôle dans le parcours d'immersion ?"}
        options={refersToOtherAgencyOptions}
      />

      {match(refersToOtherAgency)
        .with(P.boolean, (refersToOtherAgency) => (
          <AgencyForm
            refersToOtherAgency={refersToOtherAgency}
            preSelectedKind={preSelectedKind}
            key={`add-agency-form-${refersToOtherAgency}`}
            submitFeedback={feedback}
            onFormValid={onFormValid}
          />
        ))
        .with(undefined, () => null)
        .exhaustive()}
    </>
  );
};

type AgencyFormProps = {
  refersToOtherAgency: boolean;
  preSelectedKind?: AllowedAgencyKindToAdd;
  submitFeedback: AgenciesSubmitFeedback;
  onFormValid: SubmitHandler<CreateAgencyInitialValues>;
};

const useAddAgencyRoute =
  makeUseTypedRoute<(typeof frontRoutes.addAgency)["name"]>();

const AgencyForm = ({
  refersToOtherAgency,
  preSelectedKind,
  submitFeedback,
  onFormValid,
}: AgencyFormProps) => {
  const { getFormErrors, getFormFields } = getFormContents(
    formAgencyFieldsLabels,
  );
  const { params } = useAddAgencyRoute([frontRoutes.addAgency.name]);
  const { siret } = params;
  const formContents = getFormFields();
  const acquisitionParams = useGetAcquisitionParams();
  const formInitialValues = useMemo(
    () => ({
      ...initialValues(uuidV4()),
      ...acquisitionParams,
      validatorEmails: refersToOtherAgency ? ["temp@temp.com"] : [],
      agencySiret: siret,
      ...(preSelectedKind ? { kind: preSelectedKind } : {}),
    }),
    [refersToOtherAgency, preSelectedKind, acquisitionParams, siret],
  );
  const methods = useForm<CreateAgencyInitialValues>({
    resolver: zodResolver(createAgencySchema),
    mode: "onTouched",
    defaultValues: formInitialValues,
  });

  const { handleSubmit, formState, reset, watch, setValue, register } = methods;

  const dispatch = useDispatch();
  const agencyOptions = useAppSelector(agenciesSelectors.options);
  const isLoading = useAppSelector(agenciesSelectors.isLoading);
  const feedback = useAppSelector(agenciesSelectors.feedback);

  const [hasDelegation, setHasDelegation] = useState<boolean | null>(null);
  const selectedKind = watch("kind");

  const onDepartmentCodeChangedMemoized = useCallback(
    (departmentCode: DepartmentCode) =>
      dispatch(
        agenciesSlice.actions.fetchAgencyOptionsRequested({
          departmentCode,
          filterKind: "withoutRefersToAgency",
        }),
      ),
    [dispatch],
  );

  // Ugly, need rework on the whole agency slice and form
  const initialFormValuesRef = useRef(formInitialValues);

  useEffect(() => {
    reset(formInitialValues);
  }, [reset, formInitialValues]);

  return (
    <FormProvider {...methods}>
      <form
        onSubmit={handleSubmit((values) => {
          onFormValid(values);
          initialFormValuesRef.current = values;
          reset(values);
        })}
        id={domElementIds.addAgency.form}
      >
        {refersToOtherAgency && (
          <>
            <h2 className={fr.cx("fr-text--lead", "fr-mb-2w")}>
              Qui est le prescripteur référent de votre structure
              d'accompagnement ?
            </h2>
            <p>Il sera le validateur final des conventions</p>
            <AgencyFormMandatoryWarning />
            <AgencySelector
              fields={{
                agencyDepartmentField: {
                  name: "refersToAgencyDepartment",
                  label: "Département",
                  required: true,
                  id: "refersToAgencyDepartment",
                  placeholder: "Sélectionnez un département",
                },
                agencyIdField: formContents.refersToAgencyId,
                agencyKindField: {
                  name: "refersToAgencyKind",
                  label: "Type de structure",
                  required: true,
                  id: "refersToAgencyKind",
                  placeholder: "Veuillez choisir un type de structure",
                },
              }}
              shouldFilterDelegationPrescriptionAgencyKind={true}
              shouldShowAgencyKindField
              agencyDepartmentOptions={departmentOptions}
              onDepartmentCodeChangedMemoized={onDepartmentCodeChangedMemoized}
              agencyOptions={agencyOptions}
              isFetchAgencyOptionsError={feedback.kind === "errored"}
              isLoading={isLoading}
            />
          </>
        )}
        <h2 className={fr.cx("fr-text--lead", "fr-mb-1w")}>
          {refersToOtherAgency ? "Votre structure" : "Prescripteur"}
        </h2>
        <AgencyFormMandatoryWarning />
        <Select
          label={formContents.kind.label}
          hint={formContents.kind.hintText}
          options={agencyKindListOfOptions}
          placeholder={formContents.kind.placeholder}
          nativeSelectProps={{
            ...formContents.kind,
            onChange: (event) => {
              const { value } = event.currentTarget;
              setValue("kind", value);
            },
          }}
          state={selectedKind === "france-travail" ? "error" : "default"}
          stateRelatedMessage={
            selectedKind === "france-travail" ? agencyErrorMessage : undefined
          }
          {...register("kind")}
        />

        {selectedKind === "autre" && !refersToOtherAgency && (
          <RadioButtons
            legend="Avez-vous déjà une convention de délégation ? *"
            name="hasDelegation"
            options={hasDelegationOptions.map((option) => ({
              ...option,
              nativeInputProps: {
                ...option.nativeInputProps,
                checked:
                  Boolean(option.nativeInputProps.value) === hasDelegation,
                onChange: () => {
                  setHasDelegation(option.nativeInputProps.value === 1);
                },
              },
            }))}
            orientation="vertical"
          />
        )}

        {match({ selectedKind, hasDelegation, refersToOtherAgency })
          .with(
            {
              selectedKind: "",
            },
            () => null,
          )
          .with(
            {
              selectedKind: "autre",
              hasDelegation: false,
              refersToOtherAgency: false,
            },
            () => (
              <Alert
                severity="info"
                title="Vous ne pouvez pas finaliser votre référencement sans convention de délégation"
                description={
                  <>
                    Remplissez ce formulaire afin de recevoir par mail le
                    contact du prescripteur de droit qui peut vous délivrer
                    votre convention de délégation&nbsp;:{" "}
                    <a
                      href="https://tally.so/r/w7WM49"
                      target="_blank"
                      rel="noreferrer"
                    >
                      https://tally.so/r/w7WM49
                    </a>
                  </>
                }
              />
            ),
          )
          .with(
            {
              selectedKind: P.when(isAgencyKindAllowedToAdd),
            },
            {
              selectedKind: "autre",
              hasDelegation: true,
              refersToOtherAgency: false,
            },
            {
              selectedKind: "autre",
              hasDelegation: false,
              refersToOtherAgency: true,
            },
            () => (
              <>
                <AgencyFormCommonFields
                  refersToOtherAgency={refersToOtherAgency}
                  mode="create"
                  disableAgencyKeyFields={false}
                />

                <ErrorNotifications
                  errorsWithLabels={toErrorsWithLabels({
                    labels: getFormErrors(),
                    errors: displayReadableError(formState.errors),
                  })}
                  visible={
                    formState.submitCount !== 0 &&
                    Object.values(formState.errors).length > 0
                  }
                />
                <input
                  id={domElementIds.addAgency.id}
                  {...methods.register("id")}
                  type="hidden"
                />
                {submitFeedback.kind !== "idle" && (
                  <SubmitFeedbackNotification
                    submitFeedback={submitFeedback}
                    messageByKind={agenciesSubmitMessageByKind}
                  />
                )}

                <div className={fr.cx("fr-mt-4w")}>
                  <Button
                    type="submit"
                    disabled={isLoading}
                    nativeButtonProps={{
                      id: domElementIds.addAgency.submitButton,
                    }}
                  >
                    Soumettre
                  </Button>
                </div>
              </>
            ),
          )
          .exhaustive()}
      </form>
    </FormProvider>
  );
};

const initialValues: (id: AgencyDto["id"]) => CreateAgencyInitialValues = (
  id,
) => ({
  id,
  kind: "",
  name: "",
  createdAt: toDateUTCString(new Date()),
  agencyContactEmail: "",
  contactEmail: "",
  coveredDepartments: [],
  address: {
    streetNumberAndAddress: "",
    postcode: "",
    city: "",
    departmentCode: "",
  },
  position: {
    lat: 0,
    lon: 0,
  },
  counsellorEmails: [],
  validatorEmails: [],
  logoUrl: null,
  signature: "",
  agencySiret: "",
  refersToAgencyId: null,
  refersToAgencyName: null,
  refersToAgencyContactEmail: null,
  phoneNumber: "",
  delegationAgencyInfo: null,
});

const agencyErrorMessage = (
  <span>
    Attention, toutes les agences France Travail ont déjà été ajoutées par notre
    équipe sur Immersion Facilitée.{" "}
    <LinkHome {...frontRoutes.agencyDashboardMain().link}>
      Accéder à votre espace prescripteur.
    </LinkHome>
  </span>
);

const hasDelegationOptions: RadioButtonsProps["options"] = [
  {
    illustration: <img src={successSvg} alt="" />,
    label: "Oui",
    nativeInputProps: {
      value: 1,
    },
    hintText:
      "J'ai une délégation délivrée par un prescripteur de plein droit (France Travail, Mission Locale, Conseil départemental, Cap emploi...)",
  },
  {
    illustration: <img src={errorSvg} alt="" />,
    label: "Non",
    nativeInputProps: {
      value: 0,
    },
    hintText: `Je dois en faire la demande auprès d'un prescipteur de plein droit`,
  },
];

const isAgencyKindAllowedToAdd = (
  kind: AllowedAgencyKindToAdd | "",
): kind is AllowedAgencyKindToAdd =>
  kind !== "" && allAgencyKindsAllowedToAdd.includes(kind);

const AgencyFormMandatoryWarning = () => (
  <p className={fr.cx("fr-text--xs", "fr-mb-1w")}>
    Tous les champs marqués d'une astérisque (*) sont obligatoires.
  </p>
);
